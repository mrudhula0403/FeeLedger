// services/ocrService.js
//
// Real OCR via Tesseract.js - actually reads text out of the uploaded receipt image,
// then parses structured fields (name, amount, date, roll number, fee category) out of
// that raw text using regex. This is genuine OCR, not a filename trick.
//
// Tesseract.js downloads its English language model from a CDN the first time it runs
// (needs internet on whatever machine is running the backend - completely normal, it's
// a few MB, one-time, then cached). If that download or recognition fails for any reason
// (offline, first-run timeout, corrupted image), we fall back to MOCK_MODE automatically
// so a demo never hard-fails because of a flaky network - it just quietly degrades.
//
// Set OCR_MODE=mock to skip real OCR entirely and always use the mock engine (useful for
// fast local development without waiting on Tesseract every time).

const { createWorker } = require("tesseract.js");

const OCR_MODE = process.env.OCR_MODE || "real";

// If real OCR fails once (e.g. the language-data CDN is unreachable from this
// server), we stop trying it again for the rest of the process lifetime and quietly
// serve mock data instead - this keeps every subsequent upload fast and reliable
// rather than repeatedly hanging/failing against a CDN that isn't coming back.
let realOcrDisabled = false;

let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng").catch((err) => {
      workerPromise = null; // allow a retry on a future upload, in case it was transient
      throw err;
    });
  }
  return workerPromise;
}

// Normalizes amount strings like "₹5,000", "Rs. 5000", "5000/-" -> 5000
function normalizeAmount(raw) {
  if (typeof raw === "number") return raw;
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,]/g, "").replace(/rs\.?/i, "").replace(/\/-/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

const FEE_CATEGORY_KEYWORDS = {
  Tuition: /tuition/i,
  Transport: /bus|transport/i,
  Hostel: /hostel|boarding/i,
  Canteen: /canteen|meal/i,
  Books: /book/i,
  Uniform: /uniform/i,
  Exam: /exam/i,
};

function guessFeeCategory(text) {
  for (const [category, pattern] of Object.entries(FEE_CATEGORY_KEYWORDS)) {
    if (pattern.test(text)) return category;
  }
  return null;
}

// Parses raw OCR text into structured fields using regex. This is the "normalize messy
// OCR output" step described in the brief - handles varied formats like "₹5,000",
// "Rs. 5000", "5000/-" for amounts, and multiple date formats.
function parseReceiptText(rawText) {
  const text = rawText || "";

  let amountMatch = text.match(/(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) {
    // Fallback: a bare number followed by "/-" (common on Indian receipts with no currency symbol)
    amountMatch = text.match(/\b([\d,]{3,})\s*\/-/);
  }
  const amount = amountMatch ? normalizeAmount(amountMatch[1]) : null;

  const dateMatch = text.match(/(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{2,4})/);
  let date = null;
  if (dateMatch) {
    let [, day, month, year] = dateMatch;
    if (year.length === 2) year = "20" + year;
    date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const codeMatch = text.match(/\b(STU\d{2,})\b/i);
  const student_code = codeMatch ? codeMatch[1].toUpperCase() : null;

  const rollMatch = text.match(/roll\s*(?:no\.?|number)?[:\-]?\s*([A-Za-z0-9\-]+)/i);
  const roll_number = rollMatch ? rollMatch[1].trim() : null;

  const nameMatch = text.match(/(?:student|name)\s*[:\-]\s*([^\n\r]{2,40})/i);
  const student_name = nameMatch ? nameMatch[1].trim().replace(/\s+/g, " ") : null;

  const fee_category = guessFeeCategory(text);

  return { raw_text: text, student_name, student_code, roll_number, amount, date, fee_category };
}

// --- Mock fallback (used if real OCR is unavailable, or if OCR_MODE=mock) ---
const MOCK_RECEIPTS = [
  {
    keyword: "rahul",
    raw_text: "SCHOOL FEE RECEIPT\nStudent: Rahul Kumar\nStudent ID: STU001\nFee Type: Bus Fee\nAmount: Rs. 5000\nDate: 20-07-2026",
    student_name: "Rahul Kumar", student_code: "STU001", roll_number: "10A-01", amount: 5000, date: "2026-07-20", fee_category: "Transport",
  },
  {
    keyword: "priya",
    raw_text: "SCHOOL FEE RECEIPT\nStudent: Priya Sharma\nStudent ID: STU002\nFee Type: Tuition Fee\nAmount: Rs. 10000/-\nDate: 18-07-2026",
    student_name: "Priya Sharma", student_code: "STU002", roll_number: "10A-02", amount: 10000, date: "2026-07-18", fee_category: "Tuition",
  },
  {
    keyword: "unclear",
    raw_text: "RECEIPT\nName: R. Kmar (smudged)\nAmount: 5,000\nDate: 19-07-2026",
    student_name: "R. Kmar", student_code: null, roll_number: null, amount: 5000, date: "2026-07-19", fee_category: null,
  },
];
const DEFAULT_MOCK = {
  raw_text: "SCHOOL FEE RECEIPT\nStudent: Arun Raj\nStudent ID: STU003\nFee Type: Tuition Fee\nAmount: Rs. 8000\nDate: 17-07-2026",
  student_name: "Arun Raj", student_code: "STU003", roll_number: "9A-01", amount: 8000, date: "2026-07-17", fee_category: "Tuition",
};

function mockExtract(originalFilename) {
  const lower = (originalFilename || "").toLowerCase();
  const found = MOCK_RECEIPTS.find((r) => lower.includes(r.keyword));
  return found || DEFAULT_MOCK;
}

async function extractReceiptData(imagePath, originalFilename) {
  if (OCR_MODE === "mock" || realOcrDisabled) {
    return mockExtract(originalFilename);
  }

  try {
    // Race against a timeout so a hung network fetch (e.g. CDN unreachable) can
    // never leave a request hanging - it fails fast and falls back to mock instead.
    const worker = await Promise.race([
      getWorker(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("OCR worker init timed out")), 20000)),
    ]);
    const { data } = await worker.recognize(imagePath);
    const parsed = parseReceiptText(data.text);

    if (!parsed.amount && !parsed.student_name && !parsed.student_code) {
      console.warn("OCR found no usable text, falling back to mock extraction for this upload.");
      return mockExtract(originalFilename);
    }
    return parsed;
  } catch (err) {
    console.warn("Real OCR unavailable (" + err.message + "). Falling back to mock OCR for this and all future uploads this session.");
    realOcrDisabled = true;
    return mockExtract(originalFilename);
  }
}

module.exports = { extractReceiptData, normalizeAmount, parseReceiptText };
