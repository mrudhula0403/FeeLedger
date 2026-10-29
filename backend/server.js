require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

// SAFETY NET: some dependencies (notably Tesseract.js, when it can't reach its
// language-data CDN) throw errors in a way that bypasses normal try/catch and would
// otherwise crash the entire Node process, taking the whole site down over one bad
// request. These handlers log the problem and keep the server alive so every OTHER
// request keeps working. The failing request itself still correctly falls back to
// mock OCR (see services/ocrService.js) - this is a second, independent layer of
// protection on top of that, not a replacement for it.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Server stayed up. Error was:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Server stayed up. Reason was:", reason);
});

const { router: authRouter } = require("./routes/auth");
const { requireAuth } = require("./middleware/auth");
const studentsRouter = require("./routes/students");
const feeTypesRouter = require("./routes/feeTypes");
const feeAssignmentsRouter = require("./routes/feeAssignments");
const paymentsRouter = require("./routes/payments");
const ocrRouter = require("./routes/ocr");
const challansRouter = require("./routes/challans");
const dashboardRouter = require("./routes/dashboard");
const parentRouter = require("./routes/parent");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "data", "uploads")));

// Health check - public, no auth (used by hosting platforms to check the service is alive)
app.get("/api/health", (req, res) => res.json({ status: "ok", mode: process.env.OCR_MODE || "real" }));

// Auth - public (you can't require a login to get a login)
app.use("/api/auth", authRouter);

// Parent view - public, protected by an unguessable token in the URL instead of a login
app.use("/api/parent", parentRouter);

// Everything below this line is admin-only and requires a valid login token
app.use("/api", requireAuth);

// Main resource routers
app.use("/api/students", studentsRouter);
app.use("/api/fee-types", feeTypesRouter);
app.use("/api/fee-assignments", feeAssignmentsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/ocr", ocrRouter);
app.use("/api/challans", challansRouter);
app.use("/api/dashboard", dashboardRouter);

// Convenience routes referenced in the spec that live logically under /students/:id/...
app.get("/api/students/:id/fees", (req, res) => {
  res.json(feeAssignmentsRouter.getStudentFees(req.params.id));
});
app.get("/api/students/:id/payments", (req, res) => {
  res.json(paymentsRouter.getStudentPayments(req.params.id));
});
// fee-assignments/:id/adjustments is handled inside feeAssignmentsRouter already

// Reminder/notification route - "Send Reminder" button on the overdue dashboard hits this
app.post("/api/notifications/:studentId", (req, res, next) => {
  req.url = `/notify/${req.params.studentId}`;
  parentRouter.handle(req, res, next);
});

app.listen(PORT, () => {
  console.log(`FeeLedger backend running on http://localhost:${PORT}`);
  console.log(`OCR mode: ${process.env.OCR_MODE || "real (Tesseract.js)"}`);
});
