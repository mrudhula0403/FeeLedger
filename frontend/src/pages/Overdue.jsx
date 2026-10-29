import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { formatINR, formatDate } from "../utils/format";

export default function Overdue() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState("");
  const [reminded, setReminded] = useState({});

  function load(filters = {}) {
    setLoading(true);
    api.getOverdue(filters).then(setRows).finally(() => setLoading(false));
  }
  useEffect(() => load(), []);

  function handleFilterChange(priority) {
    setPriorityFilter(priority);
    load(priority ? { priority } : {});
  }

  async function handleRemind(studentId, feeAssignmentId) {
    await api.sendReminder(studentId);
    setReminded((prev) => ({ ...prev, [feeAssignmentId]: true }));
    setTimeout(() => setReminded((prev) => ({ ...prev, [feeAssignmentId]: false })), 3000);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Overdue / Pending Fees</h1>
          <p>Every unpaid fee across the school, sorted by how overdue it is.</p>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="flex gap-8">
          <span className="muted" style={{ fontSize: 13 }}>Priority:</span>
          {["", "HIGH", "MEDIUM", "LOW"].map((p) => (
            <button
              key={p || "all"}
              className={`btn btn-sm ${priorityFilter === p ? "btn-primary" : "btn-secondary"}`}
              onClick={() => handleFilterChange(p)}
            >
              {p || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">No pending fees match this filter. 🎉</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Fee</th>
                  <th>Pending</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Priority</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.fee_assignment_id}>
                    <td><Link to={`/students/${r.student_id}`}>{r.student_name}</Link></td>
                    <td>{r.class_name ? `${r.class_name}-${r.section}` : "-"}</td>
                    <td>{r.fee_type_name}</td>
                    <td className="mono" style={{ color: "var(--danger)" }}>{formatINR(r.pending)}</td>
                    <td>{formatDate(r.due_date)}</td>
                    <td>{r.days_overdue > 0 ? `${r.days_overdue} days` : "—"}</td>
                    <td><StatusBadge status={r.priority} /></td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRemind(r.student_id, r.fee_assignment_id)}>
                        {reminded[r.fee_assignment_id] ? "Sent ✓" : "Send Reminder"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
