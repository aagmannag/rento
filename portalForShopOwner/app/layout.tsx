import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { OwnerProvider } from "./providers";
import { ToastProvider } from "@/components/Toast";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Rento Partner — Manage Your Rental Fleet",
  description:
    "List bikes, scooties and cars, manage bookings, and track earnings on the Rento Partner portal for shop owners.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <ToastProvider>
          <OwnerProvider>{children}</OwnerProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
