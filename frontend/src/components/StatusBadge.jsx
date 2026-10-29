export default function StatusBadge({ status }) {
  const map = {
    SUCCESS: "badge-success",
    CLEARED: "badge-success",
    PAID: "badge-success",
    CONFIRMED: "badge-success",
    PENDING: "badge-warning",
    PENDING_VERIFICATION: "badge-warning",
    PENDING_REVIEW: "badge-warning",
    PROCESSING: "badge-info",
    GENERATED: "badge-info",
    FAILED: "badge-danger",
    BOUNCED: "badge-danger",
    REJECTED: "badge-danger",
    CANCELLED: "badge-neutral",
    EXPIRED: "badge-neutral",
    HIGH: "badge-danger",
    MEDIUM: "badge-warning",
    LOW: "badge-neutral",
  };
  const cls = map[status] || "badge-neutral";
  return <span className={`badge ${cls}`}>{status?.replace(/_/g, " ")}</span>;
}
