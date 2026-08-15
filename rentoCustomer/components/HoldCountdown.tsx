"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";

const DEFAULT_HOLD_MINUTES = 5;

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Countdown to when a Pending booking's payment hold expires (see @rento/db's
 * PENDING_HOLD_MINUTES, which must match `holdMinutes` here — the server is always the
 * actual authority on expiry, this is purely the customer-facing display of it).
 *
 * Recomputes `deadline - Date.now()` on every tick instead of decrementing a counter,
 * so a browser throttling this timer in a backgrounded tab never causes drift: whenever
 * a tick does fire — even minutes late — the displayed time is still exactly correct.
 */
export default function HoldCountdown({
  createdAt,
  holdMinutes = DEFAULT_HOLD_MINUTES,
  onExpire,
}: {
  createdAt: string;
  holdMinutes?: number;
  onExpire: () => void;
}) {
  const deadline = useMemo(() => new Date(createdAt).getTime() + holdMinutes * 60_000, [createdAt, holdMinutes]);
  const [remainingMs, setRemainingMs] = useState(() => deadline - Date.now());
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    firedRef.current = false;

    function tick() {
      const left = deadline - Date.now();
      setRemainingMs(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const clamped = Math.max(0, remainingMs);
  const expired = clamped <= 0;
  const urgent = clamped > 0 && clamped <= 60_000;
  const pct = Math.min(100, Math.max(0, (clamped / (holdMinutes * 60_000)) * 100));

  return (
    <div
      role="timer"
      aria-live="polite"
      className={`mt-4 rounded-2xl border p-3 transition-colors ${
        expired
          ? "border-red-200 bg-red-50"
          : urgent
            ? "border-red-200 bg-red-50"
            : "border-primary/30 bg-secondary"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`flex items-center gap-1.5 text-xs font-700 ${
            expired || urgent ? "text-red-700" : "text-primary"
          }`}
        >
          <Clock size={14} className="shrink-0" />
          {expired ? "Hold expired" : "Complete payment before your hold expires"}
        </span>
        <span
          className={`text-lg font-800 tabular-nums ${expired || urgent ? "text-red-700" : "text-primary"}`}
        >
          {formatClock(clamped)}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            expired || urgent ? "bg-red-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
