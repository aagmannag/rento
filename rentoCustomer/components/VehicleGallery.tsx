"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Main image + thumbnail strip for a vehicle's photo gallery. Falls back to the
 *  category emoji when there are zero photos (legacy listings predating multi-photo
 *  support) — never a broken image. */
export default function VehicleGallery({
  photos,
  name,
  fallbackEmoji,
}: {
  photos: string[];
  name: string;
  fallbackEmoji: string;
}) {
  const [index, setIndex] = useState(0);
  // A photo can fail to load for reasons outside our control — an expired external
  // link, a network hiccup, a misconfigured host — falling back to the category emoji
  // keeps the gallery looking intentional instead of showing a broken-image icon.
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());
  const markBroken = (url: string) =>
    setBrokenUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  const hasPhotos = photos.length > 0;
  const active = hasPhotos ? Math.min(index, photos.length - 1) : 0;
  const activeUrl = hasPhotos ? photos[active] : undefined;
  const activeBroken = activeUrl ? brokenUrls.has(activeUrl) : false;

  return (
    <div>
      <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-2xl bg-secondary text-8xl sm:h-80">
        {hasPhotos && !activeBroken && activeUrl ? (
          <>
            {/* Blurred, scaled-up copy of the same photo fills the frame with no hard
             *  edges — hides letterboxing from mismatched aspect ratios without ever
             *  cropping or stretching the real photo shown on top. */}
            <Image
              key={`${activeUrl}-backdrop`}
              src={activeUrl}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="scale-110 object-cover opacity-50 blur-2xl"
            />
            <Image
              key={activeUrl}
              src={activeUrl}
              alt={`${name} — photo ${active + 1}`}
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-contain"
              priority={active === 0}
              onError={() => markBroken(activeUrl)}
            />
          </>
        ) : (
          fallbackEmoji
        )}

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % photos.length)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            >
              <ChevronRight size={20} />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-700 text-white">
              {active + 1}/{photos.length}
            </span>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`View photo ${i + 1}`}
              className={`relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-secondary text-xl transition ${
                i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {brokenUrls.has(url) ? (
                fallbackEmoji
              ) : (
                <Image
                  src={url}
                  alt={`${name} — thumbnail ${i + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                  onError={() => markBroken(url)}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
