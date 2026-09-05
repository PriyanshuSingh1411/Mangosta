"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCursorHover } from "@/app/lib/useCursorHover";

const SHOP_LINKS = [
  { label: "All Products", href: "/shop" },
  { label: "T-Shirts", href: "/shop?category=t-shirts" },
  { label: "Hoodies", href: "/shop?category=hoodies" },
  { label: "Jackets", href: "/shop?category=jackets" },
];

const COMPANY_LINKS = [
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#footer" },
  { label: "FAQ", href: "/#footer" },
  { label: "Journal", href: "/#the-mark" },
];

const SOCIALS = ["INSTAGRAM", "TIKTOK", "PINTEREST"];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const viewCursor = useCursorHover("view", "VIEW");

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || isSubmitting) {
      return;
    }

    setError("");
    setSubmitted(false);
    setAlreadySubscribed(false);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to subscribe right now. Please try again."
        );
      }

      if (data?.alreadySubscribed) {
        setAlreadySubscribed(true);
      } else {
        setSubmitted(true);
      }

      setEmail("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to subscribe right now. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer
      id="footer"
      className="relative bg-void px-5 pt-24 sm:px-8"
    >
      <div className="mx-auto max-w-[1600px]">

        {/* Newsletter */}
        <div className="py-16 sm:py-20">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-10">

            <h2 className="font-display text-[9vw] leading-[0.9] tracking-tight text-bone sm:text-5xl md:text-6xl">
              JOIN THE
              <br />
              MANGOSTA WORLD.
            </h2>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3"
            >
              <div className="flex items-stretch border-b border-line-strong">

                <label
                  htmlFor="newsletter-email"
                  className="sr-only"
                >
                  Email address
                </label>

                <input
                  id="newsletter-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                    setSubmitted(false);
                    setAlreadySubscribed(false);
                  }}
                  placeholder="ENTER YOUR EMAIL"
                  disabled={isSubmitting}
                  className="flex-1 bg-transparent py-4 text-sm tracking-wide text-bone placeholder:text-stone-dark focus:outline-none disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="shrink-0 px-6 text-xs font-medium tracking-[0.15em] text-bone transition-colors hover:text-mango disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "JOINING…" : "JOIN"}
                </button>
              </div>

              <p
                className="min-h-[1.25rem] text-xs text-stone"
                role="status"
                aria-live="polite"
              >
                {error
                  ? error
                  : submitted
                    ? "You're on the list."
                    : alreadySubscribed
                      ? "You're already on the list."
                      : "No spam. Unsubscribe any time."}
              </p>
            </form>
          </div>
        </div>

        {/* Link grid */}
        <div className="grid grid-cols-2 gap-10 border-t border-line py-16 sm:grid-cols-4">

          <div className="col-span-2 flex items-center gap-2.5 sm:col-span-1">
            <div className="relative h-7 w-10">
              <Image
                src="/images/mark-white.png"
                alt=""
                fill
                sizes="40px"
                className="object-contain"
              />
            </div>

            <span className="font-display text-lg tracking-tight text-bone">
              MANGOSTA
            </span>
          </div>

          <div>
            <p className="label-technical mb-4">
              SHOP
            </p>

            <ul className="flex flex-col gap-3">
              {SHOP_LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    {...viewCursor}
                    className="text-sm text-stone transition-colors hover:text-bone"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-technical mb-4">
              COMPANY
            </p>

            <ul className="flex flex-col gap-3">
              {COMPANY_LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    {...viewCursor}
                    className="text-sm text-stone transition-colors hover:text-bone"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-technical mb-4">
              SOCIAL
            </p>

            <ul className="flex flex-col gap-3">
              {SOCIALS.map((s) => (
                <li key={s}>
                  <a
                    href="#"
                    {...viewCursor}
                    className="text-sm text-stone transition-colors hover:text-bone"
                  >
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-start justify-between gap-4 border-t border-line py-8 text-xs text-stone-dark sm:flex-row sm:items-center">

          <p>
            &copy; 2026 MANGOSTA. All rights reserved.
          </p>

          <div className="flex gap-6">
            <a
              href="#"
              className="transition-colors hover:text-stone"
            >
              Privacy
            </a>

            <a
              href="#"
              className="transition-colors hover:text-stone"
            >
              Terms
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}