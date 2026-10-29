import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("admin@feeledger.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      const redirectTo = location.state?.from || "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Could not log in. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div className="glass-card" style={{ width: "100%", maxWidth: 380 }}>
        <div className="sidebar-brand" style={{ color: "var(--text-dark)", padding: 0, marginBottom: 22 }}>
          <span className="dot" />
          FeeLedger
        </div>
        <h1 style={{ fontSize: 19, marginBottom: 4 }}>Admin Login</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          Sign in to manage fees, payments, and the OCR reconciliation queue.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@feeledger.demo"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 14 }}>{error}</div>
          )}

          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="muted" style={{ fontSize: 11.5, marginTop: 16, textAlign: "center" }}>
          Use the administrator credentials configured before seeding the backend.
        </p>
      </div>
    </div>
  );
}
