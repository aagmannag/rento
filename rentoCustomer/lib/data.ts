import { City, Category, Vehicle } from "./types";

export const CITIES: City[] = ["Lucknow", "Indore", "Goa", "Haridwar", "Rishikesh", "Bangalore"];

// Cities with live, bookable inventory. Everything else in CITIES renders a "Coming Soon" state.
export const LIVE_CITIES: City[] = ["Lucknow", "Indore"];

export function isCityLive(city: City): boolean {
  return LIVE_CITIES.includes(city);
}

// Icons for these live in components/CategoryIcon.tsx — the single source of truth for
// category iconography across the app.
export const CATEGORIES: { key: Category; label: string; blurb: string }[] = [
  { key: "Scooty", label: "Scooty", blurb: "Easy to ride, perfect for the city" },
  { key: "Bike", label: "Bike", blurb: "For longer rides & highways" },
  { key: "Car", label: "Car", blurb: "Comfortable rides for groups & families" },
];

/** Legacy: the only remaining consumer is the `vehicleImage` string persisted on a
 *  booking row. Nothing renders it any more — every surface draws CategoryIcon from
 *  the vehicle's/booking's category instead, so old rows with emoji still display
 *  correctly. */
export const CATEGORY_EMOJI: Record<Category, string> = {
  Scooty: "🛵",
  Bike: "🏍️",
  Car: "🚗",
};

export const CITY_META: Record<City, { tagline: string; image: string }> = {
  Lucknow: {
    tagline: "City tours & heritage rides",
    image: "https://res.cloudinary.com/djkss2ach/image/upload/v1785759835/rento/customer/cities/lucknow.png",
  },
  Indore: {
    tagline: "Food trails & weekend getaways",
    image: "https://res.cloudinary.com/djkss2ach/image/upload/v1785759836/rento/customer/cities/indore.jpg",
  },
  Goa: { tagline: "Beach hopping & coastal drives", image: "/images/cities/goa.jpg" },
  Haridwar: { tagline: "Ghat visits & Rishikesh day trips", image: "/images/cities/haridwar.png" },
  Rishikesh: { tagline: "Adventure trails & ashram hopping", image: "/images/cities/rishikesh.png" },
  Bangalore: { tagline: "Tech parks, gardens & weekend getaways", image: "/images/cities/bangalore.png" },
};

// All vehicle inventory now comes from real shop owners via the Partner portal
// (see lib/partnerDb.ts) — there is no built-in demo catalog anymore. These functions
// stay in place as the "static half" of the merge that app/providers.tsx does with
// live partner data, so every page that calls them keeps working; they just always
// contribute zero vehicles from this module.
export const VEHICLES: Vehicle[] = [];

export function getVehiclesFor(city: City, category: Category) {
  return VEHICLES.filter((v) => v.city === city && v.category === category);
}

export function getVehicleById(id: string) {
  return VEHICLES.find((v) => v.id === id);
}

/** Total fleet size (sum of stock units, not distinct models) for a city. */
export function getVehicleCountForCity(city: City): number {
  return VEHICLES.filter((v) => v.city === city).reduce((sum, v) => sum + v.stock, 0);
}

export function getMinPriceForCategory(category: Category): number | null {
  const prices = VEHICLES.filter((v) => v.category === category).map((v) => v.pricePerDay);
  return prices.length ? Math.min(...prices) : null;
}

export const TOTAL_VEHICLE_COUNT = VEHICLES.reduce((sum, v) => sum + v.stock, 0);
