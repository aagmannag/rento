"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useToast } from "./Toast";
import { quoteRefund, customerCancelBlockReason, FREE_CANCELLATION_HOURS } from "@/lib/cancellationPolicy";
import type { Booking } from "@/lib/types";

/**
 * Whether to offer a Cancel control. Defers to the very rule the server enforces in
 * cancelBookingForUser(), so the button is never shown for a booking the server would
 * refuse — and a client that skips the UI still can't get past the server.
 */
export function isCancellable(booking: Booking, now: number = Date.now()): boolean {
  return customerCancelBlockReason(booking, now) === null;
}

export default function CancelBookingButton({
  booking,
  onCancelled,
  className = "",
}: {
  booking: Booking;
  /** Handed the server's updated booking so the caller can patch local state without
   *  waiting for the next poll. */
  onCancelled: (updated: Booking) => void;
  className?: string;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Survives this component unmounting mid-request (the card re-renders as Cancelled
  // the moment local state updates), so a late response can't setState on a dead tree.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const close = useCallback(() => {
    if (busy) return; // never yank the dialog out from under an in-flight request
    setOpen(false);
    setError(null);
  }, [busy]);

  // Escape to dismiss, and move focus into the dialog when it opens.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!isCancellable(booking)) return null;

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          data?.error ??
          (res.status === 401
            ? "Your session has expired. Please log in again."
            : "Couldn't cancel this booking. Please try again.");
        if (aliveRef.current) setError(message);
        return;
      }

      const refunded: number = data?.refund?.refundAmount ?? 0;
      if (data?.booking) onCancelled(data.booking as Booking);
      showToast(
        refunded > 0
          ? `Booking cancelled. ₹${refunded} will be refunded to the account you paid from.`
          : "Booking cancelled.",
        "success"
      );
      if (aliveRef.current) {
        setOpen(false);
        setError(null);
      }
    } catch {
      if (aliveRef.current) {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-lg border border-border px-3 py-1.5 text-xs font-700 text-muted-foreground transition hover:border-red-400 hover:text-red-600 ${className}`}
      >
        Cancel booking
      </button>

      {open && <CancelDialog
        booking={booking}
        busy={busy}
        error={error}
        onClose={close}
        onConfirm={handleConfirm}
        closeRef={closeRef}
      />}
    </>
  );
}

function CancelDialog({
  booking,
  busy,
  error,
  onClose,
  onConfirm,
  closeRef,
}: {
  booking: Booking;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  closeRef: React.RefObject<HTMLButtonElement>;
}) {
  // Quoted once, when the dialog opens, so the figure can't shift under the customer's
  // cursor mid-decision. The server recomputes on its own clock and its answer wins —
  // which is why the success toast reports the server's number, not this one.
  const [quote] = useState(() => quoteRefund(booking, { cancelledBy: "customer" }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="cancel-dialog-title" className="text-base font-800 text-foreground">
            Cancel this booking?
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg p-1 text-muted-foreground transition hover:bg-secondary disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          {booking.quantity > 1 ? `${booking.quantity} × ` : ""}
          {booking.vehicleName} · {booking.city}
        </p>

        <div className="mt-4 rounded-xl border border-border bg-secondary p-3 text-sm">
          {quote.outcome === "nothing-paid" ? (
            <p className="text-muted-foreground">
              You haven&apos;t paid for this booking online, so there&apos;s nothing to refund.
              Cancelling releases the vehicle for other customers.
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-600 text-foreground">Refund</span>
                <span className="text-lg font-800 text-foreground">₹{quote.refundAmount}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {quote.refundPercent}% of the ₹{quote.baseAmount} paid online
                {quote.forfeitAmount > 0 && ` · ₹${quote.forfeitAmount} is non-refundable`}
              </p>
              {quote.nextTier && quote.tierEndsAt && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  This drops to {quote.nextTier.refundPercent}% after{" "}
                  {quote.tierEndsAt.toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  .
                </p>
              )}
            </>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Cancelling can&apos;t be undone — you&apos;d need to make a new booking, and the vehicle
          may be taken by then. Cancel {FREE_CANCELLATION_HOURS} hours or more before pickup for a
          full refund; see the{" "}
          <Link href="/cancellation-policy" className="font-700 text-primary underline-offset-2 hover:underline">
            cancellation policy
          </Link>
          .
        </p>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-700 text-foreground transition active:scale-[0.98] disabled:opacity-50"
          >
            Keep booking
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-700 text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? "Cancelling…" : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
