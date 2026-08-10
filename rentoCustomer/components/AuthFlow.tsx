"use client";

import { useEffect, useRef, useState } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { CheckCircle2, Phone as PhoneIcon, X } from "lucide-react";
import { auth } from "@/lib/firebase-client";
import { useApp } from "@/app/providers";

const RESEND_SECONDS = 30;
const OTP_LENGTH = 6;
const COUNTRY_CODE = "+91";

function friendlyFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const message = (err as { message?: string })?.message ?? "";
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
    case "auth/billing-not-enabled":
      return "Phone sign-in requires Firebase billing to be enabled. Turn on billing in the Firebase console, or use the local test setup instead.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA verification failed. Refresh the page and try again.";
    case "auth/missing-app-credential":
      return "reCAPTCHA verification is required before sending OTP. Please complete the challenge and try again.";
    case "auth/internal-error":
      return "Firebase rejected the request — this usually means the API key or project config is wrong.";
    default:
      if (code) return `Something went wrong (${code}).`;
      if (message) return `Something went wrong (${message}).`;
      return "Something went wrong. Please try again.";
  }
}

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

function getRecaptchaSize() {
  if (typeof window === "undefined") return "normal";
  return window.innerWidth < 380 ? "compact" : "normal";
}

export default function AuthFlow({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose?: () => void;
}) {
  const { loginWithServerUser } = useApp();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState(COUNTRY_CODE);
  const [phoneError, setPhoneError] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [otpError, setOtpError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  async function initRecaptcha() {
    if (recaptchaRef.current || !recaptchaContainerRef.current) return;

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: getRecaptchaSize(),
      callback: () => setPhoneError(""),
      "expired-callback": () => {
        setPhoneError("reCAPTCHA expired. Please verify again.");
      },
    });

    recaptchaRef.current = verifier;
    await verifier.render();
    setRecaptchaReady(true);
  }

  async function rebuildRecaptcha() {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    setRecaptchaReady(false);
    await initRecaptcha();
  }

  useEffect(() => {
    if (step !== "otp" || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, secondsLeft]);

  // Initialize once against a stable element so Firebase's internal iframe never
  // loses its mount node while users move between phone/OTP steps.
  useEffect(() => {
    void initRecaptcha()
      .then(() => setRecaptchaReady(true))
      .catch(() => {
        setPhoneError("Could not initialize reCAPTCHA. Refresh and try again.");
      });
  }, []);

  // Tear down the reCAPTCHA widget when this form goes away (e.g. modal closed).
  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  // Google's reCAPTCHA script throws timeouts/network errors as raw, unhandled
  // global errors (not rejections our own promises can catch) — left alone these
  // crash the whole page with Next's dev error overlay. Intercept just this
  // vendor script's errors, stop them from propagating, and recover the widget.
  useEffect(() => {
    function isRecaptchaError(message: unknown) {
      return typeof message === "string" && message.toLowerCase().includes("recaptcha");
    }

    function handleError(event: ErrorEvent) {
      if (!isRecaptchaError(event.message)) return;
      event.preventDefault();
      setPhoneError("Verification timed out. Please try again.");
      void rebuildRecaptcha();
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "");
      if (!isRecaptchaError(message)) return;
      event.preventDefault();
      setPhoneError("Verification timed out. Please try again.");
      void rebuildRecaptcha();
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  function toInternationalPhone(value: string) {
    const digits = value.replace(/\D/g, "");
    const withoutCountryCode = digits.startsWith("91") ? digits.slice(2) : digits;
    const nationalNumber = withoutCountryCode.slice(0, 10);
    return `${COUNTRY_CODE}${nationalNumber}`;
  }

  function isValidPhone(value: string) {
    return /^\+91[6-9]\d{9}$/.test(value);
  }

  function getRecaptchaVerifier() {
    if (!recaptchaRef.current) {
      throw new Error("reCAPTCHA is not ready yet. Please wait a moment and try again.");
    }
    return recaptchaRef.current;
  }

  async function sendOtp() {
    setSending(true);
    setPhoneError("");
    try {
      const verifier = getRecaptchaVerifier();
      const result = await signInWithPhoneNumber(auth, phone, verifier);
      confirmationRef.current = result;
      setStep("otp");
      setOtp(Array(OTP_LENGTH).fill(""));
      setOtpError("");
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setPhoneError(friendlyFirebaseError(err));
      // A failed challenge can leave the verifier in a bad state for the next try.
      // Rebuild it against the same persistent container.
      void rebuildRecaptcha().catch(() => {
        setPhoneError("Could not reset reCAPTCHA. Refresh and try again.");
      });

      const code = (err as { code?: string })?.code;
      if (
        isLocalDevHost() &&
        (code === "auth/billing-not-enabled" || code === "auth/operation-not-allowed")
      ) {
        try {
          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phoneNumber: phone, devMode: true }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Login failed — please try again.");
          }
          const { user } = await res.json();
          loginWithServerUser(user);
          onSuccess();
          return;
        } catch (fallbackErr) {
          setPhoneError(
            fallbackErr instanceof Error ? fallbackErr.message : "Login failed — please try again."
          );
          return;
        }
      }
    } finally {
      setSending(false);
    }
  }

  function handleSendOtp() {
    if (!isValidPhone(phone)) {
      setPhoneError("Enter a valid mobile number in +91 format");
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
        body: JSON.stringify({ idToken, phoneNumber: phone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Login failed — please try again.");
      }
      const { user } = await res.json();
      loginWithServerUser(user);
      setVerified(true);
      setTimeout(onSuccess, 1200);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Login failed — please try again.");
    } finally {
      setVerifying(false);
    }
  }

  const title = verified ? "Welcome!" : step === "phone" ? "Login to Rento" : "Enter OTP";
  const subtitle = verified
    ? "You're now logged in"
    : step === "phone"
      ? "Enter your mobile number to continue"
      : `OTP sent to ${phone}`;

  const content =
    step === "phone" ? (
      <>
        <div>
          <label className="mb-1.5 block text-sm font-600 text-foreground">Mobile Number</label>
          <div className="flex items-center overflow-hidden rounded-xl border-2 border-primary/70 bg-card transition-all focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(255,79,64,0.14)]">
            <span className="flex items-center gap-1.5 border-r border-primary/60 bg-primary/5 px-3 py-3 text-sm font-600 text-muted-foreground">
              <PhoneIcon size={16} />
              {COUNTRY_CODE}
            </span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="98765 43210"
              value={phone.slice(COUNTRY_CODE.length)}
              onChange={(e) => {
                setPhone(toInternationalPhone(e.target.value));
                setPhoneError("");
              }}
              className="flex-1 appearance-none border-0 bg-transparent px-3 py-3 text-sm font-500 text-foreground outline-none placeholder:text-muted-foreground/55"
            />
          </div>
          {phoneError && <p className="mt-1.5 text-xs font-600 text-red-500">{phoneError}</p>}
        </div>

        <button
          onClick={handleSendOtp}
          disabled={sending || !recaptchaReady}
          className="btn-primary mt-5 w-full py-3 text-sm active:scale-[0.98]"
        >
          {sending ? "Sending…" : recaptchaReady ? "Send OTP" : "Preparing reCAPTCHA…"}
        </button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing, you agree to Rento&apos;s Terms &amp; Privacy Policy.
        </p>
      </>
    ) : (
      <>
        <div className="flex justify-center gap-2 sm:gap-3">
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
              className="h-12 w-10 flex-1 appearance-none rounded-[10px] border-2 border-border bg-card text-center text-lg font-700 text-foreground outline-none transition-colors focus:border-primary focus:ring-[3px] focus:ring-[rgba(255,79,64,0.15)] sm:h-14 sm:w-[52px] sm:flex-none sm:text-2xl"
            />
          ))}
        </div>
        {otpError && <p className="mt-3 text-center text-xs font-600 text-red-500">{otpError}</p>}

        <button
          onClick={handleVerify}
          disabled={verifying}
          className="btn-primary mt-5 w-full py-3 text-sm active:scale-[0.98]"
        >
          {verifying ? "Verifying…" : "Verify & Continue"}
        </button>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {secondsLeft > 0 ? (
            <span>
              Resend OTP in <span className="font-700 text-primary tabular-nums">{secondsLeft}s</span>
            </span>
          ) : (
            <button onClick={handleResend} disabled={sending} className="font-600 text-primary hover:underline">
              {sending ? "Resending…" : "Resend OTP"}
            </button>
          )}
        </div>

        <button
          onClick={() => setStep("phone")}
          className="mt-2 block w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Change mobile number
        </button>
      </>
    );

  return (
    <div>
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-700 text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {onClose && (
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="pt-5">
        {verified ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 size={36} className="text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-lg font-700 text-foreground">Logged In!</p>
              <p className="mt-1 text-sm text-muted-foreground">Redirecting you back…</p>
            </div>
          </div>
        ) : (
          content
        )}
      </div>

      <div
        id="recaptcha-container"
        ref={recaptchaContainerRef}
        className={
          step === "phone" && !verified
            ? "mt-4 flex justify-center rounded-xl border border-border bg-card p-3"
            : "hidden"
        }
      />
    </div>
  );
}