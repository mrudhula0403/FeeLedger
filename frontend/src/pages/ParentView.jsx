import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { formatINR, formatDate } from "../utils/format";

export default function ParentView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getParentView(token)
      .then(setData)
      .catch(() => setError("This link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="empty-state" style={{ paddingTop: 80 }}>Loading…</div>;
  if (error) return <div className="empty-state" style={{ paddingTop: 80 }}>{error}</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <div className="sidebar-brand" style={{ color: "var(--text-dark)", padding: 0, marginBottom: 24 }}>
        <span className="dot" />
        FeeLedger
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20 }}>{data.student.name}</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {data.student.student_code} {data.student.class ? `· Class ${data.student.class}` : ""}
        </p>

        <div className="grid-cards" style={{ marginTop: 18, marginBottom: 0 }}>
          <div className="stat-card">
            <div className="label">Total Fee</div>
            <div className="value">{formatINR(data.totalFee)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Paid</div>
            <div className="value" style={{ color: "var(--success)" }}>{formatINR(data.totalPaid)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Pending</div>
            <div className="value" style={{ color: data.totalPending > 0 ? "var(--danger)" : "var(--text-muted)" }}>
              {formatINR(data.totalPending)}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Category Breakdown</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.categoryBreakdown).map(([cat, v]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td className="mono">{formatINR(v.total)}</td>
                  <td className="mono" style={{ color: "var(--success)" }}>{formatINR(v.paid)}</td>
                  <td className="mono" style={{ color: v.pending > 0 ? "var(--danger)" : "var(--text-muted)" }}>{formatINR(v.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Payment History</h3>
        {data.paymentHistory.length === 0 ? (
          <div className="empty-state">No payments yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.paymentHistory.map((p, i) => (
                  <tr key={i}>
                    <td>{formatDate(p.payment_date)}</td>
                    <td className="mono">{formatINR(p.amount)}</td>
                    <td>{p.payment_method}</td>
                    <td className="mono muted">{p.transaction_id}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 24 }}>
        This is a read-only view. Contact the school office for any corrections.
      </p>
    </div>
  );
}
