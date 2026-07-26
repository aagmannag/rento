"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Store } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { useShopOwners } from "@/lib/hooks";
import type { OwnerApprovalStatus } from "@/lib/types";

const TABS: { key: OwnerApprovalStatus | "All"; label: string }[] = [
  { key: "Pending", label: "Pending" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
  { key: "Suspended", label: "Suspended" },
  { key: "All", label: "All" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ShopOwnersPage() {
  return (
    <Suspense fallback={null}>
      <ShopOwnersContent />
    </Suspense>
  );
}

function ShopOwnersContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("status") as OwnerApprovalStatus | null) ?? "Pending";
  const [tab, setTab] = useState<OwnerApprovalStatus | "All">(
    TABS.some((t) => t.key === initialTab) ? initialTab : "Pending"
  );
  const { owners, loading } = useShopOwners(tab === "All" ? undefined : tab);

  return (
    <div>
      <PageHeader title="Shop Owners" subtitle="Every shop owner registration on Rento" />

      <div className="mb-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-600 transition ${
              tab === t.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-muted" />
          ))}
        </div>
      ) : owners.length === 0 ? (
        <EmptyState
          icon={Store}
          title={`No ${tab === "All" ? "" : tab.toLowerCase() + " "}shop owners`}
          description="Nothing to show in this tab right now."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-700 uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Shop</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">City</th>
                  <th className="px-5 py-3">Applied</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="max-w-[180px] truncate px-5 py-3 font-600 text-foreground" title={o.shopName}>{o.shopName}</td>
                    <td className="max-w-[160px] truncate px-5 py-3 text-foreground" title={o.ownerName}>{o.ownerName}</td>
                    <td className="max-w-[200px] px-5 py-3">
                      <p className="truncate text-foreground" title={o.email}>{o.email}</p>
                      <p className="text-xs text-muted-foreground">{o.phone}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{o.city}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(o.createdAt)}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3">
                      <Link href={`/shop-owners/${o.id}`} className="inline-block px-2 py-1.5 text-xs font-700 text-primary">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
