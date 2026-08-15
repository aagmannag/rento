/** Shop phone numbers are always stored as a plain 10-digit Indian mobile number, no
 *  country code (see portalPartner's signup form) — formats it for display and for a
 *  `tel:` link. Falls back to the raw value for anything that doesn't match that shape
 *  (defensive: a legacy/manually-edited row could in principle hold something else)
 *  rather than mangling a number we don't recognize. Shared by the confirmation page and
 *  PaymentPanel so both format a shop's number identically. */
export function formatShopPhone(phone: string): { display: string; href: string } {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return { display: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`, href: `tel:+91${digits}` };
  }
  return { display: phone, href: `tel:${phone}` };
}
