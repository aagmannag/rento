"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Smartphone, Upload } from "lucide-react";
import { useToast } from "@/components/Toast";
import { buildUpiLink, UPI_ID } from "@/lib/upi";
import type { Booking } from "@/lib/types";

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
    if (!utr.trim()) {
      setError("Enter the UTR / transaction reference number");
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
        body: JSON.stringify({ utrNumber: utr.trim(), screenshotUrl }),
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
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
        <CheckCircle2 size={20} className="shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-700 text-green-800">Payment verified</p>
          <p className="text-xs text-green-700">UTR: {booking.utrNumber}</p>
        </div>
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
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-border pt-4">
        <p className="text-xs font-700 text-foreground">After paying, submit your transaction reference</p>
        <div>
          <label className="text-xs font-600 text-muted-foreground">UTR / Transaction reference number</label>
          <input
            value={utr}
            onChange={(e) => {
              setUtr(e.target.value);
              setError("");
            }}
            placeholder="e.g. 302471928374"
            className="mt-1 w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
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
