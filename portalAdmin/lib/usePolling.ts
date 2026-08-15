"use client";

import { useEffect, useRef } from "react";

/**
 * Background auto-refresh for data that can change from OUTSIDE this tab — a customer
 * submitting a new payment, a shop owner signing up, another admin (or this same admin
 * in a different tab) verifying/rejecting a payment or approving an owner. Polling (not
 * push) is a deliberate choice: this app deploys to serverless hosting with no
 * persistent WebSocket/SSE server, so a short interval is the pragmatic way to get
 * "no manual reload needed" without standing up new infrastructure. Mirrors the
 * identical hook in rentoCustomer/portalPartner.
 *
 * Particularly important here: two admins can easily be looking at the same pending-
 * payments queue at once. Without this, admin B could verify a payment admin A already
 * handled a moment earlier, hit a stale/already-resolved row, and get a confusing
 * error — polling keeps the queue converged on reality for everyone watching it.
 *
 * Edge cases this handles so polling never becomes a burden rather than a convenience:
 *   - Paused entirely while the tab is hidden.
 *   - Fires once immediately on becoming visible again.
 *   - Skipped while offline (navigator.onLine === false).
 *   - Never overlaps itself: a tick still in flight when the next would fire is skipped.
 *   - Failures are swallowed (not surfaced as UI errors) — a single missed poll isn't
 *     worth interrupting the admin; the next tick just tries again.
 */
export function usePolling(callback: () => void | Promise<void>, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    async function tick() {
      if (inFlightRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      inFlightRef.current = true;
      try {
        await callbackRef.current();
      } catch {
        // Silent — see doc comment above.
      } finally {
        inFlightRef.current = false;
      }
    }

    const interval = setInterval(tick, intervalMs);

    function handleVisibility() {
      if (document.visibilityState === "visible") void tick();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs, enabled]);
}
