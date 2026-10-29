import { useEffect, useState } from "react";
import api from "../api/client";
import { formatINR, formatDate } from "../utils/format";

export default function OcrUpload() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [current, setCurrent] = useState(null); // the just-uploaded receipt + match result
  const [confirmResult, setConfirmResult] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [editAmount, setEditAmount] = useState("");

  function loadQueue() {
    setLoadingQueue(true);
    api.getReceipts("PENDING_REVIEW").then(setQueue).finally(() => setLoadingQueue(false));
  }
  useEffect(loadQueue, []);

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setCurrent(null);
    setConfirmResult(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadReceipt(file);
      setCurrent(result);
      setEditAmount(result.extracted_amount || "");
      loadQueue();
    } catch (err) {
      alert(err.response?.data?.error || "OCR upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!current) return;
    try {
      const result = await api.confirmReceipt(current.id, { amount: Number(editAmount) });
      setConfirmResult(result);
      setCurrent(null);
      setFile(null);
      setPreviewUrl(null);
      loadQueue();
    } catch (err) {
      alert(err.response?.data?.error || "Could not confirm payment");
    }
  }

  async function handleReject() {
    if (!current) return;
    await api.rejectReceipt(current.id);
    setCurrent(null);
    setFile(null);
    setPreviewUrl(null);
    loadQueue();
  }

  async function openFromQueue(receipt) {
    setCurrent({
      ...receipt,
      confidenceLevel: receipt.confidence_score >= 90 ? "HIGH" : receipt.confidence_score >= 70 ? "MEDIUM" : "LOW",
    });
    setEditAmount(receipt.extracted_amount || "");
    setFile(null);
    setPreviewUrl(null);
    setConfirmResult(null);
  }

  const confidenceBadge = (level) =>
    level === "HIGH" ? "badge-success" : level === "MEDIUM" ? "badge-warning" : "badge-danger";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>OCR Receipt Upload</h1>
          <p>Upload a paper receipt photo — FeeLedger extracts the details, matches the student, and updates the ledger once you confirm.</p>
        </div>
      </div>

      {confirmResult && (
        <div className="glass-card" style={{ marginBottom: 20, borderLeft: "4px solid var(--success)" }}>
          <div className="flex-between">
            <div>
              <div style={{ fontWeight: 700, color: "var(--success)", marginBottom: 4 }}>
                ✓ Payment successfully added to the ledger
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                Previous pending: <span className="mono">{formatINR(confirmResult.before?.pending)}</span> → New pending:{" "}
                <span className="mono" style={{ color: "var(--success)" }}>{formatINR(confirmResult.after?.pending)}</span>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmResult(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {!current && (
        <div className="glass-card" style={{ marginBottom: 20 }}>
          <div className="field">
            <label>Receipt Image</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          {previewUrl && (
            <img src={previewUrl} alt="Receipt preview" style={{ maxWidth: 260, borderRadius: 10, marginBottom: 14, display: "block" }} />
          )}
          <button className="btn btn-primary" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? "Running OCR…" : "Upload & Extract"}
          </button>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Demo tip: name your file with "rahul", "priya", or "unclear" to see different mock OCR outcomes (high confidence, high confidence, and low confidence/manual review respectively).
          </p>
        </div>
      )}

      {current && (
        <div className="glass-card" style={{ marginBottom: 20 }}>
          <div className="two-col">
            <div>
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>Receipt Image</h3>
              {previewUrl ? (
                <img src={previewUrl} alt="Receipt" style={{ maxWidth: "100%", borderRadius: 10 }} />
              ) : (
                <div className="empty-state" style={{ background: "rgba(16,26,51,0.03)", borderRadius: 10 }}>
                  (Loaded from queue — original image on file)
                </div>
              )}
              <div className="mono muted" style={{ fontSize: 11.5, marginTop: 10, whiteSpace: "pre-wrap", background: "rgba(16,26,51,0.04)", padding: 10, borderRadius: 8 }}>
                {current.raw_text}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>Extracted Data</h3>
              <div className="field">
                <label>Student</label>
                <div>{current.extracted_student_name || current.matchedStudent?.name || "—"}</div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Fee Category</label>
                  <div>{current.extracted_fee_category || "—"}</div>
                </div>
                <div className="field">
                  <label>Date</label>
                  <div>{formatDate(current.extracted_date)}</div>
                </div>
              </div>
              <div className="field">
                <label>Amount</label>
                <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>

              <div className="glass-card" style={{ background: "rgba(16,26,51,0.03)", padding: 14, marginBottom: 16 }}>
                <div className="flex-between">
                  <span className="muted" style={{ fontSize: 12.5 }}>Match Result</span>
                  <span className={`badge ${confidenceBadge(current.confidenceLevel)}`}>
                    {current.confidence_score}% confidence — {current.confidenceLevel}
                  </span>
                </div>
                {(current.matchedStudent || current.matched_student_id) ? (
                  <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600 }}>
                    Matched: {current.matchedStudent?.name || `Student #${current.matched_student_id}`}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--danger)" }}>
                    No confident match found — this needs manual review.
                  </div>
                )}
                {current.matchedFeeAssignment && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    Current pending on this fee: {formatINR(current.matchedFeeAssignment.pending)}
                  </div>
                )}
              </div>

              <div className="flex gap-8">
                <button className="btn btn-primary" onClick={handleConfirm}>Confirm Payment</button>
                <button className="btn btn-danger" onClick={handleReject}>Reject</button>
                <button className="btn btn-secondary" onClick={() => { setCurrent(null); setFile(null); setPreviewUrl(null); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card">
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 15 }}>Needs Review Queue</h3>
          <span className="muted" style={{ fontSize: 12.5 }}>{queue.length} pending</span>
        </div>
        {loadingQueue ? (
          <div className="empty-state">Loading queue…</div>
        ) : queue.length === 0 ? (
          <div className="empty-state">Queue is empty — all receipts processed.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Extracted Name</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Confidence</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => (
                  <tr key={r.id}>
                    <td>{r.extracted_student_name || "—"}</td>
                    <td className="mono">{formatINR(r.extracted_amount)}</td>
                    <td>{r.extracted_fee_category || "—"}</td>
                    <td>
                      <span className={`badge ${confidenceBadge(r.confidence_score >= 90 ? "HIGH" : r.confidence_score >= 70 ? "MEDIUM" : "LOW")}`}>
                        {r.confidence_score}%
                      </span>
                    </td>
                    <td className="muted">{formatDate(r.created_at)}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openFromQueue(r)}>Review</button>
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
