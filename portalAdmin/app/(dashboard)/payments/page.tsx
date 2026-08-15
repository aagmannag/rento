"use client";

import { useState } from "react";
import Image from "next/image";
import { Banknote, ExternalLink } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { usePayments } from "@/lib/hooks";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaymentsPage() {
  const { payments, loading, verify, reject } = usePayments();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  async function handleVerify(id: string) {
    setBusyId(id);
    try {
      await verify(id);
      showToast("Payment verified", "success");
    } catch {
      showToast("Failed to verify payment", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(reason?: string) {
    if (!rejectingId || !reason) return;
    setBusyId(rejectingId);
    try {
      await reject(rejectingId, reason);
      showToast("Payment rejected — the customer can resubmit", "success");
    } catch {
      showToast("Failed to reject payment", "error");
    } finally {
      setBusyId(null);
      setRejectingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Manual UPI payments awaiting verification — cross-check the UTR and amount against your bank/UPI statement before confirming."
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-muted" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Nothing waiting for review"
          description="Payment submissions from customers will show up here for you to verify against your UPI statement."
        />
      ) : (
        <div className="space-y-4">
          {payments.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {p.vehiclePhoto && <Image src={p.vehiclePhoto} alt={p.vehicleName} fill className="object-cover" />}
                  </div>
                  <div>
                    <p className="text-sm font-800 text-foreground">{p.vehicleName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.customerName} · {p.customerPhone} · {p.city}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Booking <span className="font-700 text-foreground">{p.id}</span> · Submitted{" "}
                      {formatDate(p.paymentSubmittedAt)}
                    </p>
                    {/* The customer cancelled after paying but before this was verified.
                        Still confirm the payment landed — that is what decides whether a
                        refund is owed — but this is not a booking to treat as live. */}
                    {p.bookingStatus === "Cancelled" && (
                      <p className="mt-1.5 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-700 text-red-700">
                        Cancelled by customer
                        {p.refundAmount != null && ` · refund ₹${p.refundAmount} due`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-800 text-foreground">₹{p.totalPayableOnline}</p>
                  <p className="text-xs text-muted-foreground">{p.quantity} unit{p.quantity > 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-xl bg-muted p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-700 uppercase tracking-wide text-muted-foreground">
                    Customer-submitted UTR
                  </p>
                  <p className="break-all font-mono text-sm font-700 text-foreground">{p.utrNumber ?? "—"}</p>
                </div>
                {p.paymentScreenshotUrl && (
                  <a
                    href={p.paymentScreenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1.5 text-xs font-700 text-primary"
                  >
                    View screenshot <ExternalLink size={13} />
                  </a>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => handleVerify(p.id)}
                  disabled={busyId === p.id}
                  className="btn-primary min-h-[46px] flex-1 text-sm disabled:opacity-50"
                >
                  {busyId === p.id ? "Please wait…" : "Verify Payment"}
                </button>
                <button
                  onClick={() => setRejectingId(p.id)}
                  disabled={busyId === p.id}
                  className="min-h-[46px] flex-1 rounded-[var(--radius)] border border-red-200 text-sm font-600 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!rejectingId}
        title="Reject this payment?"
        description="The customer will see this reason and can resubmit a corrected UTR — if the vehicle's still available."
        confirmLabel="Reject"
        danger
        busy={!!busyId}
        requireReason
        reasonLabel="Reason"
        reasonPlaceholder="e.g. This UTR doesn't match any payment received, or the amount was short."
        onConfirm={handleReject}
        onCancel={() => setRejectingId(null)}
      />
    </div>
  );
}
