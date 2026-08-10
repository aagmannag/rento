import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

const RULES = [
  {
    icon: CheckCircle2,
    tone: "text-green-600 bg-green-50",
    title: "24 hours or more before pickup",
    desc: "Cancel any time up to 24 hours before your scheduled pickup and get a full refund of the rental cost paid online.",
  },
  {
    icon: Clock,
    tone: "text-amber-700 bg-amber-50",
    title: "Less than 24 hours before pickup",
    desc: "Cancellations inside the 24-hour window are non-refundable, since the shop has already held the vehicle for you.",
  },
  {
    icon: XCircle,
    tone: "text-red-600 bg-red-50",
    title: "No-shows",
    desc: "If a vehicle isn't collected by 2 hours past the scheduled pickup time with no cancellation, the booking is treated as a no-show and is non-refundable.",
  },
];

export default function CancellationPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="Cancellation Policy" backHref="/" />

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-800 text-foreground">Cancellation &amp; refund policy</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Only the rental cost paid online is affected by cancellations — the security deposit is
          never charged online, so there&apos;s nothing to refund there.
        </p>

        <div className="mt-6 space-y-3">
          {RULES.map((rule) => (
            <div key={rule.title} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${rule.tone}`}>
                <rule.icon size={19} />
              </span>
              <div>
                <p className="text-sm font-700 text-foreground">{rule.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{rule.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm font-700 text-foreground">Late returns</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Vehicles returned after the scheduled return time are charged 1.5× the daily rental
            rate for each additional hour, payable directly at the shop.
          </p>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          To cancel a booking, find it under{" "}
          <a href="/my-bookings" className="font-700 text-primary">My Bookings</a> and{" "}
          <a href="/contact" className="font-700 text-primary">contact support</a> with your
          booking ID — we&apos;ll process the cancellation and refund for you.
        </p>
      </main>

      <Footer />
    </div>
  );
}
