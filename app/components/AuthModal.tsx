"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AuthUser } from "./AuthProvider";

type AuthMode = "signin" | "signup";

type Props = {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onAuthenticated: (user: AuthUser) => void;
};

export default function AuthModal({
  open,
  mode,
  onClose,
  onModeChange,
  onAuthenticated,
}: Props) {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep("email");
    setOtp("");
    setMobile("");
    setError(null);
    setMessage(null);
    setCooldown(0);
  }, [open, mode]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const sendOtp = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    if (mode === "signup" && (!firstName.trim() || !lastName.trim())) {
      setError("Enter your first and last name.");
      return;
    }

    if (mode === "signup" && !/^(?:\+91)?[6-9]\d{9}$/.test(mobile.replace(/\s|-/g, ""))) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          purpose: mode,
          firstName,
          lastName,
          mobile,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to send OTP.");
      }

      setStep("otp");
      setOtp("");
      setMessage("Verification code sent to your email.");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          otp,
          purpose: mode,
          firstName,
          lastName,
          mobile,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to verify OTP.");
      }

      onAuthenticated(data.user as AuthUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10020] bg-void/75 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[10021] flex items-center justify-center px-5 py-8"
          >
            <div
              className="relative w-full max-w-md border border-line bg-charcoal p-6 sm:p-8"
              role="dialog"
              aria-modal="true"
              aria-label={mode === "signup" ? "Sign up" : "Sign in"}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 text-2xl leading-none text-stone transition-colors hover:text-bone"
                aria-label="Close"
              >
                &times;
              </button>

              <p className="label-technical mb-2">
                MANGOSTA / ACCOUNT
              </p>

              <h2 className="font-display text-3xl tracking-tight text-bone">
                {mode === "signup" ? "CREATE ACCOUNT" : "WELCOME BACK"}
              </h2>

              <p className="mt-3 max-w-sm text-sm leading-relaxed text-stone">
                {step === "email"
                  ? "Browse freely. Sign in only when you want to shop."
                  : `Enter the verification code sent to ${email}.`}
              </p>

              <div className="mt-7 flex border-b border-line">
                <button
                  type="button"
                  onClick={() => onModeChange("signin")}
                  className={`flex-1 pb-3 text-xs tracking-[0.14em] ${
                    mode === "signin"
                      ? "border-b border-mango text-bone"
                      : "text-stone"
                  }`}
                >
                  SIGN IN
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange("signup")}
                  className={`flex-1 pb-3 text-xs tracking-[0.14em] ${
                    mode === "signup"
                      ? "border-b border-mango text-bone"
                      : "text-stone"
                  }`}
                >
                  SIGN UP
                </button>
              </div>

              {step === "email" ? (
                <form onSubmit={sendOtp} className="mt-7 flex flex-col gap-4">
                  {mode === "signup" && (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                      <input
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        placeholder="FIRST NAME"
                        autoComplete="given-name"
                        className="border border-line-strong bg-transparent px-3.5 py-3 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                      />
                      <input
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        placeholder="LAST NAME"
                        autoComplete="family-name"
                        className="border border-line-strong bg-transparent px-3.5 py-3 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                      />
                      </div>

                      <input
                        required
                        type="tel"
                        value={mobile}
                        onChange={(event) => setMobile(event.target.value.replace(/[^0-9+\s-]/g, ""))}
                        placeholder="MOBILE NUMBER"
                        autoComplete="tel"
                        inputMode="tel"
                        className="border border-line-strong bg-transparent px-3.5 py-3 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                      />
                    </div>
                  )}

                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="EMAIL ADDRESS"
                    autoComplete="email"
                    className="border border-line-strong bg-transparent px-3.5 py-3 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-bone py-3.5 text-xs font-medium tracking-[0.16em] text-void transition-colors hover:bg-mango disabled:opacity-50"
                  >
                    {loading ? "SENDING…" : "SEND OTP"}
                  </button>
                </form>
              ) : (
                <form onSubmit={verifyOtp} className="mt-7 flex flex-col gap-4">
                  <input
                    required
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-DIGIT OTP"
                    className="border border-line-strong bg-transparent px-3.5 py-4 text-center font-mono text-2xl tracking-[0.4em] text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-bone py-3.5 text-xs font-medium tracking-[0.16em] text-void transition-colors hover:bg-mango disabled:opacity-50"
                  >
                    {loading ? "VERIFYING…" : "VERIFY & CONTINUE"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                      setError(null);
                      setMessage(null);
                    }}
                    className="text-xs tracking-[0.12em] text-stone transition-colors hover:text-bone"
                  >
                    CHANGE EMAIL
                  </button>

                  <button
                    type="button"
                    disabled={loading || cooldown > 0}
                    onClick={() => sendOtp()}
                    className="text-xs tracking-[0.12em] text-stone transition-colors hover:text-mango disabled:opacity-40"
                  >
                    {cooldown > 0 ? `RESEND IN ${cooldown}s` : "RESEND OTP"}
                  </button>
                </form>
              )}

              {message && (
                <p className="mt-4 text-xs text-mango">
                  {message}
                </p>
              )}

              {error && (
                <p role="alert" className="mt-4 text-xs text-mango">
                  {error}
                </p>
              )}

              <p className="mt-7 text-[11px] leading-relaxed text-stone-dark">
                By continuing, you agree to use your email address for MANGOSTA account authentication.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
