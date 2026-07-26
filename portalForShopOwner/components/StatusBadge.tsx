const STYLES: Record<string, string> = {
  Active: "bg-green-50 text-green-700",
  Inactive: "bg-muted text-muted-foreground",
  Upcoming: "bg-blue-50 text-blue-700",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-red-50 text-red-600",
  Pending: "bg-muted text-muted-foreground",
  Submitted: "bg-blue-50 text-blue-700",
  Verified: "bg-green-50 text-green-700",
  Rejected: "bg-red-50 text-red-600",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-700 ${
        STYLES[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
