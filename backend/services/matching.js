// services/matching.js
//
// Matches OCR-extracted receipt data against the students table and
// produces a confidence score (0-100), following the priority rules:
//   1. Exact student_code match          -> +60
//   2. Exact roll_number match           -> +25 (bonus if code didn't match)
//   3. Name match (normalized)           -> +25
//   4. Amount looks valid (> 0)          -> +10
//   5. Date looks valid                  -> +5
//
// 90-100 = high confidence (safe to auto-suggest, still needs admin click-confirm)
// 70-89  = needs admin confirmation (shown clearly in UI)
// <70    = manual review required (admin must pick the student manually)

const db = require("../db");

// Normalize a name for fuzzy comparison: lowercase, strip extra spaces/punctuation
function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Simple Levenshtein distance for fuzzy name matching
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  const distance = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - distance / maxLen; // 1 = identical, 0 = completely different
}

function matchReceiptToStudent(extracted) {
  const students = db.prepare("SELECT * FROM students").all();

  let bestMatch = null;
  let bestScore = 0;
  let bestBreakdown = null;

  for (const student of students) {
    let score = 0;
    const breakdown = {};

    // 1. Exact student code match (most reliable)
    if (
      extracted.student_code &&
      student.student_code.toLowerCase() === extracted.student_code.toLowerCase()
    ) {
      score += 60;
      breakdown.student_code_match = true;
    }

    // 2. Exact roll number match
    if (
      extracted.roll_number &&
      student.roll_number &&
      student.roll_number.toLowerCase() === extracted.roll_number.toLowerCase()
    ) {
      score += 25;
      breakdown.roll_number_match = true;
    }

    // 3. Name similarity (fuzzy)
    if (extracted.student_name) {
      const similarity = nameSimilarity(extracted.student_name, student.name);
      if (similarity > 0.85) {
        score += 25;
        breakdown.name_match = true;
      } else if (similarity > 0.6) {
        score += 12; // partial credit for a close-but-not-exact name
        breakdown.name_partial_match = true;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = student;
      bestBreakdown = breakdown;
    }
  }

  // 4. Amount validity bonus (applies regardless of which student)
  if (extracted.amount && extracted.amount > 0) {
    bestScore += 10;
  }
  // 5. Date validity bonus
  if (extracted.date && !isNaN(new Date(extracted.date).getTime())) {
    bestScore += 5;
  }

  bestScore = Math.min(100, bestScore);

  let confidenceLevel = "LOW";
  if (bestScore >= 90) confidenceLevel = "HIGH";
  else if (bestScore >= 70) confidenceLevel = "MEDIUM";

  return {
    matchedStudent: bestMatch,
    confidence: bestScore,
    confidenceLevel, // HIGH (auto-suggest) | MEDIUM (needs confirm) | LOW (manual review)
    breakdown: bestBreakdown,
  };
}

module.exports = { matchReceiptToStudent, nameSimilarity, normalizeName };
