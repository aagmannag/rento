"use client";

import { useState } from "react";
import { AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import { useOwner } from "@/app/providers";
import { useToast } from "@/components/Toast";

export default function OwnerStatusBanner() {
  const { owner, setOwner } = useOwner();
  const { showToast } = useToast();
  const [resubmitting, setResubmitting] = useState(false);

  if (!owner || owner.status === "Approved") return null;

  async function handleResubmit() {
    setResubmitting(true);
    try {
      const res = await fetch("/api/shop/resubmit", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resubmit");
      setOwner(data.owner);
      showToast("Sent back for review — we'll notify you once it's checked again.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to resubmit", "error");
    } finally {
      setResubmitting(false);
    }
  }

  if (owner.status === "Pending") {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <Clock size={18} className="mt-0.5 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-700 text-blue-900">Your account is under review</p>
          <p className="mt-1 text-xs text-blue-800">
            Our team typically reviews new shops within 24–48 hours. You can keep listing
            vehicles and setting up your shop in the meantime — they&apos;ll go live for
            customers as soon as you&apos;re approved.
          </p>
        </div>
      </div>
    );
  }

  if (owner.status === "Rejected") {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-700 text-amber-900">Your application was not approved</p>
          {owner.rejectionReason && (
            <p className="mt-1 text-xs text-amber-800">
              <span className="font-700">Reason: </span>
              {owner.rejectionReason}
            </p>
          )}
          <p className="mt-1 text-xs text-amber-800">
            Update your shop details below, then resubmit for another review.
          </p>
          <button
            onClick={handleResubmit}
            disabled={resubmitting}
            className="mt-3 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-700 text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {resubmitting ? "Resubmitting…" : "Resubmit for Review"}
          </button>
        </div>
      </div>
    );
  }

  // Suspended
  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-red-600" />
      <div>
        <p className="text-sm font-700 text-red-900">Your account has been suspended</p>
        <p className="mt-1 text-xs text-red-800">
          Your vehicles are currently hidden from customers. Please contact Rento support to
          resolve this.
        </p>
      </div>
    </div>
  );
}
