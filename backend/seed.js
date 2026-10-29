// seed.js - populates the database with realistic demo data for the hackathon presentation.
// Run with: npm run seed

require("dotenv").config();

const ADMIN_EMAIL = "admin@feeledger.demo";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD || Buffer.byteLength(ADMIN_PASSWORD, "utf8") < 16) {
  throw new Error("Set ADMIN_PASSWORD to a random value of at least 16 bytes in backend/.env before seeding.");
}

const db = require("./db");
const { v4: uuidv4 } = require("uuid");

console.log("Seeding FeeLedger database...");

// Wipe existing data (idempotent re-seeding, useful while developing)
const tables = [
  "notifications", "audit_logs", "challan_items", "challans", "ocr_receipts",
  "payment_allocations", "payments", "fee_adjustments", "fee_assignments",
  "fee_types", "students", "classes", "users",
];
for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();

// --- Admin user (password is properly hashed with bcrypt, never stored in plaintext) ---
const bcrypt = require("bcryptjs");
const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')").run(
  "Admin", ADMIN_EMAIL, passwordHash
);

// --- Classes ---
const classInsert = db.prepare("INSERT INTO classes (name, section) VALUES (?, ?)");
const classes = {
  "10-A": classInsert.run("10", "A").lastInsertRowid,
  "10-B": classInsert.run("10", "B").lastInsertRowid,
  "9-A": classInsert.run("9", "A").lastInsertRowid,
  "8-A": classInsert.run("8", "A").lastInsertRowid,
};

// --- Fee types (dynamic fee engine demo) ---
const feeTypeInsert = db.prepare("INSERT INTO fee_types (name, category, description) VALUES (?, ?, ?)");
const feeTypes = {
  tuition: feeTypeInsert.run("Tuition Fee", "Tuition", "Annual academic tuition").lastInsertRowid,
  transport: feeTypeInsert.run("Bus Fee", "Transport", "School transport service").lastInsertRowid,
  hostel: feeTypeInsert.run("Hostel Fee", "Hostel", "Boarding and lodging").lastInsertRowid,
  canteen: feeTypeInsert.run("Canteen Fee", "Canteen", "Meal plan").lastInsertRowid,
  books: feeTypeInsert.run("Books Fee", "Books", "Textbooks and stationery").lastInsertRowid,
  uniform: feeTypeInsert.run("Uniform Fee", "Uniform", "School uniform set").lastInsertRowid,
  exam: feeTypeInsert.run("Examination Fee", "Exam", "Term examination fee").lastInsertRowid,
  ailab: feeTypeInsert.run("AI Lab Fee", "Custom", "Custom fee example - new AI lab equipment").lastInsertRowid,
};

