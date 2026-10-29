import { useEffect, useState } from "react";
import api from "../api/client";

const CATEGORY_OPTIONS = ["Tuition", "Transport", "Hostel", "Canteen", "Books", "Uniform", "Exam", "Custom"];

export default function FeeTypes() {
  const [feeTypes, setFeeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Custom", description: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.getFeeTypes().then(setFeeTypes).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createFeeType(form);
      setForm({ name: "", category: "Custom", description: "" });
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Could not create fee type");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id) {
    if (!confirm("Deactivate this fee type? Existing assignments are unaffected.")) return;
    await api.deleteFeeType(id);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Fee Types</h1>
          <p>Create any fee category your school needs — nothing is hardcoded.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New Fee Type"}
        </button>
      </div>

      {showForm && (
        <form className="glass-card" style={{ marginBottom: 20 }} onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Fee Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. AI Lab Fee" />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Description (optional)</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short note about this fee" />
            </div>
          </div>
          <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Create Fee Type"}</button>
        </form>
      )}

      <div className="glass-card">
        {loading ? (
          <div className="empty-state">Loading fee types…</div>
        ) : feeTypes.length === 0 ? (
          <div className="empty-state">No fee types yet. Create your first one above.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {feeTypes.map((ft) => (
                  <tr key={ft.id}>
                    <td>{ft.name}</td>
                    <td><span className="badge badge-info">{ft.category}</span></td>
                    <td className="muted">{ft.description || "-"}</td>
                    <td>
                      <span className={`badge ${ft.is_active ? "badge-success" : "badge-neutral"}`}>
                        {ft.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td>
                      {ft.is_active === 1 && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(ft.id)}>Deactivate</button>
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
