const express = require("express");
const router = express.Router();
const db = require("../db");
const { computeFeeAssignment } = require("../services/feeCalculation");
const { logAudit } = require("../services/audit");

// GET /api/challans
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM challans ORDER BY created_at DESC").all();
  res.json(rows);
});

// GET /api/challans/:id
router.get("/:id", (req, res) => {
  const challan = db.prepare("SELECT * FROM challans WHERE id = ?").get(req.params.id);
  if (!challan) return res.status(404).json({ error: "Challan not found" });
  const items = db.prepare("SELECT * FROM challan_items WHERE challan_id = ?").all(challan.id);
  res.json({ ...challan, items });
});

// POST /api/challans - generate a challan for one or more pending fee assignments
// body: { student_id, fee_assignment_ids: [1,2,3], due_date }
router.post("/", (req, res) => {
  const { student_id, fee_assignment_ids, due_date } = req.body;
  if (!student_id || !fee_assignment_ids || fee_assignment_ids.length === 0) {
    return res.status(400).json({ error: "student_id and at least one fee_assignment_id are required" });
  }

  const challan_number = "CHL-2026-" + String(Date.now()).slice(-6);
  let total = 0;
  const items = fee_assignment_ids.map((id) => {
    const computed = computeFeeAssignment(id);
    total += computed.pending;
    return { fee_assignment_id: id, amount: computed.pending };
  });

  const result = db
    .prepare("INSERT INTO challans (challan_number, student_id, total_amount, due_date, status) VALUES (?, ?, ?, ?, 'PENDING')")
    .run(challan_number, student_id, total, due_date || null);
  const challanId = result.lastInsertRowid;

  const insertItem = db.prepare("INSERT INTO challan_items (challan_id, fee_assignment_id, amount) VALUES (?, ?, ?)");
  for (const item of items) insertItem.run(challanId, item.fee_assignment_id, item.amount);

  logAudit({ action: "CREATE", entityType: "challan", entityId: challanId, newValue: req.body });
  res.status(201).json({ ...db.prepare("SELECT * FROM challans WHERE id = ?").get(challanId), items });
});

// POST /api/challans/:id/pay - mock online payment simulation (PENDING -> PROCESSING -> SUCCESS)
// For a real deploy, swap this for a real gateway (e.g. Razorpay) behind the same route.
router.post("/:id/pay", async (req, res) => {
  const challan = db.prepare("SELECT * FROM challans WHERE id = ?").get(req.params.id);
  if (!challan) return res.status(404).json({ error: "Challan not found" });
  if (challan.status === "PAID") return res.status(400).json({ error: "Challan already paid" });

  const { v4: uuidv4 } = require("uuid");
  const transaction_id = "TXN-" + uuidv4().split("-")[0].toUpperCase();

  // Simulate PENDING -> PROCESSING -> SUCCESS. In a real HTTP request/response cycle we can't literally
  // sleep for UX purposes, so the frontend is expected to show a short "Processing..." animation itself
  // while this resolves - this endpoint returns the final SUCCESS state.
  const paymentResult = db
    .prepare(
      `INSERT INTO payments (student_id, amount, payment_method, source, status, payment_date, transaction_id)
       VALUES (?, ?, 'ONLINE_CHALLAN', 'CHALLAN', 'SUCCESS', CURRENT_TIMESTAMP, ?)`
    )
    .run(challan.student_id, challan.total_amount, transaction_id);
  const paymentId = paymentResult.lastInsertRowid;

  const items = db.prepare("SELECT * FROM challan_items WHERE challan_id = ?").all(challan.id);
  const insertAlloc = db.prepare("INSERT INTO payment_allocations (payment_id, fee_assignment_id, allocated_amount) VALUES (?, ?, ?)");
  for (const item of items) insertAlloc.run(paymentId, item.fee_assignment_id, item.amount);

  db.prepare("UPDATE challans SET status = 'PAID' WHERE id = ?").run(challan.id);
  logAudit({ action: "PAY", entityType: "challan", entityId: challan.id, newValue: { paymentId, transaction_id } });

  res.json({
    success: true,
    transaction_id,
    status: "SUCCESS",
    payment: db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId),
  });
});

module.exports = router;
