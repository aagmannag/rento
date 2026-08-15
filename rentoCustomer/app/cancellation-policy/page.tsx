import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { CANCELLATION_TIERS, FREE_CANCELLATION_HOURS } from "@/lib/cancellationPolicy";

/** Presentation only — the hours and percentages themselves come from
 *  lib/cancellationPolicy.ts, which is what the app actually computes refunds with. */
const TONE: Record<number, { icon: typeof CheckCircle2; className: string; badge: string }> = {
  100: { icon: CheckCircle2, className: "text-green-600 bg-green-50", badge: "bg-green-100 text-green-700" },
  80: { icon: Clock, className: "text-amber-700 bg-amber-50", badge: "bg-amber-100 text-amber-800" },
  50: { icon: Clock, className: "text-orange-700 bg-orange-50", badge: "bg-orange-100 text-orange-800" },
  0: { icon: XCircle, className: "text-red-600 bg-red-50", badge: "bg-red-100 text-red-700" },
};

const FALLBACK_TONE = { icon: Clock, className: "text-muted-foreground bg-secondary", badge: "bg-secondary text-foreground" };

export default function CancellationPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="Cancellation Policy" backHref="/" />

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-800 text-foreground">Cancellation &amp; refund policy</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          How much of your rental cost comes back depends on how far ahead of your pickup time you
          cancel. Refunds apply only to the rental cost paid online — the security deposit is never
          charged online, so there&apos;s nothing to refund there.
        </p>

        <div className="mt-6 space-y-3">
          {CANCELLATION_TIERS.map((tier) => {
            const tone = TONE[tier.refundPercent] ?? FALLBACK_TONE;
            const Icon = tone.icon;
            return (
              <div
                key={tier.minHoursBefore}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.className}`}>
                  <Icon size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-700 text-foreground">{tier.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-800 ${tone.badge}`}>
                      {tier.refundPercent}% refund
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{tier.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <CheckCircle2 size={19} />
            </span>
            <div>
              <p className="text-sm font-700 text-foreground">If the shop cancels</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                If a shop can&apos;t honour your booking, you&apos;re refunded the full rental cost
                paid online no matter how close to pickup it happens. The tiers above apply only to
                cancellations you choose to make.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-700 text-foreground">Before you&apos;ve paid</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            A booking you haven&apos;t paid for online yet is only held for a few minutes. Nothing
            has been charged, so there&apos;s nothing to refund — leave it and the hold releases
            itself, freeing the vehicle for other customers.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-700 text-foreground">Late returns</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Vehicles returned after the scheduled return time are charged 1.5× the daily rental
            rate for each additional hour, payable directly at the shop.
          </p>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Refund amounts are worked out from your scheduled pickup time, so cancelling{" "}
          {FREE_CANCELLATION_HOURS} hours or more ahead always returns everything you paid online.
          To cancel, open the booking under{" "}
          <a href="/my-bookings" className="font-700 text-primary">My Bookings</a> and use
          &ldquo;Cancel booking&rdquo; — you&apos;ll see exactly what you get back before you
          confirm. Once your pickup time has passed a booking can no longer be cancelled online;{" "}
          <a href="/contact" className="font-700 text-primary">contact support</a> with your
          booking ID instead. Refunds are returned to the account you paid from.
        </p>
      </main>

      <Footer />
    </div>
  );
}
