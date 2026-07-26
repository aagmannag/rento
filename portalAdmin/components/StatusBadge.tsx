const STYLES: Record<string, string> = {
  Pending: "bg-blue-50 text-blue-700",
  Approved: "bg-green-50 text-green-700",
  Rejected: "bg-amber-50 text-amber-700",
  Suspended: "bg-red-50 text-red-600",
  Active: "bg-green-50 text-green-700",
  Inactive: "bg-muted text-muted-foreground",
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
