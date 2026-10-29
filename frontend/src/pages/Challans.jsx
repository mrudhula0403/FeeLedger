import { useEffect, useState } from "react";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import { formatINR, formatDate } from "../utils/format";

export default function Challans() {
  const [challans, setChallans] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [studentDetail, setStudentDetail] = useState(null);
  const [selectedFees, setSelectedFees] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.getChallans(), api.getStudents()])
      .then(([c, s]) => {
        setChallans(c);
        setStudents(s);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  useEffect(() => {
    if (!selectedStudent) {
      setStudentDetail(null);
      return;
    }
    api.getStudent(selectedStudent).then(setStudentDetail);
  }, [selectedStudent]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (selectedFees.length === 0) return alert("Select at least one pending fee.");
    setSaving(true);
    try {
      await api.createChallan({ student_id: Number(selectedStudent), fee_assignment_ids: selectedFees, due_date: dueDate || null });
      setShowForm(false);
      setSelectedStudent("");
      setSelectedFees([]);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Could not create challan");
    } finally {
      setSaving(false);
    }
  }

  async function handlePay(id) {
    setPayingId(id);
    // Simulate PENDING -> PROCESSING -> SUCCESS visually before the API resolves
    await new Promise((r) => setTimeout(r, 900));
    try {
      await api.payChallan(id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Payment failed");
    } finally {
      setPayingId(null);
    }
  }

  const studentName = (id) => students.find((s) => s.id === id)?.name || `#${id}`;
  const pendingItems = (studentDetail?.items || []).filter((i) => i.pending > 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Challans</h1>
          <p>Generate an online challan for pending fees; parents pay it via the mock gateway.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Generate Challan"}
        </button>
      </div>

      {showForm && (
        <form className="glass-card" style={{ marginBottom: 20 }} onSubmit={handleSubmit}>
          <div className="field">
            <label>Student</label>
            <select required value={selectedStudent} onChange={(e) => { setSelectedStudent(e.target.value); setSelectedFees([]); }}>
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.student_code})</option>
              ))}
            </select>
          </div>

          {studentDetail && (
            <div className="field">
              <label>Pending Fees to Include</label>
              {pendingItems.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>This student has no pending fees.</div>
              ) : (
                pendingItems.map((item) => (
                  <label key={item.id} className="flex gap-8" style={{ fontWeight: 400, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      style={{ width: "auto" }}
                      checked={selectedFees.includes(item.id)}
                      onChange={(e) => {
                        setSelectedFees((prev) =>
                          e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                        );
                      }}
                    />
                    Fee assignment #{item.id} — {formatINR(item.pending)} pending
                  </label>
                ))
              )}
            </div>
          )}

          <div className="field">
            <label>Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <button className="btn btn-primary" disabled={saving}>{saving ? "Generating…" : "Generate Challan"}</button>
        </form>
      )}

      <div className="glass-card">
        {loading ? (
          <div className="empty-state">Loading challans…</div>
        ) : challans.length === 0 ? (
          <div className="empty-state">No challans generated yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Challan #</th>
                  <th>Student</th>
                  <th>Total</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {challans.map((c) => (
                  <tr key={c.id}>
                    <td className="mono">{c.challan_number}</td>
                    <td>{studentName(c.student_id)}</td>
                    <td className="mono">{formatINR(c.total_amount)}</td>
                    <td>{formatDate(c.due_date)}</td>
                    <td><StatusBadge status={payingId === c.id ? "PROCESSING" : c.status} /></td>
                    <td>
                      {c.status !== "PAID" && (
                        <button className="btn btn-primary btn-sm" disabled={payingId === c.id} onClick={() => handlePay(c.id)}>
                          {payingId === c.id ? "Processing…" : "Pay Now"}
                        </button>
                      )}
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
