import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Mail, Newspaper } from "lucide-react";

export default function PressPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="Press" backHref="/" />

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-800 text-foreground">Press &amp; Media</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Rento is a vehicle rental platform connecting riders with verified local shops for
          bikes, scooties, and cars across India. We&apos;re happy to talk to journalists and
          researchers writing about mobility, the rental economy, or local marketplaces.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
            <Newspaper size={20} />
          </span>
          <p className="mt-3 text-sm font-700 text-foreground">Company boilerplate</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Rento is a vehicle rental marketplace live in Lucknow and Indore, expanding across six
            Indian cities. Shop owners list their bikes, scooties, and cars through the Rento
            Partner portal; every listing is reviewed before it reaches customers.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm font-700 text-foreground">Media inquiries</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            For interviews, data requests, or brand assets, reach out and we&apos;ll get back to
            you.
          </p>
          <a
            href="mailto:press@rento.com"
            className="btn-primary mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <Mail size={15} /> press@rento.com
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
