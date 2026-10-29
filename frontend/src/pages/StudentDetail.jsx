import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { formatINR, formatDate } from "../utils/format";

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reminderSent, setReminderSent] = useState(false);

  function load() {
    setLoading(true);
    api.getStudent(id).then(setStudent).finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleRemind() {
    await api.sendReminder(id);
    setReminderSent(true);
    setTimeout(() => setReminderSent(false), 3000);
  }

  if (loading) return <div className="empty-state">Loading student…</div>;
  if (!student) return <div className="empty-state">Student not found.</div>;

  const parentLink = `${window.location.origin}/parent/${student.parent_token}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/students" className="muted" style={{ fontSize: 13 }}>← Back to Students</Link>
          <h1 style={{ marginTop: 6 }}>{student.name}</h1>
          <p>{student.student_code} · Roll {student.roll_number || "-"}</p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(parentLink)}>
            Copy Parent Link
          </button>
          {student.totalPending > 0 && (
            <button className="btn btn-primary" onClick={handleRemind}>
              {reminderSent ? "Reminder Sent ✓" : "Send Reminder"}
            </button>
          )}
        </div>
      </div>

      <div className="grid-cards">
        <div className="glass-card stat-card">
          <div className="label">Total Fee</div>
          <div className="value">{formatINR(student.totalFee)}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="label">Paid</div>
          <div className="value" style={{ color: "var(--success)" }}>{formatINR(student.totalPaid)}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="label">Pending</div>
          <div className="value" style={{ color: student.totalPending > 0 ? "var(--danger)" : "var(--text-muted)" }}>
            {formatINR(student.totalPending)}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Fee Breakdown</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fee</th>
                <th>Base Amount</th>
                <th>Adjustments</th>
                <th>Paid</th>
                <th>Pending</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {student.items?.map((item) => (
                <tr key={item.id}>
                  <td>{item.fee_type_name || `Fee #${item.fee_type_id}`}</td>
                  <td className="mono">{formatINR(item.amount)}</td>
                  <td className="mono">{item.adjustment_delta !== 0 ? formatINR(item.adjustment_delta) : "-"}</td>
                  <td className="mono" style={{ color: "var(--success)" }}>{formatINR(item.paid)}</td>
                  <td className="mono" style={{ color: item.pending > 0 ? "var(--danger)" : "var(--text-muted)" }}>{formatINR(item.pending)}</td>
                  <td>{formatDate(item.due_date)}</td>
                  <td>
                    {item.is_fully_paid ? (
                      <StatusBadge status="SUCCESS" />
                    ) : item.is_overdue ? (
                      <StatusBadge status="HIGH" />
                    ) : (
                      <StatusBadge status="PENDING" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Payment History</h3>
        {student.payments?.length === 0 ? (
          <div className="empty-state">No payments recorded yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Source</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {student.payments?.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.payment_date)}</td>
                    <td className="mono">{formatINR(p.amount)}</td>
                    <td>{p.payment_method}</td>
                    <td className="muted">{p.source}</td>
                    <td className="mono muted">{p.transaction_id}</td>
                    <td><StatusBadge status={p.status} /></td>
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
