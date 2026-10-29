const express = require("express");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();
const db = require("../db");
const { computeStudentSummary } = require("../services/feeCalculation");
const { logAudit } = require("../services/audit");

// GET /api/students - list all, with computed pending totals
router.get("/", (req, res) => {
  const students = db
    .prepare(
      `SELECT s.*, c.name as class_name, c.section as class_section
       FROM students s LEFT JOIN classes c ON c.id = s.class_id
       ORDER BY s.name`
    )
    .all();

  const withSummary = students.map((s) => {
    const summary = computeStudentSummary(s.id);
    return {
      ...s,
      totalFee: summary.totalFee,
      totalPaid: summary.totalPaid,
      totalPending: summary.totalPending,
      isFullyPaid: summary.isFullyPaid,
    };
  });

  res.json(withSummary);
});

// GET /api/students/:id - full detail with fee breakdown
router.get("/:id", (req, res) => {
  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const summary = computeStudentSummary(student.id);
  const payments = db
    .prepare("SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC")
    .all(student.id);

  res.json({ ...student, ...summary, payments });
});

// POST /api/students - create
router.post("/", (req, res) => {
  const { student_code, name, roll_number, class_id, parent_name, parent_phone, parent_email } = req.body;
  if (!student_code || !name) {
    return res.status(400).json({ error: "student_code and name are required" });
  }

  const parent_token = uuidv4().split("-")[0]; // short, unguessable-enough token for a hackathon demo

  try {
    const result = db
      .prepare(
        `INSERT INTO students (student_code, name, roll_number, class_id, parent_name, parent_phone, parent_email, parent_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(student_code, name, roll_number, class_id || null, parent_name, parent_phone, parent_email, parent_token);

    logAudit({ action: "CREATE", entityType: "student", entityId: result.lastInsertRowid, newValue: req.body });
    const student = db.prepare("SELECT * FROM students WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/students/:id - update
router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Student not found" });

  const { name, roll_number, class_id, parent_name, parent_phone, parent_email } = req.body;
  db.prepare(
    `UPDATE students SET name = ?, roll_number = ?, class_id = ?, parent_name = ?, parent_phone = ?, parent_email = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    roll_number ?? existing.roll_number,
    class_id ?? existing.class_id,
    parent_name ?? existing.parent_name,
    parent_phone ?? existing.parent_phone,
    parent_email ?? existing.parent_email,
    req.params.id
  );

  logAudit({ action: "UPDATE", entityType: "student", entityId: req.params.id, oldValue: existing, newValue: req.body });
  const updated = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE /api/students/:id
router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Student not found" });

  db.prepare("DELETE FROM students WHERE id = ?").run(req.params.id);
  logAudit({ action: "DELETE", entityType: "student", entityId: req.params.id, oldValue: existing });
  res.json({ success: true });
});

module.exports = router;
