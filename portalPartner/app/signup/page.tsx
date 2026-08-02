"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useOwner } from "@/app/providers";
import { useToast } from "@/components/Toast";
import type { ShopOwner } from "@/lib/types";
import { CITIES } from "@/lib/types";
import { isValidEmail, isValidPhone, isValidPincode, passwordIssue } from "@/lib/validation";

async function readJsonResponse(res: Response): Promise<{ error?: string; owner?: unknown }> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as { error?: string; owner?: unknown };
  } catch {
    return { error: text };
  }
}

interface FormState {
  ownerName: string;
  shopName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  city: string;
  customCity: string;
  address: string;
  pincode: string;
}

const INITIAL: FormState = {
  ownerName: "",
  shopName: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  city: "",
  customCity: "",
  address: "",
  pincode: "",
};

export default function SignupPage() {
  const router = useRouter();
  const { setOwner } = useOwner();
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    const effectiveCity = form.city === "Other" ? form.customCity.trim() : form.city;

    if (form.ownerName.trim().length < 2) next.ownerName = "Enter your full name";
    if (form.shopName.trim().length < 2) next.shopName = "Enter your shop/business name";
    if (!isValidEmail(form.email)) next.email = "Enter a valid email address";
    const pwIssue = passwordIssue(form.password);
    if (pwIssue) next.password = pwIssue;
    if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords don't match";
    if (!isValidPhone(form.phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (!effectiveCity) next.city = "Select or enter your city";
    if (form.address.trim().length < 10) {
      next.address = "Enter the full address customers will pick up vehicles from";
    }
    if (form.pincode && !isValidPincode(form.pincode)) next.pincode = "Enter a valid 6-digit pincode";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: form.ownerName.trim(),
          shopName: form.shopName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone,
          city: form.city === "Other" ? form.customCity.trim() : form.city,
          address: form.address.trim(),
          pincode: form.pincode || undefined,
        }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setOwner(data.owner as ShopOwner | null);
      showToast("Account created — welcome to Rento!", "success");
      router.push("/");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="List your vehicles and start earning with Rento."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="ownerName">Your full name</label>
            <input
              id="ownerName"
              className="input-field"
              placeholder="e.g. Rahul Sharma"
              value={form.ownerName}
              onChange={(e) => set("ownerName", e.target.value)}
            />
            {errors.ownerName && <p className="field-error">{errors.ownerName}</p>}
          </div>
          <div>
            <label className="field-label" htmlFor="shopName">Shop / business name</label>
            <input
              id="shopName"
              className="input-field"
              placeholder="e.g. Sharma Bike Rentals"
              value={form.shopName}
              onChange={(e) => set("shopName", e.target.value)}
            />
            {errors.shopName && <p className="field-error">{errors.shopName}</p>}
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            className="input-field"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor="phone">Mobile number</label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-input px-3 focus-within:border-primary">
            <span className="text-sm font-600 text-muted-foreground">🇮🇳 +91</span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              className="w-full flex-1 bg-transparent py-3 text-sm outline-none"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </div>
          {errors.phone && <p className="field-error">{errors.phone}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="input-field pr-10"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="field-error">{errors.password}</p>}
          </div>
          <div>
            <label className="field-label" htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              className="input-field"
              placeholder="Re-enter password"
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
            />
            {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="city">City you operate in</label>
          <select
            id="city"
            className="input-field"
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          >
            <option value="">Select city</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="Other">Other</option>
          </select>
          {form.city === "Other" && (
            <input
              className="input-field mt-2"
              placeholder="Enter your city name"
              value={form.customCity}
              onChange={(e) => set("customCity", e.target.value)}
            />
          )}
          {errors.city && <p className="field-error">{errors.city}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor="address">
            Pickup location <span className="font-500 text-muted-foreground">(full address customers will collect vehicles from)</span>
          </label>
          <textarea
            id="address"
            rows={3}
            className="input-field resize-none"
            placeholder="Shop no., street, landmark, area — the exact spot customers should reach"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
          {errors.address && <p className="field-error">{errors.address}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor="pincode">Pincode <span className="font-500 text-muted-foreground">(optional)</span></label>
          <input
            id="pincode"
            inputMode="numeric"
            maxLength={6}
            className="input-field sm:max-w-[160px]"
            placeholder="e.g. 226001"
            value={form.pincode}
            onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          {errors.pincode && <p className="field-error">{errors.pincode}</p>}
        </div>

        {serverError && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-600 text-red-600">
            {serverError}
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-sm">
          {submitting ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-[11px] text-muted-foreground">
          By continuing, you agree to Rento&apos;s Terms &amp; Privacy Policy.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-700 text-primary">Log in</Link>
      </p>
    </AuthLayout>
  );
}
