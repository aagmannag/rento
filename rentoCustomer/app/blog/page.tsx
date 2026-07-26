import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Calendar } from "lucide-react";

const POSTS = [
  {
    title: "5 things to check before riding off on a rented scooty",
    date: "2026-06-12",
    excerpt:
      "A quick pre-ride checklist: fuel level, tyre pressure, both mirrors adjusted, brakes tested at low speed, and the helmet strap actually fastened. Small habits that make a rented ride feel like your own.",
  },
  {
    title: "Planning a weekend trip? Book your vehicle a day early",
    date: "2026-05-28",
    excerpt:
      "Weekend demand in most cities spikes on Thursday evenings. Booking a day ahead almost always gets you a better choice of vehicles and avoids the last-minute price bump some shops apply for same-day pickups.",
  },
  {
    title: "Daily vs. hourly rentals — which one actually saves you money",
    date: "2026-05-10",
    excerpt:
      "If you need a vehicle for more than 5-6 hours, daily pricing is almost always cheaper per hour than hourly. Hourly makes sense for quick errands; daily makes sense the moment your plans stretch into the evening.",
  },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="Blog" backHref="/" />

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-800 text-foreground">Notes from the road</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Practical tips for renting and riding, from the Rento team.
        </p>

        <div className="mt-6 space-y-4">
          {POSTS.map((post) => (
            <article key={post.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar size={12} /> {formatDate(post.date)}
              </div>
              <h2 className="mt-1.5 text-base font-700 text-foreground">{post.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
            </article>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
