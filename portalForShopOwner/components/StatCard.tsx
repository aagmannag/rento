import type { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "primary";
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-600 text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-800 text-foreground">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            tone === "primary" ? "bg-primary text-white" : "bg-secondary text-primary"
          }`}
        >
          <Icon size={18} />
        </span>
      </div>
    </div>
  );
}
