"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "@/app/store/useCartStore";
import { useCursorHover } from "@/app/lib/useCursorHover";
import { useAuth } from "@/app/components/AuthProvider";

const NAV_LINKS = [
  { label: "SHOP", href: "/shop" },
  { label: "COLLECTION", href: "/#collection" },
  { label: "ABOUT", href: "/#about" },
  { label: "JOURNAL", href: "/#the-mark" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const {
    openBag,
    openSearch,
    openMenu,
    closeMenu,
    isMenuOpen,
    itemCount,
  } = useCartStore();

  const {
    user,
    loading: authLoading,
    openAuth,
    logout,
  } = useAuth();

  const count = hasMounted ? itemCount() : 0;

  const shopCursor = useCursorHover("shop", "SHOP");
  const viewCursor = useCursorHover("view", "VIEW");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[9990] transition-all duration-500 ${
          scrolled ? "bg-void/80 backdrop-blur-xl" : "bg-black"
        }`}
      >
        <div
          className={`mx-auto flex h-[76px] w-full max-w-[1600px] items-center justify-between px-5 transition-all duration-500 sm:px-8 lg:h-[50px] lg:px-10 ${
            scrolled ? "border-b border-line" : "border-b border-bone/10"
          }`}
        >
          {/* BRAND */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-3.5"
            {...viewCursor}
            aria-label="Mangosta home"
          >
            <div className="relative h-8 w-11 sm:h-9 sm:w-12">
              <Image
                src="/images/mark-white.png"
                alt=""
                fill
                sizes="48px"
                className="object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            <span className="font-display text-xl font-semibold tracking-[-0.02em] text-bone sm:text-[1.65rem]">
              MANGOSTA
            </span>
          </Link>

          {/* DESKTOP NAV */}
          <nav
            className="hidden items-center gap-11 md:flex lg:gap-14"
            aria-label="Primary"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="group relative py-3 text-[11px] font-medium tracking-[0.2em] text-bone-dim transition-colors duration-300 hover:text-bone"
                {...viewCursor}
              >
                {link.label}
                <span className="absolute bottom-1 left-0 h-px w-0 bg-mango transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          {/* RIGHT ACTIONS */}
          <div className="flex shrink-0 items-center gap-7 sm:gap-9">
            {/* ACCOUNT */}
            {!authLoading && (
              <button
                type="button"
                onClick={() => {
                  if (user) {
                    void logout();
                  } else {
                    openAuth("signin");
                  }
                }}
                className="hidden text-[11px] font-medium tracking-[0.2em] text-bone-dim transition-colors duration-300 hover:text-bone sm:inline"
                {...viewCursor}
              >
                {user ? "LOGOUT" : "SIGN IN"}
              </button>
            )}

            {/* SEARCH */}
            <button
              type="button"
              onClick={openSearch}
              className="group flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] text-bone-dim transition-colors duration-300 hover:text-bone"
              aria-label="Search"
              {...viewCursor}
            >
              <span className="hidden sm:inline">SEARCH</span>

              <svg
                className="h-[17px] w-[17px] transition-transform duration-300 group-hover:scale-110 sm:hidden"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
            </button>

            {/* BAG */}
            <button
              type="button"
              onClick={openBag}
              className="group relative flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] text-bone-dim transition-colors duration-300 hover:text-bone"
              aria-label={`Bag, ${count} item${count === 1 ? "" : "s"}`}
              {...shopCursor}
            >
              <span className="hidden sm:inline">BAG</span>

              <svg
                className="h-[17px] w-[17px] transition-transform duration-300 group-hover:scale-110 sm:hidden"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" />
              </svg>

              {count > 0 && (
                <span className="absolute -right-4 -top-3 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mango px-1 font-mono text-[10px] font-bold leading-none text-void">
                  {count}
                </span>
              )}
            </button>

            {/* MOBILE MENU */}
            <button
              type="button"
              onClick={openMenu}
              className="flex flex-col gap-[5px] md:hidden"
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
            >
              <span className="h-px w-6 bg-bone transition-transform duration-300" />
              <span className="h-px w-4 self-end bg-bone transition-transform duration-300" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 hidden h-px w-full bg-gradient-to-r from-transparent via-bone/10 to-transparent md:block" />
      </header>

      {/* MOBILE FULLSCREEN MENU */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-[9995] flex flex-col bg-void md:hidden"
          >
            <div className="flex h-[76px] items-center justify-between border-b border-line px-5">
              <Link
                href="/"
                onClick={closeMenu}
                className="flex items-center gap-3"
              >
                <div className="relative h-8 w-10">
                  <Image
                    src="/images/mark-white.png"
                    alt=""
                    fill
                    sizes="40px"
                    className="object-contain"
                  />
                </div>

                <span className="font-display text-xl font-semibold tracking-tight text-bone">
                  MANGOSTA
                </span>
              </Link>

              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center text-3xl leading-none text-bone transition-transform duration-300 hover:rotate-90"
              >
                &times;
              </button>
            </div>

            <nav
              className="flex flex-1 flex-col justify-center px-6"
              aria-label="Mobile"
            >
              <div className="mb-8">
                <p className="label-technical text-stone">MANGOSTA / FW26</p>
              </div>

              {NAV_LINKS.map((link, index) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.08 * index + 0.1,
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className="group flex items-center justify-between border-b border-line py-5 font-display text-5xl tracking-tight text-bone transition-colors duration-300 active:text-mango"
                  >
                    <span>{link.label}</span>
                    <span className="text-xl text-stone opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                      →
                    </span>
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* MOBILE ACCOUNT */}
            <div className="border-t border-line px-6 py-5">
              {user ? (
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    closeMenu();
                  }}
                  className="label-technical text-stone transition-colors hover:text-bone"
                >
                  LOGOUT — {user.email}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    openAuth("signin");
                  }}
                  className="label-technical text-stone transition-colors hover:text-bone"
                >
                  SIGN IN / SIGN UP
                </button>
              )}
            </div>

            <div className="border-t border-line px-6 py-8">
              <div className="mb-5 flex items-center justify-between">
                <span className="label-technical">MANGOSTA WORLD</span>
                <span className="label-technical text-stone">FW / 26</span>
              </div>

              <div className="flex gap-6 label-technical">
                <span className="transition-colors hover:text-bone">INSTAGRAM</span>
                <span className="transition-colors hover:text-bone">TIKTOK</span>
                <span className="transition-colors hover:text-bone">PINTEREST</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
