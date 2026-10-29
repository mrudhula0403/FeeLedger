const express = require("express");
const router = express.Router();
const db = require("../db");
const { calculateHealthScore } = require("../services/healthScore");
const { computeFeeAssignment, computeStudentSummary } = require("../services/feeCalculation");

// GET /api/dashboard/summary
router.get("/summary", (req, res) => {
  const health = calculateHealthScore();
  const studentsWithPending = db
    .prepare("SELECT id FROM students")
    .all()
    .filter((s) => computeStudentSummary(s.id).totalPending > 0).length;

  res.json({
    healthScore: health.score,
    healthLabel: health.label,
    totalExpected: health.totalExpected,
    totalCollected: health.totalCollected,
    totalPending: health.totalPending,
    overdueAmount: health.totalOverdueAmount,
    studentsWithPendingFees: studentsWithPending,
    totalStudents: health.totalStudents,
  });
});

// GET /api/dashboard/health-score
router.get("/health-score", (req, res) => {
  res.json(calculateHealthScore());
});

// GET /api/dashboard/category-breakdown - collection by fee category, for the table + chart
router.get("/category-breakdown", (req, res) => {
  const feeTypes = db.prepare("SELECT * FROM fee_types WHERE is_active = 1").all();
  const breakdown = feeTypes.map((ft) => {
    const assignments = db.prepare("SELECT id FROM fee_assignments WHERE fee_type_id = ?").all(ft.id);
    let expected = 0,
      collected = 0;
    for (const a of assignments) {
      const computed = computeFeeAssignment(a.id);
      expected += computed.final_payable;
      collected += computed.paid;
    }
    const pending = expected - collected;
    const collectionPct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    return { category: ft.category, feeTypeName: ft.name, expected, collected, pending, collectionPct };
  });
  res.json(breakdown);
});

// GET /api/dashboard/overdue - the pending/overdue fee dashboard
router.get("/overdue", (req, res) => {
  const { class_id, fee_category, priority } = req.query;

  const rows = db
    .prepare(
      `SELECT fa.id as fee_assignment_id, s.id as student_id, s.name as student_name, s.student_code,
              c.name as class_name, c.section, ft.category, ft.name as fee_type_name, fa.due_date
       FROM fee_assignments fa
       JOIN students s ON s.id = fa.student_id
       JOIN fee_types ft ON ft.id = fa.fee_type_id
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE fa.status = 'active'`
    )
    .all();

  let results = rows
    .map((r) => {
      const computed = computeFeeAssignment(r.fee_assignment_id);
      if (computed.pending <= 0) return null;

      let daysOverdue = 0;
      if (r.due_date) {
        const diff = Date.now() - new Date(r.due_date).getTime();
        daysOverdue = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      }

      let priorityLevel = "LOW";
      if (daysOverdue > 30) priorityLevel = "HIGH";
      else if (daysOverdue > 7) priorityLevel = "MEDIUM";

      return {
        fee_assignment_id: r.fee_assignment_id,
        student_id: r.student_id,
        student_name: r.student_name,
        student_code: r.student_code,
        class_name: r.class_name,
        section: r.section,
        category: r.category,
        fee_type_name: r.fee_type_name,
        due_date: r.due_date,
        total: computed.final_payable,
        paid: computed.paid,
        pending: computed.pending,
        days_overdue: daysOverdue,
        priority: priorityLevel,
      };
    })
    .filter(Boolean);

  if (class_id) results = results.filter((r) => String(r.class_name) === String(class_id));
  if (fee_category) results = results.filter((r) => r.category === fee_category);
  if (priority) results = results.filter((r) => r.priority === priority);

  results.sort((a, b) => b.days_overdue - a.days_overdue);
  res.json(results);
});

module.exports = router;
