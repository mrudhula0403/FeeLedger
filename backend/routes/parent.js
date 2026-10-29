const express = require("express");
const router = express.Router();
const db = require("../db");
const { computeStudentSummary } = require("../services/feeCalculation");

// GET /api/parent/:token - no-login read-only view, accessed via a shareable link
router.get("/:token", (req, res) => {
  const student = db.prepare("SELECT * FROM students WHERE parent_token = ?").get(req.params.token);
  if (!student) return res.status(404).json({ error: "Invalid or expired link" });

  const classInfo = student.class_id
    ? db.prepare("SELECT * FROM classes WHERE id = ?").get(student.class_id)
    : null;

  const summary = computeStudentSummary(student.id);

  const payments = db
    .prepare(
      `SELECT p.amount, p.payment_method, p.payment_date, p.reference_number, p.status, p.transaction_id
       FROM payments p WHERE p.student_id = ? AND p.status IN ('SUCCESS', 'CLEARED')
       ORDER BY p.payment_date DESC`
    )
    .all(student.id);

  // Category breakdown for this student specifically
  const categoryBreakdown = {};
  for (const item of summary.items) {
    const feeType = db.prepare("SELECT category, name FROM fee_types WHERE id = ?").get(item.fee_type_id);
    const cat = feeType ? feeType.category : "Other";
    if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { total: 0, paid: 0, pending: 0 };
    categoryBreakdown[cat].total += item.final_payable;
    categoryBreakdown[cat].paid += item.paid;
    categoryBreakdown[cat].pending += item.pending;
  }

  res.json({
    student: {
      name: student.name,
      student_code: student.student_code,
      class: classInfo ? `${classInfo.name}-${classInfo.section}` : null,
    },
    totalFee: summary.totalFee,
    totalPaid: summary.totalPaid,
    totalPending: summary.totalPending,
    categoryBreakdown,
    paymentHistory: payments,
  });
});

// POST /api/notifications/remind - simulated reminder (MVP: just logs a notification record)
router.post("/notify/:studentId", (req, res) => {
  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const message = req.body.message || `Reminder: Please clear your pending fees for ${student.name}.`;
  db.prepare("INSERT INTO notifications (student_id, message, channel) VALUES (?, ?, 'simulated')").run(
    student.id,
    message
  );

  res.json({ success: true, message: "Reminder sent (simulated)." });
});

module.exports = router;
