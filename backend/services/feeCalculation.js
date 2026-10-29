// services/feeCalculation.js
//
// CORE RULE: we never store "paid" or "pending" as a mutable number anywhere.
// Both are always CALCULATED on the fly from:
//   - the fee_assignment's base amount
//   - its fee_adjustments (waivers/scholarships subtract, penalties/late fees add)
//   - the SUCCESS/CLEARED payments allocated to it
//
// This keeps the ledger honest and gives you a full audit trail for free.

const db = require("../db");

function getAdjustmentTotal(feeAssignmentId) {
  const rows = db
    .prepare("SELECT type, amount FROM fee_adjustments WHERE fee_assignment_id = ?")
    .all(feeAssignmentId);

  let delta = 0;
  for (const row of rows) {
    if (["WAIVER", "SCHOLARSHIP", "DISCOUNT", "REFUND"].includes(row.type)) {
      delta -= row.amount;
    } else if (["LATE_FEE", "PENALTY"].includes(row.type)) {
      delta += row.amount;
    }
    // OTHER: ignored in totals but still logged, admin can interpret manually
  }
  return delta;
}

function getPaidTotal(feeAssignmentId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(pa.allocated_amount), 0) as total
       FROM payment_allocations pa
       JOIN payments p ON p.id = pa.payment_id
       WHERE pa.fee_assignment_id = ?
       AND p.status IN ('SUCCESS', 'CLEARED')`
    )
    .get(feeAssignmentId);
  return row.total;
}

// Returns the full computed picture for one fee assignment
function computeFeeAssignment(feeAssignmentId) {
  const assignment = db
    .prepare(
      `SELECT fa.*, ft.name as fee_type_name, ft.category as fee_category
       FROM fee_assignments fa
       JOIN fee_types ft ON ft.id = fa.fee_type_id
       WHERE fa.id = ?`
    )
    .get(feeAssignmentId);
  if (!assignment) return null;

  const adjustmentDelta = getAdjustmentTotal(feeAssignmentId);
  const finalPayable = assignment.amount + adjustmentDelta;
  const paid = getPaidTotal(feeAssignmentId);
  const pending = Math.max(0, finalPayable - paid);

  return {
    ...assignment,
    adjustment_delta: adjustmentDelta,
    final_payable: finalPayable,
    paid,
    pending,
    is_fully_paid: pending <= 0,
    is_overdue:
      assignment.due_date &&
      new Date(assignment.due_date) < new Date() &&
      pending > 0,
  };
}

// Full fee picture for a student across all their fee assignments
function computeStudentSummary(studentId) {
  const assignments = db
    .prepare(
      "SELECT id FROM fee_assignments WHERE student_id = ? AND status = 'active'"
    )
    .all(studentId);

  const items = assignments.map((a) => computeFeeAssignment(a.id));

  const totalFee = items.reduce((sum, i) => sum + i.final_payable, 0);
  const totalPaid = items.reduce((sum, i) => sum + i.paid, 0);
  const totalPending = items.reduce((sum, i) => sum + i.pending, 0);

  return {
    items,
    totalFee,
    totalPaid,
    totalPending,
    isFullyPaid: totalPending <= 0,
  };
}

module.exports = {
  getAdjustmentTotal,
  getPaidTotal,
  computeFeeAssignment,
  computeStudentSummary,
};
