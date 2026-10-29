import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./api/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import FeeTypes from "./pages/FeeTypes";
import OcrUpload from "./pages/OcrUpload";
import Payments from "./pages/Payments";
import Challans from "./pages/Challans";
import Overdue from "./pages/Overdue";
import ParentView from "./pages/ParentView";

function ProtectedRoute({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return <div className="empty-state" style={{ paddingTop: 100 }}>Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Parent view is a standalone, no-login page - not nested inside the admin sidebar layout */}
          <Route path="/parent/:token" element={<ParentView />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/fee-types" element={<FeeTypes />} />
            <Route path="/ocr" element={<OcrUpload />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/challans" element={<Challans />} />
            <Route path="/overdue" element={<Overdue />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
