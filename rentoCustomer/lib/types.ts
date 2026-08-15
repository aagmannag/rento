export type City = "Lucknow" | "Indore" | "Goa" | "Haridwar" | "Rishikesh" | "Bangalore";

export type Category = "Scooty" | "Bike" | "Car";

export interface Shop {
  name: string;
  address: string;
  /** Precise pickup coordinates set by the shop owner. Null falls back to geocoding `address`. */
  latitude?: number | null;
  longitude?: number | null;
  /** Only ever populated on a Booking's shop (frozen at booking time) — deliberately
   *  never set on a Vehicle's shop (the public, pre-booking listing), so a shop owner's
   *  number isn't exposed to anonymous browsing before a customer has actually booked.
   *  Undefined/null both mean "not available" (either this is a pre-booking listing, or
   *  the booking predates this field — see CustomerBooking.shopPhone). */
  phone?: string | null;
}

export interface Vehicle {
  id: string;
  city: City;
  category: Category;
  name: string;
  brand: string;
  engineLabel: string;
  image: string;
  photo?: string;
  /** Full gallery in display order, resolved to absolute URLs — photos[0] is the cover
   *  (same as `photo`). Empty for legacy listings created before multi-photo support. */
  photos: string[];
  pricePerDay: number;
  pricePerHour: number;
  securityDeposit: number;
  /** Total number of identical units of this model the shop owns at this city. */
  stock: number;
  /** Units not currently tied up in an Upcoming booking by ANY customer — computed
   *  server-side so it stays correct across browsers/devices/sessions, not just the
   *  current user's own bookings. */
  availableStock: number;
  rating: number;
  ratingCount: number;
  specs: {
    fuel: string;
    transmission: string;
    seats: number;
    mileage: string;
  };
  features: string[];
  shop: Shop;
}

export type Gender = "Male" | "Female" | "Other" | "Prefer not to say";

export interface User {
  id?: string;
  phone: string;
  name: string;
  gender?: Gender;
  city?: string;
  isLoggedIn: boolean;
  /** The customer's own received rating (from shop owners) — null until they've
   *  received at least one CustomerRating. */
  rating?: { value: number; count: number } | null;
}

export type RentalMode = "Daily" | "Hourly";

export type PaymentStatus = "Pending" | "Submitted" | "Verified" | "Rejected" | "Expired";

export interface BookingRating {
  stars: number;
  comment?: string | null;
}

export interface Booking {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleImage: string;
  vehiclePhoto?: string;
  city: City;
  category: Category;
  shop: Shop;
  rentalMode: RentalMode;
  pickupDateTime: string;
  returnDateTime: string;
  days: number;
  hours: number;
  /** Number of identical units of this model booked together in this single booking. */
  quantity: number;
  pricePerDay: number;
  pricePerHour: number;
  rentalCost: number;
  securityDeposit: number;
  totalPayableOnline: number;
  totalPayableAtShop: number;
  status: "Upcoming" | "Completed" | "Cancelled";
  paymentStatus: PaymentStatus;
  utrNumber?: string;
  paymentScreenshotUrl?: string;
  /** Set by the admin when rejecting a payment submission. */
  paymentNote?: string | null;
  createdAt: string;
  /** Set together, and only on the transition into Cancelled — all null on a booking
   *  that was never cancelled. The refund quote is frozen at cancel time because it
   *  depends on how long before pickup the cancellation happened, which can't be
   *  recovered afterwards (see lib/cancellationPolicy.ts). */
  cancelledAt?: string | null;
  cancelledBy?: "customer" | "shop" | null;
  refundPercent?: number | null;
  refundAmount?: number | null;
  /** Only ever populated when status is Completed and paymentStatus is Verified (see
   *  rentoCustomer's isRateable()) — undefined means "not fetched/not eligible", null
   *  means "eligible but not yet rated", present means "already rated". */
  partnerRating?: BookingRating | null;
  platformRating?: BookingRating | null;
}
