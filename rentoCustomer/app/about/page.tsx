import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ShieldCheck, Users, MapPin, Sparkles } from "lucide-react";
import { CITIES } from "@/lib/data";

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Trust, first",
    desc: "Every vehicle listed on Rento goes through a shop-level verification before it ever reaches a customer.",
  },
  {
    icon: Sparkles,
    title: "Transparent pricing",
    desc: "The price you see is the price you pay — rental cost online, refundable deposit at the shop, no hidden fees.",
  },
  {
    icon: Users,
    title: "Built for local shops",
    desc: "Rento exists to help independent rental shops reach more riders, not to replace them with a faceless fleet.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="About Us" backHref="/" />

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-800 text-foreground">Renting a ride shouldn&apos;t be complicated</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Rento connects riders with verified local shops renting bikes, scooties, and cars —
          starting with Lucknow and Indore, and expanding across {CITIES.length} cities. We built
          it because booking a vehicle for a trip usually means a dozen phone calls to shops that
          may or may not have what you need, at a price that may or may not be what they quoted
          in person. Rento puts real-time availability, transparent pricing, and instant
          confirmation in one place.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <v.icon size={20} />
              </span>
              <p className="mt-3 text-sm font-700 text-foreground">{v.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{v.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <MapPin size={16} className="text-primary" /> {CITIES.length} cities on the roadmap
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Sparkles size={16} className="text-primary" /> New shops onboarding every week
          </div>
        </div>

        <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
          Rento is run by a small team based in India. If you&apos;re a rental shop owner and
          want to list your fleet, head to the{" "}
          <a href="http://localhost:3001" className="font-700 text-primary">Rento Partner portal</a>{" "}
          to get started, or reach out via our <a href="/contact" className="font-700 text-primary">Contact page</a>.
        </p>
      </main>

      <Footer />
    </div>
  );
}
