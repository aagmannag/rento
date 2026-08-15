"use client";

import { useEffect, useRef } from "react";

/**
 * Background auto-refresh for data that can change from OUTSIDE this tab — another
 * portal verifying a payment, a shop owner marking a booking Completed, another
 * customer booking the last unit of a vehicle, etc. Polling (not push) is a deliberate
 * choice: this app deploys to serverless hosting with no persistent WebSocket/SSE
 * server, so a short interval is the pragmatic way to get "no manual reload needed"
 * without standing up new infrastructure.
 *
 * Edge cases this handles so polling never becomes a burden rather than a convenience:
 *   - Paused entirely while the tab is hidden (visibilitychange) — a backgrounded tab
 *     costs nothing, matching how refreshPartnerVehicles' focus-listener already
 *     behaves elsewhere in this app.
 *   - Fires once immediately on becoming visible again, so switching back to the tab
 *     shows fresh data right away instead of waiting up to a full interval.
 *   - Skipped while offline (navigator.onLine === false) — no point queuing failed
 *     requests against a network that isn't there.
 *   - Never overlaps itself: if a tick is still in flight when the next one would
 *     fire, that tick is skipped rather than piling up concurrent requests.
 *   - Failures are swallowed (not surfaced as UI errors) — a single missed poll isn't
 *     worth interrupting the user with an error banner; the next tick just tries again.
 *     Callers that need to show a real error still do so on their own initial load.
 *
 * `callback` is called with no expectation of a return value being used — pass an
 * already-stable function (e.g. a useCallback from the caller) so the effect doesn't
 * pointlessly reset the interval on every render.
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
        // Silent — a background poll failing shouldn't interrupt the user; the next
        // tick (or the next visibility-triggered refresh) just tries again.
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
