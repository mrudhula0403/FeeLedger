import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../api/client";
import HealthGauge from "../components/HealthGauge";
import { formatINR } from "../utils/format";

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDashboardSummary(), api.getCategoryBreakdown()])
      .then(([s, b]) => {
        setSummary(s);
        setBreakdown(b);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">Loading dashboard…</div>;
  if (!summary) return <div className="empty-state">Could not load dashboard data.</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Real-time overview of school-wide fee collection.</p>
        </div>
      </div>

      <div className="two-col" style={{ marginBottom: 22 }}>
        <div className="glass-card">
          <HealthGauge score={summary.healthScore} label={summary.healthLabel} />
        </div>
        <div className="glass-card">
          <div className="stat-card label" style={{ marginBottom: 10 }}>Collection Snapshot</div>
          <div className="grid-cards" style={{ marginBottom: 0, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <div className="label muted">Expected</div>
              <div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>{formatINR(summary.totalExpected)}</div>
            </div>
            <div>
              <div className="label muted">Collected</div>
              <div className="mono" style={{ fontSize: 19, fontWeight: 600, color: "var(--success)" }}>{formatINR(summary.totalCollected)}</div>
            </div>
            <div>
              <div className="label muted">Pending</div>
              <div className="mono" style={{ fontSize: 19, fontWeight: 600, color: "var(--amber)" }}>{formatINR(summary.totalPending)}</div>
            </div>
            <div>
              <div className="label muted">Overdue</div>
              <div className="mono" style={{ fontSize: 19, fontWeight: 600, color: "var(--danger)" }}>{formatINR(summary.overdueAmount)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-cards">
        <div className="glass-card stat-card">
          <div className="label">Students with Pending Fees</div>
          <div className="value">{summary.studentsWithPendingFees} / {summary.totalStudents}</div>
          <div className="sub">across all classes</div>
        </div>
        <div className="glass-card stat-card">
          <div className="label">Total Students</div>
          <div className="value">{summary.totalStudents}</div>
          <div className="sub">enrolled this academic year</div>
        </div>
        <div className="glass-card stat-card">
          <div className="label">Collection Rate</div>
          <div className="value">{summary.totalExpected > 0 ? Math.round((summary.totalCollected / summary.totalExpected) * 100) : 0}%</div>
          <div className="sub">of total expected fees</div>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: 22 }}>
        <div className="flex-between" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 15 }}>Collection by Fee Category</h3>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={breakdown} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,26,51,0.06)" />
            <XAxis dataKey="category" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => formatINR(v)} contentStyle={{ borderRadius: 10, fontSize: 12.5 }} />
            <Bar dataKey="collected" stackId="a" fill="#14b8a6" radius={[0, 0, 0, 0]} name="Collected" />
            <Bar dataKey="pending" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Pending" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Fee Category Breakdown</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Expected</th>
                <th>Collected</th>
                <th>Pending</th>
                <th>Collection %</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row) => (
                <tr key={row.category + row.feeTypeName}>
                  <td>{row.feeTypeName}</td>
                  <td className="mono">{formatINR(row.expected)}</td>
                  <td className="mono" style={{ color: "var(--success)" }}>{formatINR(row.collected)}</td>
                  <td className="mono" style={{ color: "var(--amber)" }}>{formatINR(row.pending)}</td>
                  <td>{row.collectionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
