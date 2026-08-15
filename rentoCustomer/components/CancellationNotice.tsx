"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Clock } from "lucide-react";
import {
  quoteRefund,
  msUntilRefundDrops,
  FREE_CANCELLATION_HOURS,
  type QuotableBooking,
} from "@/lib/cancellationPolicy";

/** Longest gap between refreshes. The refund figure only changes on tier boundaries,
 *  but a slow tick keeps "cancel now" honest against a tab left open for hours. */
const MAX_TICK_MS = 60_000;

function formatTime(date: Date) {
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Live view of what this booking would be refunded if it were cancelled right now.
 *
 * Recomputes from `Date.now()` on every tick rather than counting down, so a tab that
 * was backgrounded — and had its timers throttled — still shows the correct tier the
 * moment it wakes. Ticks land exactly on the next tier boundary when one is closer
 * than the regular interval, so the displayed percentage never lags the policy.
 *
 * This is an estimate against the visitor's own clock; the server remains the
 * authority when a cancellation is actually processed.
 */
export default function CancellationNotice({ booking }: { booking: QuotableBooking }) {
  // Null until mounted so the server-rendered markup carries no clock-dependent text
  // and hydration can't mismatch.
  const [nowMs, setNowMs] = useState<number | null>(null);

  // Depend on the quoted fields, not the booking object — callers hand us a freshly
  // built object on most renders, and keying the timer off its identity would tear the
  // schedule down and rebuild it on every tick.
  const { pickupDateTime, totalPayableOnline, status, paymentStatus } = booking;

  useEffect(() => {
    const target: QuotableBooking = { pickupDateTime, totalPayableOnline, status, paymentStatus };
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const now = Date.now();
      setNowMs(now);
      const untilDrop = msUntilRefundDrops(quoteRefund(target, { now }), now);
      // +1s so the tick lands just past the boundary, never a hair before it.
      const delay = untilDrop === null ? MAX_TICK_MS : Math.min(MAX_TICK_MS, untilDrop + 1_000);
      timer = setTimeout(tick, Math.max(1_000, delay));
    }

    tick();
    return () => clearTimeout(timer);
  }, [pickupDateTime, totalPayableOnline, status, paymentStatus]);

  const quote = quoteRefund(booking, nowMs === null ? {} : { now: nowMs });

  // Nothing useful to say once a booking is closed out — or before it's paid for, when
  // the page is already dominated by the hold countdown and the payment panel and there
  // is no refund to reason about yet.
  if (
    quote.outcome === "already-cancelled" ||
    quote.outcome === "not-cancellable" ||
    quote.outcome === "nothing-paid"
  ) {
    return null;
  }

  const policyLink = (
    <Link href="/cancellation-policy" className="font-700 text-primary underline-offset-2 hover:underline">
      Cancellation policy
    </Link>
  );

  if (quote.outcome === "unknown" || nowMs === null) {
    return (
      <Wrapper tone="neutral" icon={<ShieldCheck size={18} />} title="Free cancellation">
        <p>
          Cancel {FREE_CANCELLATION_HOURS} hours or more before pickup for a full refund of the
          rental cost paid online. Refunds taper closer to pickup — see the {policyLink}.
        </p>
      </Wrapper>
    );
  }

  const full = quote.isFullyRefundable;

  return (
    <Wrapper
      tone={full ? "good" : quote.refundPercent > 0 ? "warn" : "bad"}
      icon={full ? <ShieldCheck size={18} /> : <Clock size={18} />}
      title={full ? "Free cancellation" : "Cancellation refund"}
    >
      <p className="text-foreground">
        Cancel now and you&apos;re refunded{" "}
        <span className="font-800">₹{quote.refundAmount}</span>{" "}
        <span className="text-muted-foreground">
          ({quote.refundPercent}% of ₹{quote.baseAmount})
        </span>
        {quote.forfeitAmount > 0 && (
          <span className="text-muted-foreground"> · ₹{quote.forfeitAmount} non-refundable</span>
        )}
      </p>
      {quote.nextTier && quote.tierEndsAt && (
        <p className="mt-1">
          Drops to {quote.nextTier.refundPercent}% after{" "}
          <span className="font-700 text-foreground">{formatTime(quote.tierEndsAt)}</span>.
        </p>
      )}
      {quote.hoursUntilPickup !== null && quote.hoursUntilPickup <= 0 && (
        <p className="mt-1">Your pickup time has passed — cancellations are no longer refundable.</p>
      )}
      <p className="mt-1">
        You can cancel this booking from{" "}
        <Link href="/my-bookings" className="font-700 text-primary underline-offset-2 hover:underline">
          My Bookings
        </Link>
        . Full details in the {policyLink}.
      </p>
    </Wrapper>
  );
}

const TONE_CLASS = {
  good: "border-green-200 bg-green-50 text-green-700",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  bad: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-border bg-secondary text-muted-foreground",
} as const;

function Wrapper({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof TONE_CLASS;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mt-4 rounded-2xl border p-4 ${TONE_CLASS[tone]}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-800">{title}</p>
          <div className="mt-1 space-y-0 text-xs leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}
