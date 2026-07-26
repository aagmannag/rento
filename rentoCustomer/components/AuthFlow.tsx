"use client";

import { useEffect, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { useApp } from "@/app/providers";

const RESEND_SECONDS = 30;
const OTP_LENGTH = 6;

function friendlyFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  // Surface the raw error for debugging — Firebase's error codes are specific enough
  // to diagnose config issues (unauthorized domain, phone auth not enabled, etc.)
  // and there's no server log to check for a client-side call like this one.
  console.error("Firebase phone auth error:", err);
  switch (code) {
    case "auth/invalid-phone-number":
      return "That phone number doesn't look right.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again in a few minutes.";
    case "auth/quota-exceeded":
      return "SMS quota exceeded for this project. Please try again later.";
    case "auth/invalid-verification-code":
      return "Incorrect OTP. Please try again.";
    case "auth/code-expired":
      return "This OTP has expired. Request a new one.";
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";
    case "auth/invalid-app-credential":
    case "auth/argument-error":
      return "Verification failed to initialize. Please refresh and try again.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized in Firebase. Add it under Authentication > Settings > Authorized domains.";
    case "auth/operation-not-allowed":
      return "Phone sign-in isn't enabled for this Firebase project yet. Enable it under Authentication > Sign-in method.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA verification failed. Refresh the page and try again.";
    case "auth/internal-error":
      return "Firebase rejected the request — this usually means the API key or project config is wrong.";
    default:
      return code ? `Something went wrong (${code}).` : "Something went wrong. Please try again.";
  }
}

export default function AuthFlow({ onSuccess }: { onSuccess: () => void }) {
  const { loginWithServerUser } = useApp();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    if (step !== "otp" || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, secondsLeft]);

  // Tear down the reCAPTCHA widget when this form goes away (e.g. modal closed).
  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  function isValidPhone(value: string) {
    return /^[6-9]\d{9}$/.test(value);
  }

  function getRecaptchaVerifier() {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptchaRef.current;
  }

  async function sendOtp() {
    setSending(true);
    setPhoneError("");
    try {
      const verifier = getRecaptchaVerifier();
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, verifier);
      confirmationRef.current = result;
      setStep("otp");
      setOtp(Array(OTP_LENGTH).fill(""));
      setOtpError("");
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setPhoneError(friendlyFirebaseError(err));
      // A spent/invalid widget can't be reused — recreate it on the next attempt.
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSending(false);
    }
  }

  function handleSendOtp() {
    if (!isValidPhone(phone)) {
      setPhoneError("Enter a valid 10-digit mobile number");
      return;
    }
    void sendOtp();
  }

  function handleResend() {
    if (secondsLeft > 0 || sending) return;
    void sendOtp();
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setOtpError("");
    if (value && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const entered = otp.join("");
    if (entered.length < OTP_LENGTH) {
      setOtpError(`Enter the ${OTP_LENGTH}-digit OTP`);
      return;
    }
    if (!confirmationRef.current) {
      setOtpError("This code has expired — please resend the OTP.");
      return;
    }

    setVerifying(true);
    setOtpError("");

    // Verifying the OTP with Firebase and creating our own server session are two
    // distinct steps that fail in different ways — Firebase errors have a `.code`
    // (handled by friendlyFirebaseError), but our own /api/login returns a plain
    // { error: string } message that would otherwise get swallowed into a generic
    // "Something went wrong" by friendlyFirebaseError's fallback branch.
    let idToken: string;
    try {
      const credential = await confirmationRef.current.confirm(entered);
      idToken = await credential.user.getIdToken();
    } catch (err) {
      setOtpError(friendlyFirebaseError(err));
      setVerifying(false);
      return;
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Login failed — please try again.");
      }
      const { user } = await res.json();
      loginWithServerUser(user);
      onSuccess();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Login failed — please try again.");
    } finally {
      setVerifying(false);
    }
  }

  if (step === "phone") {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Enter your mobile number</p>
        <h2 className="mt-1 text-xl font-800 text-foreground">We&apos;ll send you an OTP</h2>

        <div className="mt-6">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-input px-3 py-3 focus-within:border-primary">
            <span className="text-sm font-600 text-muted-foreground">🇮🇳 +91</span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                setPhoneError("");
              }}
              className="w-full flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {phoneError && <p className="mt-2 text-xs font-600 text-red-500">{phoneError}</p>}
        </div>

        <button
          onClick={handleSendOtp}
          disabled={sending}
          className="btn-primary mt-6 w-full py-3 text-sm active:scale-[0.98]"
        >
          {sending ? "Sending…" : "Send OTP"}
        </button>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          By continuing, you agree to Rento&apos;s Terms &amp; Privacy Policy.
        </p>

        {/* Firebase attaches its invisible reCAPTCHA widget here */}
        <div id="recaptcha-container" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">OTP sent to</p>
      <h2 className="mt-1 text-xl font-800 text-foreground">+91 {phone}</h2>

      <div className="mt-6 flex justify-between gap-1.5 sm:gap-2">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(i, e.target.value)}
            onKeyDown={(e) => handleOtpKeyDown(i, e)}
            className="h-12 w-9 rounded-xl border border-border text-center text-lg font-700 outline-none focus:border-primary sm:w-10"
          />
        ))}
      </div>
      {otpError && <p className="mt-3 text-xs font-600 text-red-500">{otpError}</p>}

      <button
        onClick={handleVerify}
        disabled={verifying}
        className="btn-primary mt-6 w-full py-3 text-sm active:scale-[0.98]"
      >
        {verifying ? "Verifying…" : "Verify & Continue"}
      </button>

      <div className="mt-4 text-center text-xs text-muted-foreground">
        {secondsLeft > 0 ? (
          <span>Resend OTP in {secondsLeft}s</span>
        ) : (
          <button onClick={handleResend} disabled={sending} className="font-700 text-primary">
            {sending ? "Resending…" : "Resend OTP"}
          </button>
        )}
      </div>

      <button
        onClick={() => setStep("phone")}
        className="mt-2 block w-full text-center text-xs text-muted-foreground"
      >
        Change mobile number
      </button>
    </div>
  );
}
