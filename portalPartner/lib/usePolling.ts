"use client";

import { useEffect, useRef } from "react";

/**
 * Background auto-refresh for data that can change from OUTSIDE this tab — a customer
 * booking a vehicle, an admin verifying/rejecting a payment, another tab/device this
 * owner has open editing the same booking, etc. Polling (not push) is a deliberate
 * choice: this app deploys to serverless hosting with no persistent WebSocket/SSE
 * server, so a short interval is the pragmatic way to get "no manual reload needed"
 * without standing up new infrastructure. Mirrors rentoCustomer's identical hook.
 *
 * Edge cases this handles so polling never becomes a burden rather than a convenience:
 *   - Paused entirely while the tab is hidden (visibilitychange costs nothing while
 *     backgrounded).
 *   - Fires once immediately on becoming visible again, so switching back to the tab
 *     shows fresh data right away instead of waiting up to a full interval.
 *   - Skipped while offline (navigator.onLine === false).
 *   - Never overlaps itself: if a tick is still in flight when the next one would
 *     fire, that tick is skipped rather than piling up concurrent requests.
 *   - Failures are swallowed (not surfaced as UI errors) — a single missed poll isn't
 *     worth interrupting the owner with an error; the next tick just tries again.
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
