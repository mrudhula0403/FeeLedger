// services/audit.js
// Small helper so every important write logs an audit trail entry.

const db = require("../db");

function logAudit({ action, entityType, entityId, oldValue = null, newValue = null, userName = "admin" }) {
  db.prepare(
    `INSERT INTO audit_logs (user_name, action, entity_type, entity_id, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    userName,
    action,
    entityType,
    entityId,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null
  );
}

module.exports = { logAudit };
