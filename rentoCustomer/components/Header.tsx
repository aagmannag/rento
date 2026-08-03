"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function Header({
  title,
  showBack = true,
  backHref,
  right,
}: {
  title: string;
  showBack?: boolean;
  backHref?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-screen-xl items-center gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        {showBack && (
          <button
            aria-label="Go back"
            onClick={() => (backHref ? router.push(backHref) : router.back())}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="flex-1 truncate text-base font-800 text-foreground sm:text-lg">{title}</h1>
        {right}
      </div>
    </div>
  );
}
