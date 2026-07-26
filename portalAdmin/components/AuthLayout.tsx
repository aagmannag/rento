import Image from "next/image";
import { ClipboardCheck, ShieldCheck, Users } from "lucide-react";

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="hero-gradient relative hidden w-[42%] flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10" />

        <div className="relative flex items-center gap-2.5">
          <Image src="/images/logo.png" alt="Rento" width={36} height={36} className="rounded-lg" />
          <span className="text-xl font-800 tracking-tight">Rento Admin</span>
        </div>

        <div className="relative">
          <h1 className="text-hero-xl font-800 leading-tight">
            Keep the marketplace trustworthy
          </h1>
          <p className="text-hero-sub mt-4 max-w-md text-white/90">
            Review new shop owner registrations, verify their details, and control which
            listings customers see across Rento.
          </p>

          <div className="mt-10 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                <ClipboardCheck size={17} />
              </span>
              <p className="text-sm font-600 text-white/90">Approve or reject shop owner applications</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Users size={17} />
              </span>
              <p className="text-sm font-600 text-white/90">Suspend or reinstate shops at any time</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                <ShieldCheck size={17} />
              </span>
              <p className="text-sm font-600 text-white/90">Moderate individual vehicle listings</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-white/70">© {new Date().getFullYear()} Rento. Internal use only.</p>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Image src="/images/logo.png" alt="Rento" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-800 tracking-tight text-foreground">Rento Admin</span>
          </div>

          <h2 className="text-2xl font-800 tracking-tight text-foreground">{title}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
