"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { useAdmin } from "@/app/providers";
import { passwordIssue, isValidEmail } from "@/lib/validation";

async function readJsonResponse(res: Response): Promise<{ error?: string; admin?: unknown; needsSetup?: boolean }> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as { error?: string; admin?: unknown; needsSetup?: boolean };
  } catch {
    return { error: text };
  }
}

export default function SetupPage() {
  const router = useRouter();
  const { setAdmin } = useAdmin();

  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    fetch("/api/setup")
      .then((res) => readJsonResponse(res))
      .then((data: { needsSetup: boolean }) => {
        if (!data.needsSetup) {
          router.replace("/login");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Enter your full name";
    if (!isValidEmail(email)) next.email = "Enter a valid email address";
    const pwIssue = passwordIssue(password);
    if (pwIssue) next.password = pwIssue;
    if (confirmPassword !== password) next.confirmPassword = "Passwords don't match";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setAdmin(data.admin);
      router.push("/");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <AuthLayout
      title="Create the first admin account"
      subtitle="This one-time setup is only available until an admin account exists."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="field-label" htmlFor="name">Your full name</label>
          <input
            id="name"
            className="input-field"
            placeholder="e.g. Aditi Rao"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((er) => ({ ...er, name: "" }));
            }}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        <div>
          <label className="field-label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            className="input-field"
            placeholder="you@rento.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((er) => ({ ...er, email: "" }));
            }}
          />
          {errors.email && <p className="field-error">{errors.email}</p>}
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
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((er) => ({ ...er, password: "" }));
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted"
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
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((er) => ({ ...er, confirmPassword: "" }));
              }}
            />
            {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
          </div>
        </div>

        {serverError && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-600 text-red-600">{serverError}</div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-sm">
          {submitting ? "Creating account…" : "Create admin account"}
        </button>
      </form>
    </AuthLayout>
  );
}
