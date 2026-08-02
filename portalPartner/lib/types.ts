export const CITIES = [
  "Lucknow",
  "Indore",
  "Goa",
  "Haridwar",
  "Rishikesh",
  "Bangalore",
] as const;

export type City = (typeof CITIES)[number];

export type Category = "Scooty" | "Bike" | "Car";

export const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: "Scooty", label: "Scooty", emoji: "🛵" },
  { key: "Bike", label: "Bike", emoji: "🏍️" },
  { key: "Car", label: "Car", emoji: "🚗" },
];

export type FuelType = "Petrol" | "Diesel" | "Electric" | "CNG";
export type Transmission = "Manual" | "Automatic";
export type VehicleStatus = "Active" | "Inactive";

export type OwnerApprovalStatus = "Pending" | "Approved" | "Rejected" | "Suspended";

export interface ShopOwner {
  id: string;
  ownerName: string;
  shopName: string;
  email: string;
  phone: string;
  city: City | string;
  address: string;
  pincode: string | null;
  /** Precise pickup coordinates from "Use My Current Location" on the Shop Profile page.
   *  Null until the owner sets it — customer-facing map falls back to geocoding `address`. */
  latitude: number | null;
  longitude: number | null;
  /** Set by the Admin portal. Vehicles only reach customers once this is 'Approved'. */
  status: OwnerApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface VehicleSpecs {
  fuel: FuelType;
  transmission: Transmission;
  seats: number;
  mileage: string;
}

export interface Vehicle {
  id: string;
  ownerId: string;
  category: Category;
  name: string;
  brand: string;
  engineLabel: string;
  photoUrl: string | null;
  /** Full gallery, in display order — photoUrls[0] is the cover image customers see first
   *  (also mirrored into photoUrl for apps that only read the single legacy column). */
  photoUrls: string[];
  pricePerDay: number;
  pricePerHour: number;
  securityDeposit: number;
  stock: number;
  /** Units not currently tied up in an Upcoming booking — only populated on the "My
   *  Vehicles" list (getVehiclesForOwner); undefined elsewhere (create/edit forms
   *  don't need it). */
  availableStock?: number;
  specs: VehicleSpecs;
  features: string[];
  description: string | null;
  city: City | string;
  status: VehicleStatus;
  createdAt: string;
}

export type BookingStatus = "Upcoming" | "Completed" | "Cancelled";
export type PaymentStatus = "Pending" | "Submitted" | "Verified" | "Rejected";

export interface Booking {
  id: string;
  ownerId: string;
  vehicleId: string;
  vehicleName: string;
  vehiclePhotoUrl: string | null;
  customerName: string;
  customerPhone: string;
  pickupDateTime: string;
  returnDateTime: string;
  quantity: number;
  totalAmount: number;
  status: BookingStatus;
  /** Set by the customer (via rentoCustomer) and verified by Rento's admin team —
   *  check this before handing over the vehicle. */
  paymentStatus: PaymentStatus;
  utrNumber: string | null;
  createdAt: string;
}

export const FEATURE_SUGGESTIONS: Record<Category, string[]> = {
  Scooty: [
    "External Fuel Fill",
    "LED Headlamp",
    "Mobile Charging Port",
    "Digital Speedometer",
    "Under-seat Storage",
    "Tubeless Tyres",
  ],
  Bike: [
    "ABS Braking",
    "LED Headlamp",
    "Digital Console",
    "USB Charging Port",
    "Alloy Wheels",
    "Dual Channel ABS",
  ],
  Car: [
    "Air Conditioning",
    "Power Steering",
    "Bluetooth Audio",
    "Reverse Parking Camera",
    "Airbags",
    "Power Windows",
    "Cruise Control",
    "Sunroof",
  ],
};
