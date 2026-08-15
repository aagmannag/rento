// UTR / transaction reference formats, by bank transfer rail. PaymentPanel's QR/UPI-link
// flow means most customers get back a 12-digit UPI reference number, but some UPI apps
// surface a longer bank-side reference instead, and a customer can always pay by
// scanning the same QR with a banking app that settles over IMPS/NEFT/RTGS rather than
// UPI — so every real-world format is accepted, not just UPI's. Shared between the
// client-side form (PaymentPanel.tsx, for instant feedback + maxLength) and the
// server-side check (lib/db.ts's submitBookingPayment) so the two can never drift apart.
export const UTR_FORMATS = [
  { name: "UPI", pattern: /^\d{12}$/, hint: "UPI: 12 numeric digits" },
  { name: "IMPS", pattern: /^\d{12,16}$/, hint: "IMPS: 12 to 16 digits" },
  { name: "NEFT", pattern: /^[A-Za-z0-9]{16}$/, hint: "NEFT: 16 alphanumeric characters (mix of letters and numbers)" },
  { name: "RTGS", pattern: /^[A-Za-z0-9]{22}$/, hint: "RTGS: 22 alphanumeric characters" },
] as const;

/** Longest of the accepted formats (RTGS, 22 chars) — the input's hard maxLength, so a
 *  customer physically can't type/paste past what any real reference number would ever
 *  be. Kept as a plain literal (rather than derived from UTR_FORMATS) since it only
 *  needs to change if a new format is added above, which should be a deliberate edit
 *  here anyway. */
export const UTR_MAX_LENGTH = 22;
/** Shortest of the accepted formats (UPI/IMPS, 12 chars) — used as the input's minLength. */
export const UTR_MIN_LENGTH = 12;

/** True if `value` matches at least one of the accepted transfer-rail formats above. */
export function isValidUtrFormat(value: string): boolean {
  const trimmed = value.trim();
  return UTR_FORMATS.some((f) => f.pattern.test(trimmed));
}
