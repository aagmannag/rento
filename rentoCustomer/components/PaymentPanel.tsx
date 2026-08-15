"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Phone, Smartphone, Upload } from "lucide-react";
import { useToast } from "@/components/Toast";
import { buildUpiLink, UPI_ID } from "@/lib/upi";
import { formatShopPhone } from "@/lib/phone";
import { isValidUtrFormat, UTR_FORMATS, UTR_MAX_LENGTH } from "@/lib/utr";
import type { Booking } from "@/lib/types";

function formatPickupDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Reiterates where/when/how to reach the shop right at the moment payment is submitted
 *  or verified — the fuller "Pickup details" card already sits above this component on
 *  the confirmation page, but a customer who just finished paying shouldn't have to
 *  scroll back up to see what to do next. */
function PickupSummary({ booking, tone }: { booking: Booking; tone: "green" | "blue" }) {
  const boxClass = tone === "green" ? "bg-white/70" : "bg-white/80";
  const phoneChipClass = tone === "green" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800";
  // Withheld until the admin actually verifies payment — an unpaid/still-under-review
  // hold has no confirmed booking behind it yet (see the identical gate on the
  // confirmation page's own Pickup details card, which this reiterates). `tone` doubles
  // as that check here rather than re-reading booking.paymentStatus, since this
  // component is only ever rendered from the Verified or Submitted branches below and
  // tone is set to match exactly which one.
  const canShowPhone = tone === "green";
  return (
    <div className={`mt-3 rounded-xl ${boxClass} p-3 text-xs`}>
      <p className="font-700 text-foreground">Your pickup details</p>
      <p className="mt-1 text-foreground">{booking.shop.name}</p>
      <p className="text-muted-foreground">{booking.shop.address}</p>
      {canShowPhone && booking.shop.phone ? (
        <a
          href={formatShopPhone(booking.shop.phone).href}
          className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-700 ${phoneChipClass}`}
        >
          <Phone size={12} /> {formatShopPhone(booking.shop.phone).display}
        </a>
      ) : !canShowPhone ? (
        <p className="mt-1.5 text-muted-foreground">Shop contact number will be shown once payment is verified.</p>
      ) : null}
      <p className="mt-1.5 text-muted-foreground">
        Pickup: <span className="font-700 text-foreground">{formatPickupDateTime(booking.pickupDateTime)}</span>
      </p>
    </div>
  );
}

export default function PaymentPanel({
  booking,
  onUpdated,
}: {
  booking: Booking;
  onUpdated: (booking: Booking) => void;
}) {
  const { showToast } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [utr, setUtr] = useState(booking.utrNumber ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(booking.paymentStatus !== "Submitted");

  const amount = booking.totalPayableOnline;
  const upiLink = buildUpiLink(amount, `Rento ${booking.id}`);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(upiLink, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [upiLink]);

  function handleCopy() {
    navigator.clipboard
      .writeText(UPI_ID)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedUtr = utr.trim();
    if (!trimmedUtr) {
      setError("Enter the UTR / transaction reference number");
      return;
    }
    if (!isValidUtrFormat(trimmedUtr)) {
      setError(
        "That doesn't match a valid transaction reference format — check the length against your transfer type below."
      );
      return;
    }

    setSubmitting(true);
    try {
      let screenshotUrl: string | null = null;
      if (file) {
        const form = new FormData();
        form.append("screenshot", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Failed to upload screenshot");
        screenshotUrl = uploadData.url;
      }

      const res = await fetch(`/api/bookings/${booking.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utrNumber: trimmedUtr, screenshotUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit payment");

      onUpdated(data.booking);
      setEditing(false);
      showToast("Payment submitted — we'll verify it shortly.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  }

  if (booking.paymentStatus === "Verified") {
    return (
      <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} className="shrink-0 text-green-600" />
          <div>
            <p className="text-sm font-700 text-green-800">Payment verified</p>
            <p className="text-xs text-green-700">UTR: {booking.utrNumber}</p>
          </div>
        </div>
        <PickupSummary booking={booking} tone="green" />
      </div>
    );
  }

  if (booking.paymentStatus === "Submitted" && !editing) {
    return (
      <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-3">
          <Clock size={20} className="shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-700 text-blue-900">Payment submitted — awaiting verification</p>
            <p className="text-xs text-blue-700">UTR: {booking.utrNumber}</p>
            <p className="mt-1 text-xs text-blue-700">
              Don&apos;t worry — this is usually confirmed within 15 minutes.
            </p>
          </div>
        </div>
        <PickupSummary booking={booking} tone="blue" />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 text-xs font-700 text-blue-700 underline underline-offset-2"
        >
          Entered the wrong UTR? Update it
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
      {booking.paymentStatus === "Rejected" && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-700">Payment couldn&apos;t be verified</p>
            {booking.paymentNote && <p className="mt-0.5">{booking.paymentNote}</p>}
            <p className="mt-0.5">Please double-check the reference number below and resubmit.</p>
          </div>
        </div>
      )}

      <p className="text-sm font-700 text-foreground">Complete payment via UPI</p>
      <p className="mt-1 text-xs text-muted-foreground">Pay ₹{amount} to confirm this booking.</p>

      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-2">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="UPI payment QR code" className="h-full w-full" />
          ) : (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          )}
        </div>

        <div className="w-full flex-1">
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
            <span className="flex-1 truncate text-sm font-700 text-foreground">{UPI_ID}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1 text-xs font-700 text-primary"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <a href={upiLink} className="btn-primary mt-3 flex items-center justify-center gap-2 py-2.5 text-sm">
            <Smartphone size={15} /> Pay ₹{amount} with UPI App
          </a>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            On a phone: tap above to open GPay / PhonePe / Paytm with the amount pre-filled. On a
            computer: scan the QR code with your phone&apos;s UPI app instead.
          </p>

          <details className="mt-2 rounded-lg bg-muted px-2.5 py-2 text-[11px] text-muted-foreground [&_summary]:cursor-pointer">
            <summary className="font-700 text-foreground">Got a &quot;bank limit exceeded&quot; error?</summary>
            <div className="mt-1.5 space-y-1.5 leading-relaxed">
              <p>
                This is a restriction your bank/UPI app applies — Rento never sets or controls UPI
                limits. It usually isn&apos;t about your real balance:
              </p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  <span className="font-600 text-foreground">New payee limit (most common):</span> the
                  first time you pay a UPI ID, banks cap total payments to it at ₹5,000 for 24 hours,
                  even across several small payments — this resets automatically after a day.
                </li>
                <li>
                  <span className="font-600 text-foreground">Per-transaction/daily limit:</span> most
                  banks allow up to ₹1,00,000/day via UPI, but some accounts (new accounts, minors&apos;
                  accounts) have a lower default — check or raise this in your bank&apos;s app.
                </li>
              </ul>
              <p>
                Try again with a different UPI app, a different bank account, or after 24 hours. Your
                pickup hold stays reserved until the countdown above runs out, so there&apos;s time to
                retry — if it&apos;s about to expire, use the contact link in Help to reach us.
              </p>
            </div>
          </details>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-border pt-4">
        <p className="text-xs font-700 text-foreground">After paying, submit your transaction reference</p>
        <div>
          <label className="text-xs font-600 text-muted-foreground">UTR / Transaction reference number</label>
          <input
            value={utr}
            onChange={(e) => {
              // A UTR is always plain alphanumeric (see UTR_FORMATS) — strip anything
              // else so a pasted value with spaces/dashes (common when copying out of a
              // bank SMS) doesn't silently fail validation later.
              setUtr(e.target.value.replace(/[^A-Za-z0-9]/g, ""));
              setError("");
            }}
            placeholder="e.g. 302471928374"
            maxLength={UTR_MAX_LENGTH}
            inputMode="text"
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
          <ul className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground">
            <li className="font-600">UTR length by transfer type:</li>
            {UTR_FORMATS.map((f) => (
              <li key={f.name}>{f.hint}</li>
            ))}
          </ul>
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-600 text-muted-foreground">
            <Upload size={13} /> Payment screenshot (optional, recommended)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-600"
          />
        </div>
        {error && <p className="text-xs font-600 text-red-500">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5 text-sm">
          {submitting ? "Submitting…" : "I've Paid — Submit for Verification"}
        </button>
      </form>
    </div>
  );
}
