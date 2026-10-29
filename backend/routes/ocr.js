const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const db = require("../db");
const { extractReceiptData } = require("../services/ocrService");
const { matchReceiptToStudent } = require("../services/matching");
const { computeStudentSummary, computeFeeAssignment } = require("../services/feeCalculation");
const { logAudit } = require("../services/audit");

const uploadDir = path.join(__dirname, "..", "data", "uploads");
require("fs").mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// POST /api/ocr/receipts - upload a receipt image, run OCR + matching, store as PENDING_REVIEW
router.post("/receipts", upload.single("receipt"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No receipt image uploaded (field name: 'receipt')" });

  try {
    const extracted = await extractReceiptData(req.file.path, req.file.originalname);

    const match = matchReceiptToStudent({
      student_code: extracted.student_code,
      roll_number: extracted.roll_number,
      student_name: extracted.student_name,
      amount: extracted.amount,
      date: extracted.date,
    });

    // Try to find a matching fee assignment for the extracted category, on the matched student
    let matchedFeeAssignmentId = null;
    if (match.matchedStudent) {
      const candidate = db
        .prepare(
          `SELECT fa.id FROM fee_assignments fa
           JOIN fee_types ft ON ft.id = fa.fee_type_id
           WHERE fa.student_id = ? AND fa.status = 'active'
           AND (? IS NULL OR ft.category = ?)
           ORDER BY fa.due_date ASC LIMIT 1`
        )
        .get(match.matchedStudent.id, extracted.fee_category || null, extracted.fee_category || null);
      matchedFeeAssignmentId = candidate ? candidate.id : null;
    }

    const result = db
      .prepare(
        `INSERT INTO ocr_receipts
         (image_filename, raw_text, extracted_student_name, extracted_student_code, extracted_roll_number,
          extracted_amount, extracted_date, extracted_fee_category, confidence_score, matched_student_id,
          matched_fee_assignment_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW')`
      )
      .run(
        req.file.filename,
        extracted.raw_text,
        extracted.student_name,
        extracted.student_code,
        extracted.roll_number,
        extracted.amount,
        extracted.date,
        extracted.fee_category,
        match.confidence,
        match.matchedStudent ? match.matchedStudent.id : null,
        matchedFeeAssignmentId
      );

    const receipt = db.prepare("SELECT * FROM ocr_receipts WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({
      ...receipt,
      confidenceLevel: match.confidenceLevel,
      matchedStudent: match.matchedStudent,
      matchedFeeAssignment: matchedFeeAssignmentId ? computeFeeAssignment(matchedFeeAssignmentId) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ocr/receipts - list, optionally filter by status
router.get("/receipts", (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare("SELECT * FROM ocr_receipts WHERE status = ? ORDER BY created_at DESC").all(status)
    : db.prepare("SELECT * FROM ocr_receipts ORDER BY created_at DESC").all();
  res.json(rows);
});

// GET /api/ocr/receipts/:id
router.get("/receipts/:id", (req, res) => {
  const receipt = db.prepare("SELECT * FROM ocr_receipts WHERE id = ?").get(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Receipt not found" });
  res.json(receipt);
});

// POST /api/ocr/receipts/:id/confirm
// This is the step that actually creates the ledger payment. OCR NEVER writes
// a payment by itself - a human always clicks Confirm first.
// body can override: { student_id, fee_assignment_id, amount }
router.post("/receipts/:id/confirm", (req, res) => {
  const receipt = db.prepare("SELECT * FROM ocr_receipts WHERE id = ?").get(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Receipt not found" });
  if (receipt.status !== "PENDING_REVIEW") {
    return res.status(400).json({ error: `Receipt already ${receipt.status}` });
  }

  const studentId = req.body.student_id || receipt.matched_student_id;
  const feeAssignmentId = req.body.fee_assignment_id || receipt.matched_fee_assignment_id;
  const amount = req.body.amount || receipt.extracted_amount;

  if (!studentId || !amount) {
    return res.status(400).json({ error: "Could not confirm: missing student_id or amount. Provide them explicitly." });
  }

  const before = computeFeeAssignment(feeAssignmentId);

  // Create the payment through the same insert pattern payments.js uses -
  // done inline here to keep this route self-contained for the critical demo path.
  const { v4: uuidv4 } = require("uuid");
  const transaction_id = "TXN-" + uuidv4().split("-")[0].toUpperCase();

  const paymentResult = db
    .prepare(
      `INSERT INTO payments (student_id, amount, payment_method, source, status, payment_date, receipt_number, transaction_id)
       VALUES (?, ?, 'CASH', 'OCR_RECEIPT', 'SUCCESS', CURRENT_TIMESTAMP, ?, ?)`
    )
    .run(studentId, amount, "RCPT-" + receipt.id, transaction_id);
  const paymentId = paymentResult.lastInsertRowid;

  if (feeAssignmentId) {
    db.prepare(
      "INSERT INTO payment_allocations (payment_id, fee_assignment_id, allocated_amount) VALUES (?, ?, ?)"
    ).run(paymentId, feeAssignmentId, amount);
  }

  db.prepare(
    "UPDATE ocr_receipts SET status = 'CONFIRMED', linked_payment_id = ?, matched_student_id = ?, matched_fee_assignment_id = ? WHERE id = ?"
  ).run(paymentId, studentId, feeAssignmentId, req.params.id);

  logAudit({
    action: "CONFIRM_OCR_RECEIPT",
    entityType: "ocr_receipt",
    entityId: req.params.id,
    newValue: { paymentId, studentId, feeAssignmentId, amount },
  });

  const after = feeAssignmentId ? computeFeeAssignment(feeAssignmentId) : null;

  res.json({
    success: true,
    message: "Payment successfully added to the ledger.",
    payment: db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId),
    before: before ? { pending: before.pending, paid: before.paid } : null,
    after: after ? { pending: after.pending, paid: after.paid } : null,
    studentSummary: computeStudentSummary(studentId),
  });
});

// POST /api/ocr/receipts/:id/reject
router.post("/receipts/:id/reject", (req, res) => {
  const receipt = db.prepare("SELECT * FROM ocr_receipts WHERE id = ?").get(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Receipt not found" });

  db.prepare("UPDATE ocr_receipts SET status = 'REJECTED' WHERE id = ?").run(req.params.id);
  logAudit({ action: "REJECT_OCR_RECEIPT", entityType: "ocr_receipt", entityId: req.params.id, oldValue: receipt });
  res.json({ success: true });
});

// PUT /api/ocr/receipts/:id - admin edits the extracted fields before confirming
router.put("/receipts/:id", (req, res) => {
  const receipt = db.prepare("SELECT * FROM ocr_receipts WHERE id = ?").get(req.params.id);
  if (!receipt) return res.status(404).json({ error: "Receipt not found" });

  const { extracted_student_name, extracted_amount, extracted_fee_category, matched_student_id, matched_fee_assignment_id } = req.body;
  db.prepare(
    `UPDATE ocr_receipts SET
      extracted_student_name = ?, extracted_amount = ?, extracted_fee_category = ?,
      matched_student_id = ?, matched_fee_assignment_id = ?
     WHERE id = ?`
  ).run(
    extracted_student_name ?? receipt.extracted_student_name,
    extracted_amount ?? receipt.extracted_amount,
    extracted_fee_category ?? receipt.extracted_fee_category,
    matched_student_id ?? receipt.matched_student_id,
    matched_fee_assignment_id ?? receipt.matched_fee_assignment_id,
    req.params.id
  );

  res.json(db.prepare("SELECT * FROM ocr_receipts WHERE id = ?").get(req.params.id));
});

module.exports = router;
