"use client";

import { useEffect } from "react";
import AuthFlow from "./AuthFlow";
import { useApp } from "@/app/providers";

export default function LoginModal() {
  const { loginModalOpen, closeLoginModal } = useApp();

  useEffect(() => {
    if (!loginModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLoginModal();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [loginModalOpen, closeLoginModal]);

  if (!loginModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeLoginModal}
        aria-hidden
      />
      <div className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
        <button
          aria-label="Close"
          onClick={closeLoginModal}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
        >
          ✕
        </button>
        <AuthFlow onSuccess={closeLoginModal} />
      </div>
    </div>
  );
}
