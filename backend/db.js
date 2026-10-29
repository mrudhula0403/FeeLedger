// db.js
// Sets up the SQLite database and creates all tables if they don't exist.
//
// Uses Node's BUILT-IN node:sqlite module (available Node 22.5+) instead of the
// better-sqlite3 npm package. Why: better-sqlite3 needs to compile native C++ code
// during npm install, which requires Visual Studio Build Tools on Windows (a multi-GB
// download most people don't have). node:sqlite ships inside Node itself - zero install,
// zero compilation, works identically out of the box on Windows/Mac/Linux.
// Requires Node.js 22.5 or newer (check with `node -v`).

const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const dbPath = path.join(__dirname, "data", "feeledger.db");
const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', -- admin | parent
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,        -- e.g. "10"
  section TEXT NOT NULL      -- e.g. "A"
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code TEXT UNIQUE NOT NULL,   -- e.g. STU001 (human-friendly ID used for matching)
  name TEXT NOT NULL,
  roll_number TEXT,
  class_id INTEGER REFERENCES classes(id),
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  parent_token TEXT UNIQUE NOT NULL,   -- used for the no-login parent view link
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Dynamic fee engine: admin can create ANY fee type, not hardcoded categories
CREATE TABLE IF NOT EXISTS fee_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,             -- e.g. "Tuition Fee", "AI Lab Fee"
  category TEXT NOT NULL,         -- e.g. "Tuition" | "Transport" | "Hostel" | "Custom" ...
  description TEXT,
  is_active INTEGER DEFAULT 1,    -- 1 = active, 0 = deactivated (soft delete)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- A fee assigned to a specific student (an "invoice line")
CREATE TABLE IF NOT EXISTS fee_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  fee_type_id INTEGER NOT NULL REFERENCES fee_types(id),
  academic_year TEXT NOT NULL DEFAULT '2026-27',
  amount REAL NOT NULL,            -- base amount, BEFORE adjustments
  due_date TEXT,
  billing_period TEXT DEFAULT 'annual', -- annual | term | monthly
  status TEXT DEFAULT 'active',    -- active | cancelled
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Adjustments (waivers, scholarships, penalties, late fees) - never overwrite base amount
CREATE TABLE IF NOT EXISTS fee_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fee_assignment_id INTEGER NOT NULL REFERENCES fee_assignments(id),
  type TEXT NOT NULL,   -- WAIVER | SCHOLARSHIP | DISCOUNT | LATE_FEE | PENALTY | REFUND | OTHER
  amount REAL NOT NULL, -- positive number; sign is interpreted by type (waivers/scholarships subtract, penalties add)
  reason TEXT,
  created_by TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- THE UNIFIED LEDGER. Every payment, regardless of method, becomes a row here.
-- paid_amount is NEVER stored directly on a student/fee - it is always computed
-- as the sum of SUCCESS payments allocated to that fee assignment.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL,     -- UPI | CASH | CHEQUE | BANK_TRANSFER | ONLINE_CHALLAN
  source TEXT NOT NULL,             -- MANUAL | OCR_RECEIPT | ONLINE_GATEWAY | CHALLAN
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | PROCESSING | SUCCESS | FAILED | PENDING_VERIFICATION | CLEARED | BOUNCED | REFUNDED | CANCELLED
  payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
  reference_number TEXT,
  transaction_id TEXT UNIQUE,
  receipt_number TEXT,
  cheque_bank_name TEXT,
  cheque_number TEXT,
  cheque_clearance_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Which fee assignment(s) a payment was allocated to (supports split payments)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL REFERENCES payments(id),
  fee_assignment_id INTEGER NOT NULL REFERENCES fee_assignments(id),
  allocated_amount REAL NOT NULL
);

-- Every OCR receipt upload, whether auto-matched or needing manual review
CREATE TABLE IF NOT EXISTS ocr_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_filename TEXT,
  raw_text TEXT,
  extracted_student_name TEXT,
  extracted_student_code TEXT,
  extracted_roll_number TEXT,
  extracted_amount REAL,
  extracted_date TEXT,
  extracted_fee_category TEXT,
  confidence_score INTEGER,          -- 0-100
  matched_student_id INTEGER REFERENCES students(id),
  matched_fee_assignment_id INTEGER REFERENCES fee_assignments(id),
  status TEXT DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW | CONFIRMED | REJECTED
  linked_payment_id INTEGER REFERENCES payments(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challan_number TEXT UNIQUE NOT NULL,
  student_id INTEGER NOT NULL REFERENCES students(id),
  total_amount REAL NOT NULL,
  due_date TEXT,
  status TEXT DEFAULT 'GENERATED', -- GENERATED | PENDING | PAID | EXPIRED | CANCELLED
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challan_id INTEGER NOT NULL REFERENCES challans(id),
  fee_assignment_id INTEGER NOT NULL REFERENCES fee_assignments(id),
  amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name TEXT DEFAULT 'admin',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  message TEXT NOT NULL,
  channel TEXT DEFAULT 'simulated', -- simulated | sms | email | whatsapp
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

module.exports = db;
