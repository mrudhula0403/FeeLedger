const express = require("express");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();
const db = require("../db");
const { computeFeeAssignment, computeStudentSummary } = require("../services/feeCalculation");
const { logAudit } = require("../services/audit");

// GET /api/payments
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM payments ORDER BY payment_date DESC").all();
  res.json(rows);
});

// GET /api/payments/:id
router.get("/:id", (req, res) => {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id);
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  const allocations = db.prepare("SELECT * FROM payment_allocations WHERE payment_id = ?").all(payment.id);
  res.json({ ...payment, allocations });
});

// POST /api/payments - create a payment and allocate it across one or more fee assignments.
// This is the SINGLE entry point every payment method (UPI, cash, cheque, OCR) should funnel through,
// so the ledger logic (never overwrite paid_amount, always insert a row) lives in one place.
//
// body: {
//   student_id, amount, payment_method, source, status, reference_number,
//   allocations: [{ fee_assignment_id, allocated_amount }, ...]   // optional - auto-allocates oldest-due-first if omitted
// }
router.post("/", (req, res) => {
  const {
    student_id,
    amount,
    payment_method,
    source,
    status,
    reference_number,
    receipt_number,
    cheque_bank_name,
    cheque_number,
    cheque_clearance_date,
    allocations,
  } = req.body;

  const validMethods = ["UPI", "CASH", "CHEQUE", "BANK_TRANSFER", "ONLINE_CHALLAN", "CARD"];
  const validSources = ["MANUAL", "OCR_RECEIPT", "ONLINE_GATEWAY", "CHALLAN"];

  if (!student_id || !amount || !validMethods.includes(payment_method) || !validSources.includes(source)) {
    return res.status(400).json({
      error: `student_id, amount, a valid payment_method (${validMethods.join(", ")}), and a valid source (${validSources.join(", ")}) are required`,
    });
  }

  const transaction_id = "TXN-" + uuidv4().split("-")[0].toUpperCase();
  const finalStatus = status || (payment_method === "CHEQUE" ? "PENDING_VERIFICATION" : "SUCCESS");

  const insertPayment = db.prepare(
    `INSERT INTO payments (student_id, amount, payment_method, source, status, payment_date, reference_number, transaction_id, receipt_number, cheque_bank_name, cheque_number, cheque_clearance_date)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)`
  );

  const result = insertPayment.run(
    student_id,
    amount,
    payment_method,
    source,
    finalStatus,
    reference_number || null,
    transaction_id,
    receipt_number || null,
    cheque_bank_name || null,
    cheque_number || null,
    cheque_clearance_date || null
  );
  const paymentId = result.lastInsertRowid;

  // Allocation: if the caller specified exactly where the money goes, use that.
  // Otherwise auto-allocate to the student's oldest-due-first pending fee assignments
  // (this is what makes "parent pays a lump sum" work without extra UI work).
  let allocationsToInsert = allocations;
  if (!allocationsToInsert || allocationsToInsert.length === 0) {
    allocationsToInsert = autoAllocate(student_id, amount);
  }

  const insertAllocation = db.prepare(
    "INSERT INTO payment_allocations (payment_id, fee_assignment_id, allocated_amount) VALUES (?, ?, ?)"
  );
  for (const alloc of allocationsToInsert) {
    insertAllocation.run(paymentId, alloc.fee_assignment_id, alloc.allocated_amount);
  }

  logAudit({ action: "CREATE", entityType: "payment", entityId: paymentId, newValue: req.body });

  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
  res.status(201).json({ ...payment, allocations: allocationsToInsert, studentSummary: computeStudentSummary(student_id) });
});

// Distributes `amount` across a student's pending fee assignments, oldest due_date first
function autoAllocate(studentId, amount) {
  const assignments = db
    .prepare("SELECT id FROM fee_assignments WHERE student_id = ? AND status = 'active' ORDER BY due_date ASC")
    .all(studentId);

  let remaining = amount;
  const result = [];
  for (const a of assignments) {
    if (remaining <= 0) break;
    const computed = computeFeeAssignment(a.id);
    if (computed.pending <= 0) continue;
    const toAllocate = Math.min(remaining, computed.pending);
    result.push({ fee_assignment_id: a.id, allocated_amount: toAllocate });
    remaining -= toAllocate;
  }
  // If there's leftover (overpayment / no pending fees left), park it against the last assignment
  // so the money is never silently dropped - admin can see and reconcile it manually.
  if (remaining > 0 && assignments.length > 0) {
    result.push({ fee_assignment_id: assignments[assignments.length - 1].id, allocated_amount: remaining });
  }
  return result;
}

// GET /api/students/:id/payments - mounted as convenience in server.js
router.getStudentPayments = (studentId) => {
  return db.prepare("SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC").all(studentId);
};

// POST /api/payments/:id/mark-cheque-cleared - cheque workflow
router.post("/:id/mark-cheque-cleared", (req, res) => {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id);
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  db.prepare("UPDATE payments SET status = 'CLEARED' WHERE id = ?").run(req.params.id);
  logAudit({ action: "CHEQUE_CLEARED", entityType: "payment", entityId: req.params.id, oldValue: payment });
  res.json({ success: true, status: "CLEARED" });
});

// POST /api/payments/:id/mark-cheque-bounced - cheque bounce correction
router.post("/:id/mark-cheque-bounced", (req, res) => {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id);
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  // Payment must NOT remain SUCCESS/CLEARED - the ledger self-corrects because
  // computeFeeAssignment() only sums SUCCESS/CLEARED payments, so pending amount
  // automatically goes back up once we flip this to BOUNCED.
  db.prepare("UPDATE payments SET status = 'BOUNCED' WHERE id = ?").run(req.params.id);
  logAudit({ action: "CHEQUE_BOUNCED", entityType: "payment", entityId: req.params.id, oldValue: payment });
  res.json({ success: true, status: "BOUNCED", note: "Ledger auto-corrected: pending amount restored." });
});

module.exports = router;
