"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export default function RateCustomerDialog({
  open,
  customerName,
  busy,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  customerName: string;
  busy?: boolean;
  onSubmit: (stars: number, comment: string) => void;
  onCancel: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  function handleSubmit() {
    if (stars < 1) {
      setError("Choose a star rating from 1 to 5 first.");
      return;
    }
    // A comment is mandatory for anything less than a perfect rating — 5 stars has no
    // comment field at all, but 1-4 stars needs a note on what went wrong before it
    // can be submitted.
    if (stars < 5 && !comment.trim()) {
      setError("Please add a comment explaining your rating before submitting.");
      return;
    }
    // Guarded again here rather than trusting UI state alone, so no leftover text is
    // ever sent for a 5-star rating regardless of how stars/comment got there.
    onSubmit(stars, stars === 5 ? "" : comment.trim());
  }

  const activeCount = hovered || stars;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-800 text-foreground">Rate {customerName}</h2>
        <p className="mt-2 text-sm text-muted-foreground">How was your experience with this customer?</p>

        <div role="group" aria-label="Star rating" className="mt-4 flex items-center gap-1.5">
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
              <Star size={28} className={n <= activeCount ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"} />
            </button>
          ))}
        </div>

        {/* A perfect 5-star rating skips the comment box — nothing to explain. 1-4
            stars opens it AND makes it mandatory (see handleSubmit) so the owner has to
            note what went wrong before submitting. Not shown before any star is picked.
            Typed text is preserved (not cleared) across star changes — only actually
            sent on submit when stars < 5, so tapping 5 and back never loses a draft. */}
        {stars >= 1 && stars <= 4 && (
          <label className="mt-4 block">
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
              placeholder="Any notes about this customer…"
              className="mt-1 w-full resize-none rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
        )}

        {error && <p className="mt-2 text-xs font-600 text-red-500">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="btn-outline flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={busy} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
            {busy ? "Submitting…" : "Submit rating"}
          </button>
        </div>
      </div>
    </div>
  );
}
