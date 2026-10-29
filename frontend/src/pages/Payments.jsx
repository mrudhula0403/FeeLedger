import { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { formatINR, formatDate } from "../utils/format";

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ student_id: "", amount: "", payment_method: "UPI" });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.getPayments(), api.getStudents()])
      .then(([p, s]) => {
        setPayments(p);
        setStudents(s);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createPayment({
        student_id: Number(form.student_id),
        amount: Number(form.amount),
        payment_method: form.payment_method,
        source: "MANUAL",
      });
      setForm({ student_id: "", amount: "", payment_method: "UPI" });
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Could not record payment");
    } finally {
      setSaving(false);
    }
  }

  const studentName = (id) => students.find((s) => s.id === id)?.name || `#${id}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Payments</h1>
          <p>The unified ledger — every payment, from every channel, in one place.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Record Payment"}
        </button>
      </div>

      {showForm && (
        <form className="glass-card" style={{ marginBottom: 20 }} onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Student</label>
              <select required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.student_code})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount</label>
              <input required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="5000" />
            </div>
            <div className="field">
              <label>Payment Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            Payment auto-allocates to the student's oldest-due pending fees first.
          </p>
          <button className="btn btn-primary" disabled={saving}>{saving ? "Recording…" : "Record Payment"}</button>
        </form>
      )}

      <div className="glass-card">
        {loading ? (
          <div className="empty-state">Loading payments…</div>
        ) : payments.length === 0 ? (
          <div className="empty-state">No payments recorded yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Source</th>
                  <th>Transaction ID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.payment_date)}</td>
                    <td>{studentName(p.student_id)}</td>
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
