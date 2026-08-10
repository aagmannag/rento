export type City = "Lucknow" | "Indore" | "Goa" | "Haridwar" | "Rishikesh" | "Bangalore";

export type Category = "Scooty" | "Bike" | "Car";

export interface Shop {
  name: string;
  address: string;
  /** Precise pickup coordinates set by the shop owner. Null falls back to geocoding `address`. */
  latitude?: number | null;
  longitude?: number | null;
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
}

export type RentalMode = "Daily" | "Hourly";

export type PaymentStatus = "Pending" | "Submitted" | "Verified" | "Rejected";

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
}
