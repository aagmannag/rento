import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const SECTIONS = [
  {
    title: "1. Using Rento",
    body: "Rento is a marketplace connecting customers with independent vehicle rental shops. By booking through Rento, you agree to provide accurate identity and contact details and to use rented vehicles only as permitted by applicable traffic law.",
  },
  {
    title: "2. Bookings & payment",
    body: "The rental cost shown at booking is paid online to confirm your reservation. The security deposit is separate, fully refundable, and collected in cash or UPI directly at the pickup shop — never charged online.",
  },
  {
    title: "3. Security deposit",
    body: "The deposit is refunded when the vehicle is returned in the condition it was collected in, subject to the pickup shop's inspection. Damage beyond normal wear may be deducted from the deposit.",
  },
  {
    title: "4. Cancellations & late returns",
    body: "See our Cancellation Policy for refund eligibility. Vehicles returned later than the scheduled return time are billed at 1.5× the daily rate per additional hour.",
  },
  {
    title: "5. Shop responsibilities",
    body: "Shops listing vehicles on Rento are independently reviewed and approved before their listings go live, and are responsible for the roadworthiness, insurance, and registration of the vehicles they list.",
  },
  {
    title: "6. Your data",
    body: "We collect the information needed to create your account and process bookings — name, phone number, and booking history. We don't sell your data to third parties. Session information is stored to keep you signed in across visits.",
  },
  {
    title: "7. Changes to these terms",
    body: "We may update these terms as Rento grows. Continued use of the platform after an update means you accept the revised terms.",
  },
];

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="Terms & Privacy" backHref="/" />

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-800 text-foreground">Terms of Service &amp; Privacy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated 24 July 2026</p>

        <div className="mt-6 space-y-5">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <p className="text-sm font-700 text-foreground">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Questions about these terms? <a href="/contact" className="font-700 text-primary">Contact us</a>.
        </p>
      </main>

      <Footer />
    </div>
  );
}
