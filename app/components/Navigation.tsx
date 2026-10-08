"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "@/app/store/useCartStore";
import { useCursorHover } from "@/app/lib/useCursorHover";
import { useAuth } from "@/app/components/AuthProvider";
import NotificationBell from "@/app/components/NotificationBell";

const NAV_LINKS = [
  { label: "SHOP", href: "/shop" },
  { label: "ABOUT", href: "/about" },
  { label: "WISHLIST", href: "/wishlist" },
  { label: "YOUR ORDERS", href: "/orders" },
  { label: "ACCOUNT", href: "/account" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
    const stored = window.localStorage.getItem("mangosta-theme");
    const isDark = stored !== "light";
    setDarkMode(isDark);
    document.documentElement.classList.toggle("light-theme", !isDark);
  }, []);

  const requestLogout = () => {
    setIsLogoutOpen(true);
  };

  const cancelLogout = () => {
    if (!isLoggingOut) setIsLogoutOpen(false);
  };

  const confirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      setIsLogoutOpen(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    document.documentElement.classList.toggle("light-theme", !nextDark);
    window.localStorage.setItem("mangosta-theme", nextDark ? "dark" : "light");
  };

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isMenuOpen || isLogoutOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen, isLogoutOpen]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[9990] transition-all duration-500 ${
          scrolled ? "bg-void/80 backdrop-blur-xl" : "bg-void"
        }`}
      >
        <div
          className={`mx-auto flex h-[76px] w-full max-w-[1600px] items-center justify-between gap-3 px-4 transition-all duration-500 min-[375px]:px-5 sm:px-8 lg:h-[50px] lg:gap-6 lg:px-8 xl:px-10 ${
            scrolled ? "border-b border-line" : "border-b border-bone/10"
          }`}
        >
          {/* BRAND */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2 min-[375px]:gap-2.5 sm:gap-3.5"
            {...viewCursor}
            aria-label="Mangosta home"
          >
            <div className="relative h-7 w-9 shrink-0 min-[375px]:h-8 min-[375px]:w-10 sm:h-9 sm:w-12">
              <Image
                src={darkMode ? "/images/mark-white.png" : "/images/mark-black.png"}
                alt=""
                fill
                sizes="48px"
                className="object-contain transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            {/* Scales with the screen on phones so it never runs into the
                icons; hidden only on very narrow screens (< 320px). */}
            <span className="whitespace-nowrap font-display text-[clamp(15px,4.4vw,20px)] font-semibold tracking-[-0.02em] text-bone max-[319px]:hidden sm:text-[1.65rem]">
              MANGOSTA
            </span>
          </Link>

          {/* DESKTOP NAV */}
          <nav
            className="hidden items-center gap-5 lg:flex xl:gap-10 2xl:gap-14"
            aria-label="Primary"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="group relative whitespace-nowrap py-3 text-[11px] font-medium tracking-[0.2em] text-bone-dim transition-colors duration-300 hover:text-bone"
                {...viewCursor}
              >
                {link.label}
                <span className="absolute bottom-1 left-0 h-px w-0 bg-mango transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          {/* RIGHT ACTIONS */}
          {/* Phones + small tablets: icons only (Logout / Light live in the
              menu). 768px+: text buttons. */}
          <div className="flex shrink-0 items-center gap-1 min-[360px]:gap-1.5 md:gap-8 lg:gap-4 xl:gap-9">
            {/* ACCOUNT */}
            {!authLoading && (
              <button
                type="button"
                onClick={() => {
                  if (user) {
                    requestLogout();
                  } else {
                    openAuth("signin");
                  }
                }}
                className="hidden whitespace-nowrap text-[11px] font-medium tracking-[0.2em] text-bone-dim transition-colors duration-300 hover:text-bone md:inline cursor-pointer"
                {...viewCursor}
              >
                {user ? "LOGOUT" : "SIGN IN"}
              </button>
            )}

            {/* NOTIFICATIONS */}
            <NotificationBell />

            {/* SEARCH */}
            <button
              type="button"
              onClick={openSearch}
              className="group flex h-8 w-8 items-center justify-center gap-2 text-[11px] font-medium tracking-[0.2em] text-bone-dim transition-colors duration-300 hover:text-bone cursor-pointer md:h-auto md:w-auto"
              aria-label="Search"
              {...viewCursor}
            >
              <span className="hidden md:inline">SEARCH</span>

              <svg
                className="h-[17px] w-[17px] transition-transform duration-300 group-hover:scale-110 md:hidden"
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
              className="group relative flex h-8 w-8 items-center justify-center gap-2 text-[11px] font-medium tracking-[0.2em] text-bone-dim transition-colors duration-300 hover:text-bone cursor-pointer md:h-auto md:w-auto"
              aria-label={`Bag, ${count} item${count === 1 ? "" : "s"}`}
              {...shopCursor}
            >
              <span className="hidden md:inline">BAG</span>

              <svg
                className="h-[17px] w-[17px] transition-transform duration-300 group-hover:scale-110 md:hidden"
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
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-mango px-1 font-mono text-[9px] font-bold leading-none text-void md:-right-4 md:-top-3 md:h-[18px] md:min-w-[18px] md:text-[10px]">
                  {count}
                </span>
              )}
            </button>

            {/* THEME */}
            <button
              type="button"
              onClick={toggleTheme}
              className="hidden whitespace-nowrap text-[11px] font-medium tracking-[0.2em] text-bone-dim transition-colors duration-300 hover:text-bone md:inline cursor-pointer"
              aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}
              {...viewCursor}
            >
              {darkMode ? "LIGHT" : "DARK"}
            </button>

            {/* MOBILE MENU */}
            <button
              type="button"
              onClick={openMenu}
              className="-mr-2 flex h-11 w-10 flex-col items-end justify-center gap-[5px] pr-2 lg:hidden"
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
            >
              <span className="h-px w-6 bg-bone transition-transform duration-300" />
              <span className="h-px w-4 self-end bg-bone transition-transform duration-300" />
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 hidden h-px w-full bg-gradient-to-r from-transparent via-bone/10 to-transparent lg:block" />
      </header>

      {/* DRAMATIC LOGOUT MODAL */}
      <AnimatePresence>
        {isLogoutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/80 px-5 backdrop-blur-md"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) cancelLogout();
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.97 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-title"
              aria-describedby="logout-description"
              className="relative w-full max-w-xl overflow-hidden border border-line bg-void p-7 shadow-2xl sm:p-10"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-mango/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-20 h-48 w-48 rounded-full bg-bone/5 blur-3xl" />

              <div className="relative">
                <div className="mb-8 flex items-center justify-between">
                  <p className="label-technical text-mango">MANGOSTA / SESSION</p>
                  <button
                    type="button"
                    onClick={cancelLogout}
                    disabled={isLoggingOut}
                    aria-label="Close logout dialog"
                    className="flex h-9 w-9 items-center justify-center border border-line text-xl text-stone transition-colors hover:border-bone hover:text-bone disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>

                <p className="mb-3 font-mono text-[10px] tracking-[0.28em] text-stone">
                  BEFORE YOU GO...
                </p>
                <h2
                  id="logout-title"
                  className="max-w-md font-display text-4xl font-semibold leading-[0.95] tracking-tight text-bone sm:text-6xl"
                >
                  WAIT.
                  <br />
                  YOU&apos;RE REALLY LEAVING?
                </h2>

                <p
                  id="logout-description"
                  className="mt-6 max-w-md text-sm leading-6 text-bone-dim sm:text-base"
                >
                  Your Mangosta world is still here. Your wishlist is waiting.
                  Your next fit is probably waiting too.
                </p>

                <div className="my-8 h-px w-full bg-line" />

                <p className="mb-5 font-display text-xl tracking-tight text-bone sm:text-2xl">
                  One last question...
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={confirmLogout}
                    disabled={isLoggingOut}
                    className="group flex min-h-12 flex-1 items-center justify-center gap-3 border border-bone bg-bone px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-void transition-all duration-300 hover:bg-transparent hover:text-bone disabled:cursor-wait disabled:opacity-60"
                  >
                    {isLoggingOut ? "SEE YOU SOON..." : "YES, I&apos;M LEAVING"}
                    {!isLoggingOut && <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>}
                  </button>

                  <button
                    type="button"
                    onClick={cancelLogout}
                    disabled={isLoggingOut}
                    className="min-h-12 flex-1 border border-line px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-bone transition-all duration-300 hover:border-mango hover:text-mango disabled:opacity-50"
                  >
                    NO, HOW CAN I LEAVE YOU?
                  </button>
                </div>

                <p className="mt-5 text-center font-mono text-[9px] tracking-[0.16em] text-stone">
                  YOUR SESSION ENDS. YOUR STYLE DOESN&apos;T.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE FULLSCREEN MENU */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            data-lenis-prevent
            className="fixed inset-0 z-[9995] flex flex-col overflow-y-auto bg-void lg:hidden"
          >
            <div className="flex h-[76px] items-center justify-between border-b border-line px-5">
              <Link
                href="/"
                onClick={closeMenu}
                className="flex items-center gap-3"
              >
                <div className="relative h-8 w-10">
                  <Image
                    src={darkMode ? "/images/mark-white.png" : "/images/mark-black.png"}
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
                className="-mr-2 flex h-11 w-11 items-center justify-center text-3xl leading-none text-bone transition-transform duration-300 hover:rotate-90"
              >
                &times;
              </button>
            </div>

            <nav
              className="flex flex-col px-6 pt-5 pb-4"
              aria-label="Mobile"
            >
              <div className="mb-5">
                <p className="label-technical text-stone">MANGOSTA</p>
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
                    className="group flex items-center justify-between border-b border-line py-3.5 font-display text-2xl leading-none tracking-tight text-bone transition-colors duration-300 active:text-mango"
                  >
                    <span>{link.label}</span>
                    <span className="text-base text-stone opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
                      →
                    </span>
                  </Link>
                </motion.div>
              ))}
            </nav>

            {/* MOBILE THEME */}
            <div className="border-t border-line px-6 py-4">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center justify-center gap-2.5 border border-line-strong px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-bone transition-colors hover:border-bone active:bg-bone active:text-void"
              >
                {darkMode ? (
                  // sun — switching to light
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
                  </svg>
                ) : (
                  // moon — switching to dark
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
                  </svg>
                )}
                {darkMode ? "SWITCH TO LIGHT MODE" : "SWITCH TO DARK MODE"}
              </button>
            </div>

            {/* MOBILE ACCOUNT */}
            <div className="border-t border-line px-6 py-3.5">
              {user ? (
                <button
                  type="button"
                  onClick={async () => {
                    closeMenu();
                    requestLogout();
                  }}
                  className="label-technical text-stone transition-colors hover:text-bone"
                >
                  LOGOUT
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    openAuth("signin");
                  }}
                  className="label-technical text-stone transition-colors hover:text-bone "
                >
                  SIGN IN / SIGN UP
                </button>
              )}
            </div>

            <div className="border-t border-line px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="label-technical">MANGOSTA WORLD</span>
              </div>

              <div className="flex gap-6 label-technical">
                <span className="transition-colors hover:text-bone">INSTAGRAM</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}