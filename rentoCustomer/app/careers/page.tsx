import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Heart, Mail, Users } from "lucide-react";

const CULTURE = [
  { icon: Users, title: "Small team, real ownership", desc: "Everyone works close to the customer — support tickets, shop calls, product decisions." },
  { icon: Heart, title: "Built for riders and shop owners alike", desc: "We ship features that make both sides of the marketplace better, not just one." },
];

export default function CareersPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="Careers" backHref="/" />

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-800 text-foreground">Join us in building Rento</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We&apos;re a small team focused on making vehicle rental simple across India&apos;s
          cities. Here&apos;s a bit about how we work.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CULTURE.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <c.icon size={20} />
              </span>
              <p className="mt-3 text-sm font-700 text-foreground">{c.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm font-700 text-foreground">No open positions right now</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            We&apos;re not actively hiring at the moment, but we&apos;re always glad to hear from
            people who want to build something useful. Send us a note and we&apos;ll keep it on
            file for when a role opens up.
          </p>
          <a
            href="mailto:careers@rento.com"
            className="btn-primary mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <Mail size={15} /> careers@rento.com
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
