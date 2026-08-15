"use client";

import { useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import type { Booking, BookingRating } from "@/lib/types";

/**
 * One star-rating form for one target ("partner" or "platform") on one booking. Two
 * independent instances of this render side by side on the confirmation page for a
 * Completed+Verified booking — each submits and completes on its own; rating one does
 * not require rating the other.
 */
export default function RatingForm({
  bookingId,
  target,
  title,
  description,
  existingRating,
  onSubmitted,
}: {
  bookingId: string;
  target: "partner" | "platform";
  title: string;
  description: string;
  /** undefined = not yet known (shouldn't render), null = eligible but not yet rated,
   *  present = already rated. */
  existingRating: BookingRating | null | undefined;
  onSubmitted: (booking: Booking) => void;
}) {
  const { showToast } = useToast();
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (existingRating) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="shrink-0 text-green-600" />
          <p className="text-sm font-700 text-green-800">{title} — thanks for your feedback!</p>
        </div>
        <div className="mt-2 flex items-center gap-1" aria-label={`You rated ${existingRating.stars} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={18}
              className={n <= existingRating.stars ? "fill-green-600 text-green-600" : "text-green-200"}
            />
          ))}
        </div>
        {existingRating.comment && <p className="mt-1.5 text-xs text-green-700">&ldquo;{existingRating.comment}&rdquo;</p>}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stars < 1) {
      setError("Choose a star rating from 1 to 5 first.");
      return;
    }
    // A comment is mandatory for anything less than a perfect rating — 5 stars has no
    // comment field at all (nothing to explain), but 1-4 stars needs to say what fell
    // short before it can be submitted.
    if (stars < 5 && !comment.trim()) {
      setError("Please add a comment explaining your rating before submitting.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      // A perfect 5-star rating has no comment field to begin with (see below), but
      // guard here too rather than trusting the UI state alone — if stars ever ends up
      // at 5 (e.g. changed after typing a comment at a lower rating), no comment is
      // sent regardless of whatever text might still be sitting in local state.
      const res = await fetch(`/api/bookings/${bookingId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, stars, comment: stars === 5 ? undefined : comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't submit your rating");
      onSubmitted(data.booking);
      showToast("Thanks for your feedback!", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your rating");
    } finally {
      setSubmitting(false);
    }
  }

  const activeCount = hovered || stars;

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <p className="text-sm font-700 text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>

      <div role="group" aria-label={`${title} — star rating`} className="mt-3 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={stars >= n}
            onClick={() => {
              setStars(n);
              setError("");
            }}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onFocus={() => setHovered(n)}
            onBlur={() => setHovered(0)}
            className="rounded-md p-0.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Star size={26} className={n <= activeCount ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"} />
          </button>
        ))}
      </div>

      {/* A perfect 5-star rating skips the comment box entirely — nothing to explain.
          1-4 stars opens it AND makes it mandatory (see handleSubmit) so the customer
          has to say what fell short before submitting. Not shown at all before any
          star is picked (stars === 0), since there's nothing to comment on yet.
          Comment text typed at a lower rating is preserved (not cleared) if the
          customer flips between star values — only actually sent on submit when
          stars < 5, so accidentally tapping 5 and back never loses a draft. */}
      {stars >= 1 && stars <= 4 && (
        <label className="mt-3 block">
          <span className="text-xs font-600 text-muted-foreground">
            What could have been better? <span className="text-red-500">*</span>
          </span>
          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (e.target.value.trim()) setError("");
            }}
            maxLength={500}
            rows={2}
            placeholder="Tell us more about your experience…"
            className="mt-1 w-full resize-none rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </label>
      )}

      {error && <p className="mt-2 text-xs font-600 text-red-500">{error}</p>}

      <button type="submit" disabled={submitting} className="btn-primary mt-3 w-full py-2.5 text-sm">
        {submitting ? "Submitting…" : "Submit rating"}
      </button>
    </form>
  );
}
