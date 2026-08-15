"use client";

import { useState } from "react";
import { ChevronDown, LifeBuoy } from "lucide-react";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const FAQS = [
  {
    q: "How does booking a vehicle work?",
    a: "Pick a city, choose a category (Scooty, Bike, or Car), select a vehicle, and choose your rental dates — daily or hourly. You pay the rental cost online to confirm the booking, then collect the vehicle from the shop and pay the refundable security deposit there in cash or UPI.",
  },
  {
    q: "Why is the security deposit paid at the shop instead of online?",
    a: "The deposit is fully refundable and returned when you bring the vehicle back — collecting it in person at pickup lets the shop verify the vehicle's condition on return without needing a separate refund process.",
  },
  {
    q: "Can I cancel a booking?",
    a: "Yes. Cancel 6 hours or more before your pickup time and the rental cost paid online is refunded in full. Inside that window the refund tapers — 80% from 3 to 6 hours before pickup, 50% from 1 to 3 hours before, and nothing in the final hour. See our Cancellation Policy page for the full details.",
  },
  {
    q: "What happens if I return the vehicle late?",
    a: "Late returns are billed at 1.5× the daily rental rate for each additional hour past your scheduled return time.",
  },
  {
    q: "Who do the vehicles on Rento belong to?",
    a: "Every vehicle is listed by an independent local shop through the Rento Partner portal. Each shop is reviewed and approved by our team before their listings become visible to customers.",
  },
  {
    q: "Can I book more than one vehicle at a time?",
    a: "Yes — if a shop has multiple units of the same model, you can select a quantity when booking and rent them together in one trip.",
  },
  {
    q: "What if my city isn't live yet?",
    a: "Cities marked \"Soon\" are being onboarded — you can leave your phone number or email on that city's page and we'll notify you the moment it goes live.",
  },
];

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="Help Center" backHref="/" />

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-center gap-2 text-foreground">
          <LifeBuoy size={20} className="text-primary" />
          <h1 className="text-2xl font-800">Frequently asked questions</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Can&apos;t find what you&apos;re looking for?{" "}
          <a href="/contact" className="font-700 text-primary">Contact us</a> directly.
        </p>

        <div className="mt-6 space-y-3">
          {FAQS.map((faq, i) => {
            const open = openIndex === i;
            return (
              <div key={faq.q} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <span className="text-sm font-700 text-foreground">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && (
                  <div className="border-t border-border px-5 py-4 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
