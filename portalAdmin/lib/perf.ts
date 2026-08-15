// Lightweight per-request stage timing, matching the "[API] stage: Nms" format used in
// rentoCustomer's lib/perf.ts (same codebase, same convention) — deliberately simple, no
// external dependency, no persistence: this is for reading in server logs during
// development/debugging and for spotting regressions, not a metrics pipeline.
// Never pass anything sensitive (tokens, OTPs, payment details, PII) as a stage label;
// only durations and short static labels are logged.
export class RequestTimer {
  private readonly route: string;
  private readonly startedAt: number;
  private lastMark: number;

  constructor(route: string) {
    this.route = route;
    this.startedAt = Date.now();
    this.lastMark = this.startedAt;
  }

  /** Logs the time elapsed since the last mark() (or construction), then resets it. */
  mark(stage: string): void {
    const now = Date.now();
    console.log(`[API] ${this.route} ${stage}: ${now - this.lastMark}ms`);
    this.lastMark = now;
  }

  /** Logs total elapsed time since construction — call once, right before responding.
   *  Pass `onlyIfOverMs` on high-traffic routes to avoid logging every single request. */
  total(onlyIfOverMs?: number): void {
    const elapsed = Date.now() - this.startedAt;
    if (onlyIfOverMs !== undefined && elapsed < onlyIfOverMs) return;
    console.log(`[API] ${this.route} total: ${elapsed}ms`);
  }
}
