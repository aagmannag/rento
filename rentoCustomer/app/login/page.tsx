"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import AuthFlow from "@/components/AuthFlow";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <AuthFlow onSuccess={() => router.replace(redirectTo)} />
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
