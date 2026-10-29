// services/healthScore.js
//
// Formula (transparent, explainable to judges):
//   score = CollectionRate * 50 + FullyPaidRate * 30 + (1 - OverdueRate) * 20
// Clamped to 0-100.

const db = require("../db");
const { computeStudentSummary } = require("./feeCalculation");

function calculateHealthScore() {
  const students = db.prepare("SELECT id FROM students").all();

  let totalExpected = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let totalOverdueAmount = 0;
  let fullyPaidCount = 0;

  for (const s of students) {
    const summary = computeStudentSummary(s.id);
    totalExpected += summary.totalFee;
    totalCollected += summary.totalPaid;
    totalPending += summary.totalPending;
    if (summary.isFullyPaid && summary.totalFee > 0) fullyPaidCount++;

    for (const item of summary.items) {
      if (item.is_overdue) totalOverdueAmount += item.pending;
    }
  }

  const collectionRate = totalExpected > 0 ? totalCollected / totalExpected : 0;
  const fullyPaidRate = students.length > 0 ? fullyPaidCount / students.length : 0;
  const overdueRate = totalExpected > 0 ? totalOverdueAmount / totalExpected : 0;

  let score = collectionRate * 50 + fullyPaidRate * 30 + (1 - overdueRate) * 20;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = "Critical";
  if (score >= 90) label = "Excellent";
  else if (score >= 75) label = "Good";
  else if (score >= 50) label = "Needs Attention";

  return {
    score,
    label,
    collectionRate: Math.round(collectionRate * 100),
    totalExpected,
    totalCollected,
    totalPending,
    totalOverdueAmount,
    studentsFullyPaid: fullyPaidCount,
    totalStudents: students.length,
  };
}

module.exports = { calculateHealthScore };
