import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("feeledger_token");
    if (!token) {
      setChecking(false);
      return;
    }
    api
      .getCurrentUser()
      .then((res) => setUser(res.user))
      .catch(() => {
        localStorage.removeItem("feeledger_token");
        localStorage.removeItem("feeledger_user");
      })
      .finally(() => setChecking(false));
  }, []);

  async function login(email, password) {
    const res = await api.login(email, password);
    localStorage.setItem("feeledger_token", res.token);
    localStorage.setItem("feeledger_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }

  function logout() {
    localStorage.removeItem("feeledger_token");
    localStorage.removeItem("feeledger_user");
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ user, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
