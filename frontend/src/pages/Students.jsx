import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { formatINR } from "../utils/format";

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ student_code: "", name: "", roll_number: "", parent_name: "", parent_phone: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.getStudents().then(setStudents).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createStudent(form);
      setForm({ student_code: "", name: "", roll_number: "", parent_name: "", parent_phone: "" });
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Could not add student");
    } finally {
      setSaving(false);
    }
  }

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Students</h1>
          <p>{students.length} students enrolled.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add Student"}
        </button>
      </div>

      {showForm && (
        <form className="glass-card" style={{ marginBottom: 20 }} onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Student Code</label>
              <input required value={form.student_code} onChange={(e) => setForm({ ...form, student_code: e.target.value })} placeholder="STU011" />
            </div>
            <div className="field">
              <label>Full Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Student name" />
            </div>
            <div className="field">
              <label>Roll Number</label>
              <input value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value })} placeholder="10A-11" />
            </div>
            <div className="field">
              <label>Parent Name</label>
              <input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Parent Phone</label>
              <input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Student"}</button>
        </form>
      )}

      <div className="glass-card">
        <input
          placeholder="Search by name or student code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 14, maxWidth: 320 }}
        />

        {loading ? (
          <div className="empty-state">Loading students…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No students found.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Code</th>
                  <th>Class</th>
                  <th>Total Fee</th>
                  <th>Paid</th>
                  <th>Pending</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="mono muted">{s.student_code}</td>
                    <td>{s.class_name ? `${s.class_name}-${s.class_section}` : "-"}</td>
                    <td className="mono">{formatINR(s.totalFee)}</td>
                    <td className="mono" style={{ color: "var(--success)" }}>{formatINR(s.totalPaid)}</td>
                    <td className="mono" style={{ color: s.totalPending > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                      {formatINR(s.totalPending)}
                    </td>
                    <td>
                      <Link to={`/students/${s.id}`} className="btn btn-secondary btn-sm">View</Link>
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
