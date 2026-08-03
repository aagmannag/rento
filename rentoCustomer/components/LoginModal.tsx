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
    <div className="fixed inset-0 z-[90] flex items-end justify-center px-3 pb-3 pt-3 sm:items-center sm:px-4 sm:py-6">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeLoginModal}
        aria-hidden
      />
      <div className="relative max-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-card p-5 shadow-2xl sm:max-h-[90vh] sm:rounded-2xl sm:p-6">
        <button
          aria-label="Close"
          onClick={closeLoginModal}
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted sm:right-4 sm:top-4"
        >
          ✕
        </button>
        <AuthFlow onSuccess={closeLoginModal} />
      </div>
    </div>
  );
}
