import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "./providers";
import { ToastProvider } from "@/components/Toast";
import LoginModal from "@/components/LoginModal";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Rento — Rent Bikes, Scooties & Cars Across India",
  description:
    "Book bikes, scooties, and cars in Lucknow, Indore, Goa, Haridwar & Rishikesh. Transparent pricing, no hidden charges, instant confirmation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <AppProvider>
          <ToastProvider>
            {children}
            <LoginModal />
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}
