export const UPI_ID = "aagmannag@oksbi";
export const UPI_PAYEE_NAME = "Rento";

/**
 * A UPI deep link — opening this on a phone with a UPI app installed (GPay, PhonePe,
 * Paytm, BHIM) pre-fills the payee, amount, and a note, so the customer just has to
 * confirm rather than type anything in. Desktop browsers can't act on this scheme at
 * all (no UPI app to hand it to), so callers should only surface it as a tappable
 * button on mobile and rely on the QR code otherwise.
 */
export function buildUpiLink(amount: number, note: string): string {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: UPI_PAYEE_NAME,
    am: String(amount),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}
