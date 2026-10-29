import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const client = axios.create({ baseURL: API_BASE });

// Attach the JWT (if we have one) to every outgoing request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("feeledger_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is missing/expired, the backend returns 401 - bounce to login
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith("/parent/")) {
      localStorage.removeItem("feeledger_token");
      localStorage.removeItem("feeledger_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Auth
  login: (email, password) => client.post("/auth/login", { email, password }).then((r) => r.data),
  getCurrentUser: () => client.get("/auth/me").then((r) => r.data),

  // Students
  getStudents: () => client.get("/students").then((r) => r.data),
  getStudent: (id) => client.get(`/students/${id}`).then((r) => r.data),
  createStudent: (data) => client.post("/students", data).then((r) => r.data),
  updateStudent: (id, data) => client.put(`/students/${id}`, data).then((r) => r.data),
  deleteStudent: (id) => client.delete(`/students/${id}`).then((r) => r.data),

  // Fee types
  getFeeTypes: () => client.get("/fee-types").then((r) => r.data),
  createFeeType: (data) => client.post("/fee-types", data).then((r) => r.data),
  deleteFeeType: (id) => client.delete(`/fee-types/${id}`).then((r) => r.data),

  // Fee assignments
  getFeeAssignments: () => client.get("/fee-assignments").then((r) => r.data),
  createFeeAssignment: (data) => client.post("/fee-assignments", data).then((r) => r.data),
  createAdjustment: (data) => client.post("/fee-assignments/adjustments", data).then((r) => r.data),

  // Payments
  getPayments: () => client.get("/payments").then((r) => r.data),
  createPayment: (data) => client.post("/payments", data).then((r) => r.data),

  // OCR
  uploadReceipt: (file) => {
    const formData = new FormData();
    formData.append("receipt", file);
    return client
      .post("/ocr/receipts", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  getReceipts: (status) => client.get("/ocr/receipts", { params: status ? { status } : {} }).then((r) => r.data),
  confirmReceipt: (id, overrides = {}) => client.post(`/ocr/receipts/${id}/confirm`, overrides).then((r) => r.data),
  rejectReceipt: (id) => client.post(`/ocr/receipts/${id}/reject`).then((r) => r.data),
  updateReceipt: (id, data) => client.put(`/ocr/receipts/${id}`, data).then((r) => r.data),

  // Challans
  getChallans: () => client.get("/challans").then((r) => r.data),
  createChallan: (data) => client.post("/challans", data).then((r) => r.data),
  payChallan: (id) => client.post(`/challans/${id}/pay`).then((r) => r.data),

  // Dashboard
  getDashboardSummary: () => client.get("/dashboard/summary").then((r) => r.data),
  getHealthScore: () => client.get("/dashboard/health-score").then((r) => r.data),
  getCategoryBreakdown: () => client.get("/dashboard/category-breakdown").then((r) => r.data),
  getOverdue: (filters = {}) => client.get("/dashboard/overdue", { params: filters }).then((r) => r.data),

  // Parent
  getParentView: (token) => client.get(`/parent/${token}`).then((r) => r.data),
  sendReminder: (studentId, message) => client.post(`/notifications/${studentId}`, { message }).then((r) => r.data),
};

export default api;
