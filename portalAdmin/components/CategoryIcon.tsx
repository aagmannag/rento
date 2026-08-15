import type { IconType } from "react-icons";
import { RiEBike2Line, RiMotorbikeLine } from "react-icons/ri";
import { PiCarProfileBold } from "react-icons/pi";
import type { Category } from "@/lib/types";

/** Single source of truth for the icon that represents each vehicle category —
 *  mirrors the same file in rentoCustomer and portalPartner so every portal shows
 *  the same icons for the same category. */
export const CATEGORY_ICON: Record<Category, IconType> = {
  Scooty: RiEBike2Line,
  Bike: RiMotorbikeLine,
  Car: PiCarProfileBold,
};

/** Categories reach the UI as plain strings from the database, so never index blindly. */
export function getCategoryIcon(category: string | null | undefined): IconType {
  if (category && Object.prototype.hasOwnProperty.call(CATEGORY_ICON, category)) {
    return CATEGORY_ICON[category as Category];
  }
  return PiCarProfileBold;
}

export default function CategoryIcon({
  category,
  size = 24,
  className,
  title,
}: {
  category: string | null | undefined;
  size?: number;
  className?: string;
  title?: string;
}) {
  const Icon = getCategoryIcon(category);
  return <Icon size={size} className={className} title={title} aria-hidden={title ? undefined : true} />;
}

/** Fills a photo frame when a listing has no photo, or its photo URL fails to load. */
export function CategoryPhotoPlaceholder({
  category,
  className = "",
  size = 20,
}: {
  category: string | null | undefined;
  className?: string;
  size?: number;
}) {
  const Icon = getCategoryIcon(category);
  return (
    <span
      className={`flex h-full w-full items-center justify-center text-muted-foreground ${className}`}
      aria-hidden
    >
      <Icon size={size} />
    </span>
  );
}
