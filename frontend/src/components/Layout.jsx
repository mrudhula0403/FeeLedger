import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../api/AuthContext";

const links = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/students", label: "Students" },
  { to: "/fee-types", label: "Fee Types" },
  { to: "/ocr", label: "OCR Receipts" },
  { to: "/payments", label: "Payments" },
  { to: "/challans", label: "Challans" },
  { to: "/overdue", label: "Overdue / Pending" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="dot" />
          FeeLedger
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}
          >
            {l.label}
          </NavLink>
        ))}

        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {user && (
            <div style={{ padding: "6px 12px", fontSize: 12.5, color: "rgba(244,246,251,0.6)" }}>
              Signed in as <strong style={{ color: "#f4f6fb" }}>{user.name}</strong>
            </div>
          )}
          <button
            onClick={logout}
            className="nav-link"
            style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
          >
            Log Out
          </button>
        </div>
      </aside>
      <main className="main-area">
        <Outlet />
      </main>
    </div>
  );
}
