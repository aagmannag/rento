import type { IconType } from "react-icons";
import { RiEBike2Line, RiMotorbikeLine } from "react-icons/ri";
import { PiCarProfileBold } from "react-icons/pi";
import type { Category } from "@/lib/types";

/** Single source of truth for the icon that represents each vehicle category.
 *  Every surface that shows a category — the homepage cards, the category picker,
 *  the listing tabs, and the photo placeholders on cards/galleries/bookings —
 *  renders through here, so a category's icon is changed in exactly one place. */
export const CATEGORY_ICON: Record<Category, IconType> = {
  Scooty: RiEBike2Line,
  Bike: RiMotorbikeLine,
  Car: PiCarProfileBold,
};

/** Categories can reach the UI as plain strings from the database or from a booking
 *  row written before a category existed, so never index the map blindly. */
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
  /** Provide only when the icon carries meaning on its own; otherwise it stays
   *  decorative and is hidden from screen readers (the label sits next to it). */
  title?: string;
}) {
  const Icon = getCategoryIcon(category);
  return <Icon size={size} className={className} title={title} aria-hidden={title ? undefined : true} />;
}

/** Fills a photo frame when a listing has no photo, or when the photo URL fails to
 *  load — an expired external link, a network hiccup, a misconfigured host. Keeps the
 *  frame looking intentional instead of showing a broken-image icon. */
export function CategoryPhotoPlaceholder({
  category,
  className = "",
  size = 56,
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
