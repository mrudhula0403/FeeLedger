const express = require("express");
const router = express.Router();
const db = require("../db");
const { logAudit } = require("../services/audit");

// GET /api/fee-types
router.get("/", (req, res) => {
  const activeOnly = req.query.active === "true";
  const rows = activeOnly
    ? db.prepare("SELECT * FROM fee_types WHERE is_active = 1 ORDER BY name").all()
    : db.prepare("SELECT * FROM fee_types ORDER BY name").all();
  res.json(rows);
});

// POST /api/fee-types - create ANY custom fee type, no hardcoded categories
router.post("/", (req, res) => {
  const { name, category, description } = req.body;
  if (!name || !category) return res.status(400).json({ error: "name and category are required" });

  const result = db
    .prepare("INSERT INTO fee_types (name, category, description) VALUES (?, ?, ?)")
    .run(name, category, description || null);

  logAudit({ action: "CREATE", entityType: "fee_type", entityId: result.lastInsertRowid, newValue: req.body });
  res.status(201).json(db.prepare("SELECT * FROM fee_types WHERE id = ?").get(result.lastInsertRowid));
});

// PUT /api/fee-types/:id - edit
router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM fee_types WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Fee type not found" });

  const { name, category, description } = req.body;
  db.prepare("UPDATE fee_types SET name = ?, category = ?, description = ? WHERE id = ?").run(
    name ?? existing.name,
    category ?? existing.category,
    description ?? existing.description,
    req.params.id
  );
  logAudit({ action: "UPDATE", entityType: "fee_type", entityId: req.params.id, oldValue: existing, newValue: req.body });
  res.json(db.prepare("SELECT * FROM fee_types WHERE id = ?").get(req.params.id));
});

// DELETE /api/fee-types/:id - soft delete (deactivate), never hard-delete a fee type
// that might already be referenced by fee_assignments
router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM fee_types WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Fee type not found" });

  db.prepare("UPDATE fee_types SET is_active = 0 WHERE id = ?").run(req.params.id);
  logAudit({ action: "DEACTIVATE", entityType: "fee_type", entityId: req.params.id, oldValue: existing });
  res.json({ success: true, message: "Fee type deactivated (soft delete)" });
});

module.exports = router;
