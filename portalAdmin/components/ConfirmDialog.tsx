"use client";

import { useState } from "react";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  busy,
  requireReason,
  reasonLabel = "Reason",
  reasonPlaceholder = "Explain why…",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  const canConfirm = !requireReason || reason.trim().length >= 5;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-800 text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        {requireReason && (
          <div className="mt-4">
            <label className="field-label">{reasonLabel}</label>
            <textarea
              rows={3}
              className="input-field resize-none"
              placeholder={reasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="btn-outline flex-1 py-2.5 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(requireReason ? reason.trim() : undefined)}
            disabled={busy || !canConfirm}
            className={`flex-1 rounded-[var(--radius)] py-2.5 text-sm font-600 text-white transition active:scale-95 disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-700" : "btn-primary"
            }`}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