// --- Students ---
const studentInsert = db.prepare(
  `INSERT INTO students (student_code, name, roll_number, class_id, parent_name, parent_phone, parent_email, parent_token)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

const studentDefs = [
  ["STU001", "Rahul Kumar", "10A-01", "10-A", "Suresh Kumar", "9800000001", "suresh.k@example.com"],
  ["STU002", "Priya Sharma", "10A-02", "10-A", "Anita Sharma", "9800000002", "anita.s@example.com"],
  ["STU003", "Arun Raj", "9A-01", "9-A", "Manoj Raj", "9800000003", "manoj.r@example.com"],
  ["STU004", "Meena Devi", "9A-02", "9-A", "Ganesh Devi", "9800000004", "ganesh.d@example.com"],
  ["STU005", "Karthik S", "8A-01", "8-A", "Sathish S", "9800000005", "sathish.s@example.com"],
  ["STU006", "Ananya Iyer", "10B-01", "10-B", "Ravi Iyer", "9800000006", "ravi.i@example.com"],
  ["STU007", "Vikram Singh", "10B-02", "10-B", "Harpreet Singh", "9800000007", "harpreet.s@example.com"],
  ["STU008", "Divya Menon", "9A-03", "9-A", "Rajan Menon", "9800000008", "rajan.m@example.com"],
  ["STU009", "Aditya Nair", "8A-02", "8-A", "Suresh Nair", "9800000009", "suresh.n@example.com"],
  ["STU010", "Sneha Reddy", "10A-03", "10-A", "Kiran Reddy", "9800000010", "kiran.r@example.com"],
];

const studentIds = {};
for (const [code, name, roll, className, parentName, phone, email] of studentDefs) {
  const id = studentInsert
    .run(code, name, roll, classes[className], parentName, phone, email, uuidv4().split("-")[0])
    .lastInsertRowid;
  studentIds[code] = id;
}

// --- Fee assignments: give every student Tuition + Transport, some get extras ---
const assignmentInsert = db.prepare(
  `INSERT INTO fee_assignments (student_id, fee_type_id, academic_year, amount, due_date, billing_period)
   VALUES (?, ?, '2026-27', ?, ?, 'annual')`
);

// Most due dates are set in the NEAR FUTURE relative to today (2026-07-20) so the school's overall
// health score looks realistic for a demo (not everything unpaid = automatically "overdue").
// A small, deliberate subset of students (STU006, STU009) get PAST due dates so the
// overdue dashboard has real entries to demo too.
const assignmentIds = {}; // studentCode -> { category: assignmentId }
for (const [code] of studentDefs) {
  const sid = studentIds[code];
  const isOverdueDemo = code === "STU006" || code === "STU009";
  const tuitionDue = isOverdueDemo ? "2026-06-10" : "2026-08-30";
  const transportDue = isOverdueDemo ? "2026-06-10" : "2026-08-30";
  const booksDue = "2026-07-10"; // small amount, slightly past due for everyone - realistic detail

  assignmentIds[code] = {};
  assignmentIds[code].tuition = assignmentInsert.run(sid, feeTypes.tuition, 50000, tuitionDue).lastInsertRowid;
  assignmentIds[code].transport = assignmentInsert.run(sid, feeTypes.transport, 20000, transportDue).lastInsertRowid;
  assignmentIds[code].books = assignmentInsert.run(sid, feeTypes.books, 3000, booksDue).lastInsertRowid;
}
// A couple of students also have hostel + AI lab fee, to show off the dynamic fee engine
assignmentIds["STU003"].hostel = assignmentInsert.run(studentIds["STU003"], feeTypes.hostel, 60000, "2026-09-01").lastInsertRowid;
assignmentIds["STU007"].ailab = assignmentInsert.run(studentIds["STU007"], feeTypes.ailab, 2000, "2026-09-15").lastInsertRowid;

// --- Adjustments: a scholarship and a late fee, to demo the calculation engine ---
db.prepare("INSERT INTO fee_adjustments (fee_assignment_id, type, amount, reason) VALUES (?, 'SCHOLARSHIP', ?, ?)").run(
  assignmentIds["STU004"].tuition, 5000, "Merit scholarship - Term 1"
);
db.prepare("INSERT INTO fee_adjustments (fee_assignment_id, type, amount, reason) VALUES (?, 'LATE_FEE', ?, ?)").run(
  assignmentIds["STU005"].tuition, 500, "Payment received after due date"
);

// --- Payments: mix of fully paid / partially paid / pending / overdue students ---
function addPayment(studentCode, amount, method, source, allocations, status = "SUCCESS", daysAgo = 5) {
  const sid = studentIds[studentCode];
  const txn = "TXN-" + uuidv4().split("-")[0].toUpperCase();
  const paymentDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const result = db
    .prepare(
      `INSERT INTO payments (student_id, amount, payment_method, source, status, payment_date, transaction_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(sid, amount, method, source, status, paymentDate, txn);
  const paymentId = result.lastInsertRowid;
  for (const alloc of allocations) {
    db.prepare("INSERT INTO payment_allocations (payment_id, fee_assignment_id, allocated_amount) VALUES (?, ?, ?)").run(
      paymentId, alloc.fee_assignment_id, alloc.allocated_amount
    );
  }
  return paymentId;
}

// STU002 Priya - fully paid (tuition + transport + books)
addPayment("STU002", 50000, "UPI", "ONLINE_GATEWAY", [{ fee_assignment_id: assignmentIds.STU002.tuition, allocated_amount: 50000 }], "SUCCESS", 20);
addPayment("STU002", 20000, "UPI", "ONLINE_GATEWAY", [{ fee_assignment_id: assignmentIds.STU002.transport, allocated_amount: 20000 }], "SUCCESS", 20);
addPayment("STU002", 3000, "CASH", "MANUAL", [{ fee_assignment_id: assignmentIds.STU002.books, allocated_amount: 3000 }], "SUCCESS", 20);

// STU001 Rahul - partially paid (tuition paid, transport pending - THIS IS THE OCR DEMO STUDENT, keep transport pending!)
addPayment("STU001", 50000, "UPI", "ONLINE_GATEWAY", [{ fee_assignment_id: assignmentIds.STU001.tuition, allocated_amount: 50000 }], "SUCCESS", 15);
// Note: STU001 transport fee (20,000) is intentionally left PENDING for the live OCR demo

// STU003 Arun - partially paid, has hostel fee too
addPayment("STU003", 8000, "CASH", "MANUAL", [{ fee_assignment_id: assignmentIds.STU003.tuition, allocated_amount: 8000 }], "SUCCESS", 10);

// STU006 - deliberately overdue demo student: no payments at all, past due dates (shows up prominently on overdue dashboard)
// STU009 - same, partially paid to show a MEDIUM/HIGH priority mix rather than every overdue student looking identical
addPayment("STU009", 20000, "UPI", "ONLINE_GATEWAY", [{ fee_assignment_id: assignmentIds.STU009.transport, allocated_amount: 20000 }], "SUCCESS", 25);

// STU007 Vikram, STU010 Sneha - fully paid tuition + transport (future due dates, healthy payers)
addPayment("STU007", 50000, "UPI", "ONLINE_GATEWAY", [{ fee_assignment_id: assignmentIds.STU007.tuition, allocated_amount: 50000 }], "SUCCESS", 12);
addPayment("STU007", 20000, "UPI", "ONLINE_GATEWAY", [{ fee_assignment_id: assignmentIds.STU007.transport, allocated_amount: 20000 }], "SUCCESS", 12);
addPayment("STU010", 50000, "CASH", "MANUAL", [{ fee_assignment_id: assignmentIds.STU010.tuition, allocated_amount: 50000 }], "SUCCESS", 6);
addPayment("STU010", 20000, "CASH", "MANUAL", [{ fee_assignment_id: assignmentIds.STU010.transport, allocated_amount: 20000 }], "SUCCESS", 6);

// STU008 Divya - fully paid tuition, transport still pending (future due date, not overdue - just a normal in-progress payer)
addPayment("STU008", 50000, "UPI", "ONLINE_GATEWAY", [{ fee_assignment_id: assignmentIds.STU008.tuition, allocated_amount: 50000 }], "SUCCESS", 9);

// STU004 Meena - fully paid tuition after scholarship (45,000 payable)
addPayment("STU004", 45000, "BANK_TRANSFER", "MANUAL", [{ fee_assignment_id: assignmentIds.STU004.tuition, allocated_amount: 45000 }], "SUCCESS", 8);

// STU005 Karthik - cheque payment pending clearance (demo the cheque workflow)
const chequePaymentId = db
  .prepare(
    `INSERT INTO payments (student_id, amount, payment_method, source, status, payment_date, cheque_bank_name, cheque_number, cheque_clearance_date, transaction_id)
     VALUES (?, ?, 'CHEQUE', 'MANUAL', 'PENDING_VERIFICATION', CURRENT_TIMESTAMP, ?, ?, ?, ?)`
  )
  .run(studentIds["STU005"], 20000, "State Bank of India", "CHQ-449281", "2026-07-25", "TXN-" + uuidv4().split("-")[0].toUpperCase())
  .lastInsertRowid;
db.prepare("INSERT INTO payment_allocations (payment_id, fee_assignment_id, allocated_amount) VALUES (?, ?, ?)").run(
  chequePaymentId, assignmentIds.STU005.transport, 20000
);

console.log(`Seeded ${studentDefs.length} students, ${Object.keys(feeTypes).length} fee types, and demo payments.`);
console.log("Demo students available for OCR upload: STU001 (Rahul Kumar, roll 10A-01) has a PENDING transport fee of Rs 20,000 - use this as the live OCR demo.");
console.log(`Admin login email: ${ADMIN_EMAIL}. The configured password is stored in backend/.env.`);
console.log("Seed complete.");
