import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  href,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "primary" | "warning" | "danger";
  hint?: string;
  /** When set, the whole card becomes a link (e.g. to a filtered list) with a hover affordance. */
  href?: string;
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary text-white"
      : tone === "warning"
      ? "bg-amber-100 text-amber-700"
      : tone === "danger"
      ? "bg-red-100 text-red-600"
      : "bg-secondary text-primary";

  const content = (
    <div
      className={`rounded-2xl border border-border bg-card p-5 shadow-card ${
        href ? "card-hover transition-colors hover:border-primary/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-600 text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-800 text-foreground">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon size={18} />
        </span>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
