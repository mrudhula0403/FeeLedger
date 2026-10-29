const express = require("express");
const router = express.Router();
const db = require("../db");
const { computeFeeAssignment } = require("../services/feeCalculation");
const { logAudit } = require("../services/audit");

// GET /api/fee-assignments
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT id FROM fee_assignments").all();
  res.json(rows.map((r) => computeFeeAssignment(r.id)));
});

// POST /api/fee-assignments - assign a fee to a student (or a whole class, if class_id given instead)
router.post("/", (req, res) => {
  const { student_id, class_id, fee_type_id, academic_year, amount, due_date, billing_period } = req.body;

  if (!fee_type_id || !amount) {
    return res.status(400).json({ error: "fee_type_id and amount are required" });
  }
  if (!student_id && !class_id) {
    return res.status(400).json({ error: "Provide either student_id or class_id" });
  }

  const insert = db.prepare(
    `INSERT INTO fee_assignments (student_id, fee_type_id, academic_year, amount, due_date, billing_period)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const created = [];

  if (student_id) {
    const result = insert.run(student_id, fee_type_id, academic_year || "2026-27", amount, due_date || null, billing_period || "annual");
    created.push(result.lastInsertRowid);
  } else {
    // Assign to every student in the class - this is the "assign fee to an entire class" requirement
    const students = db.prepare("SELECT id FROM students WHERE class_id = ?").all(class_id);
    for (const s of students) {
      const result = insert.run(s.id, fee_type_id, academic_year || "2026-27", amount, due_date || null, billing_period || "annual");
      created.push(result.lastInsertRowid);
    }
  }

  logAudit({ action: "CREATE", entityType: "fee_assignment", entityId: created[0], newValue: req.body });
  res.status(201).json({ created_ids: created, items: created.map(computeFeeAssignment) });
});

// GET /api/students/:id/fees - convenience route, mounted separately in server.js
router.getStudentFees = (studentId) => {
  const rows = db.prepare("SELECT id FROM fee_assignments WHERE student_id = ? AND status = 'active'").all(studentId);
  return rows.map((r) => computeFeeAssignment(r.id));
};

// PUT /api/fee-assignments/:id
router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM fee_assignments WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Fee assignment not found" });

  const { amount, due_date, billing_period, status } = req.body;
  db.prepare(
    "UPDATE fee_assignments SET amount = ?, due_date = ?, billing_period = ?, status = ? WHERE id = ?"
  ).run(
    amount ?? existing.amount,
    due_date ?? existing.due_date,
    billing_period ?? existing.billing_period,
    status ?? existing.status,
    req.params.id
  );

  logAudit({ action: "UPDATE", entityType: "fee_assignment", entityId: req.params.id, oldValue: existing, newValue: req.body });
  res.json(computeFeeAssignment(req.params.id));
});

// ---- Adjustments (waivers, scholarships, penalties, late fees) ----

// POST /api/fee-adjustments
router.post("/adjustments", (req, res) => {
  const { fee_assignment_id, type, amount, reason } = req.body;
  const validTypes = ["WAIVER", "SCHOLARSHIP", "DISCOUNT", "LATE_FEE", "PENALTY", "REFUND", "OTHER"];

  if (!fee_assignment_id || !validTypes.includes(type) || !amount) {
    return res.status(400).json({ error: `fee_assignment_id, amount, and a valid type (${validTypes.join(", ")}) are required` });
  }

  const result = db
    .prepare("INSERT INTO fee_adjustments (fee_assignment_id, type, amount, reason) VALUES (?, ?, ?, ?)")
    .run(fee_assignment_id, type, amount, reason || null);

  logAudit({ action: "CREATE", entityType: "fee_adjustment", entityId: result.lastInsertRowid, newValue: req.body });
  res.status(201).json(computeFeeAssignment(fee_assignment_id));
});

// GET /api/fee-assignments/:id/adjustments
router.get("/:id/adjustments", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM fee_adjustments WHERE fee_assignment_id = ? ORDER BY created_at DESC")
    .all(req.params.id);
  res.json(rows);
});

module.exports = router;
