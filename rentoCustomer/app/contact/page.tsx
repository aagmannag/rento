"use client";

import { useState } from "react";
import { Mail, MessageSquare, Send } from "lucide-react";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useToast } from "@/components/Toast";

export default function ContactPage() {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) return setError("Enter your name");
    if (contact.trim().length < 5) return setError("Enter a valid email or phone number");
    if (message.trim().length < 10) return setError("Enter a bit more detail so we can help");

    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), contact: contact.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setSent(true);
      showToast("Message sent — we'll get back to you soon.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="Contact Us" backHref="/" />

      <main className="mx-auto w-full max-w-screen-md flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-800 text-foreground">Get in touch</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Questions about a booking, a shop listing, or anything else — send us a message and
          we&apos;ll respond as soon as we can.
        </p>

        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
            <Mail size={17} />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Email us directly</p>
            <a href="mailto:support@rento.com" className="text-sm font-700 text-foreground">support@rento.com</a>
          </div>
        </div>

        {sent ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
            <p className="text-sm font-700 text-green-800">Thanks — your message is in!</p>
            <p className="mt-1 text-sm text-green-700">We typically reply within a business day.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 text-sm font-700 text-foreground">
              <MessageSquare size={16} className="text-primary" /> Send us a message
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-600 text-muted-foreground">Your name</span>
                <input
                  className="mt-1 w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  placeholder="e.g. Priya Verma"
                />
              </label>
              <label className="block">
                <span className="text-xs font-600 text-muted-foreground">Email or phone</span>
                <input
                  className="mt-1 w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                  value={contact}
                  onChange={(e) => { setContact(e.target.value); setError(""); }}
                  placeholder="you@example.com or 98765xxxxx"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-600 text-muted-foreground">Message</span>
              <textarea
                rows={4}
                className="mt-1 w-full resize-none rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm outline-none focus:border-primary"
                value={message}
                onChange={(e) => { setMessage(e.target.value); setError(""); }}
                placeholder="How can we help?"
              />
            </label>

            {error && <p className="text-xs font-600 text-red-500">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary flex items-center justify-center gap-2 px-5 py-2.5 text-sm">
              <Send size={15} /> {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </main>

      <Footer />
    </div>
  );
}
