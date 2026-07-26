import { Navigation } from "lucide-react";
import type { Shop } from "@/lib/types";

/**
 * Google's no-API-key embed/directions URL scheme — works for any shop, whether or not
 * the owner has set a precise pin. Falls back to geocoding the free-text address when
 * latitude/longitude aren't set (older shop accounts predating this feature).
 */
function embedSrc(shop: Shop) {
  const query =
    shop.latitude != null && shop.longitude != null ? `${shop.latitude},${shop.longitude}` : shop.address;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

function directionsUrl(shop: Shop) {
  const destination =
    shop.latitude != null && shop.longitude != null ? `${shop.latitude},${shop.longitude}` : shop.address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Embedded map + "Get Directions" link for a shop's pickup location — shown wherever a
 *  customer needs to find their way there (vehicle detail, booking, confirmation). */
export default function PickupLocationMap({ shop }: { shop: Shop }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <iframe
        src={embedSrc(shop)}
        className="h-44 w-full border-0"
        loading="lazy"
        title={`Map showing ${shop.name}`}
      />
      <a
        href={directionsUrl(shop)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 border-t border-border bg-card py-2 text-xs font-700 text-primary transition hover:bg-muted"
      >
        <Navigation size={13} /> Get Directions
      </a>
    </div>
  );
}
