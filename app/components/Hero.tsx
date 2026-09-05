"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";

import type {
  HeroSettings,
  HeroSlide,
} from "@/app/lib/dataStore";

import { useSiteStore } from "@/app/store/useSiteStore";

type HeroProps = {
  settings: HeroSettings;
};

const DEFAULT_SLIDE: HeroSlide = {
  id: "default-hero",
  enabled: true,
  order: 0,

  image: "",

  topLabel: "MANGOSTA / FW26",
  secondaryLabel: "NEW GENERATION",

  headlineLine1: "WEAR",
  headlineLine2: "YOUR",
  headlineLine3: "ATTITUDE.",

  description:
    "A new generation fashion label built for people who create their own rules.",

  buttonText: "SHOP NOW",
  buttonUrl: "/shop",

  issueLabel: "ISSUE 001",
  issueSubtitle: "URBAN APPAREL",

  productId: "",

  titleStyle: "display",
};

export default function Hero({
  settings,
}: HeroProps) {
  const isLoaded = useSiteStore(
    (state) => state.isLoaded
  );

  const prefersReducedMotion =
    useSiteStore(
      (state) =>
        state.prefersReducedMotion
    );

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [isPaused, setIsPaused] =
    useState(false);

  const [isAnimating, setIsAnimating] =
    useState(false);

  const touchStartX = useRef<
    number | null
  >(null);

  const touchEndX = useRef<
    number | null
  >(null);

  const animationTimer =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  /*
   * ============================================================
   * ACTIVE SLIDES
   * ============================================================
   */

  const slides = useMemo(() => {
    const configuredSlides =
      Array.isArray(settings?.slides)
        ? settings.slides
            .filter(
              (slide) =>
                slide &&
                slide.enabled
            )
            .sort(
              (a, b) =>
                a.order - b.order
            )
        : [];

    return configuredSlides.length
      ? configuredSlides
      : [DEFAULT_SLIDE];
  }, [settings?.slides]);

  /*
   * Keep the active index valid when
   * Admin changes the number of slides.
   */

  useEffect(() => {
    if (
      currentIndex >= slides.length
    ) {
      setCurrentIndex(0);
    }
  }, [
    currentIndex,
    slides.length,
  ]);

  const currentSlide =
    slides[currentIndex] ??
    slides[0] ??
    DEFAULT_SLIDE;

  /*
   * ============================================================
   * TRANSITION
   * ============================================================
   */

  const transitionDuration =
    Math.min(
      2000,
      Math.max(
        250,
        settings?.transitionDuration ||
          700
      )
    );

  const transitionType =
    settings?.transition === "slide"
      ? "slide"
      : "fade";

  /*
   * ============================================================
   * GO TO SLIDE
   * ============================================================
   */

  const goToSlide = useCallback(
    (index: number) => {
      if (
        slides.length <= 1 ||
        isAnimating
      ) {
        return;
      }

      const nextIndex =
        (index + slides.length) %
        slides.length;

      if (
        nextIndex === currentIndex
      ) {
        return;
      }

      setIsAnimating(true);
      setCurrentIndex(nextIndex);

      if (animationTimer.current) {
        clearTimeout(
          animationTimer.current
        );
      }

      animationTimer.current =
        setTimeout(() => {
          setIsAnimating(false);
        }, transitionDuration);
    },
    [
      currentIndex,
      isAnimating,
      slides.length,
      transitionDuration,
    ]
  );

  /*
   * ============================================================
   * NEXT / PREVIOUS
   * ============================================================
   */

  const nextSlide = useCallback(() => {
    goToSlide(
      currentIndex + 1
    );
  }, [
    currentIndex,
    goToSlide,
  ]);

  const previousSlide =
    useCallback(() => {
      goToSlide(
        currentIndex - 1
      );
    }, [
      currentIndex,
      goToSlide,
    ]);

  /*
   * ============================================================
   * CLEANUP
   * ============================================================
   */

  useEffect(() => {
    return () => {
      if (animationTimer.current) {
        clearTimeout(
          animationTimer.current
        );
      }
    };
  }, []);

  /*
   * ============================================================
   * AUTOPLAY
   * ============================================================
   */

  useEffect(() => {
    if (
      !settings?.autoplay ||
      prefersReducedMotion ||
      isPaused ||
      slides.length <= 1 ||
      !isLoaded
    ) {
      return;
    }

    const duration = Math.max(
      2000,
      settings.autoplayDuration ||
        6000
    );

    const timer =
      setInterval(() => {
        if (!isAnimating) {
          nextSlide();
        }
      }, duration);

    return () =>
      clearInterval(timer);
  }, [
    settings?.autoplay,
    settings?.autoplayDuration,
    prefersReducedMotion,
    isPaused,
    slides.length,
    isLoaded,
    isAnimating,
    nextSlide,
  ]);

  /*
   * ============================================================
   * KEYBOARD
   * ============================================================
   */

  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "ArrowRight"
      ) {
        nextSlide();
      }

      if (
        event.key === "ArrowLeft"
      ) {
        previousSlide();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [
    nextSlide,
    previousSlide,
  ]);

  /*
   * ============================================================
   * TOUCH / SWIPE
   * ============================================================
   */

  const handleTouchStart = (
    event: TouchEvent
  ) => {
    touchStartX.current =
      event.touches[0]?.clientX ??
      null;

    touchEndX.current = null;
  };

  const handleTouchMove = (
    event: TouchEvent
  ) => {
    touchEndX.current =
      event.touches[0]?.clientX ??
      null;
  };

  const handleTouchEnd = () => {
    if (
      touchStartX.current === null ||
      touchEndX.current === null
    ) {
      return;
    }

    const distance =
      touchStartX.current -
      touchEndX.current;

    const minimumDistance = 50;

    if (
      Math.abs(distance) >=
      minimumDistance
    ) {
      if (distance > 0) {
        nextSlide();
      } else {
        previousSlide();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  /*
   * ============================================================
   * HERO DISABLED
   * ============================================================
   */

  if (!settings?.enabled) {
    return null;
  }

  /*
   * ============================================================
   * CONTENT
   * ============================================================
   */

  const headline = [
    currentSlide.headlineLine1,
    currentSlide.headlineLine2,
    currentSlide.headlineLine3,
  ].filter(Boolean);

  /*
   * HeroSlide already contains buttonUrl, so there is no need
   * to read a non-existent productLink property.
   *
   * productId remains available for future product association
   * from the Admin Panel.
   */

  const destination =
    currentSlide.buttonUrl ||
    "/shop";

  const hasImage =
    Boolean(currentSlide.image);

  /*
   * ============================================================
   * HERO
   * ============================================================
   */

  return (
    <section
      aria-label="Mangosta hero carousel"
      className="relative w-full overflow-hidden bg-void"
      onMouseEnter={() =>
        setIsPaused(true)
      }
      onMouseLeave={() =>
        setIsPaused(false)
      }
      onTouchStart={
        handleTouchStart
      }
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative h-[100svh] min-h-[620px] w-full">
        {/* ================================================== */}
        {/* SLIDE IMAGE */}
        {/* ================================================== */}

        <div className="absolute inset-0 overflow-hidden">
          {hasImage ? (
            <div
              key={currentSlide.id}
              className={[
                "absolute inset-0",
                transitionType === "slide"
                  ? "animate-[heroSlideIn_900ms_cubic-bezier(.22,1,.36,1)_both]"
                  : "animate-[heroFadeIn_900ms_ease-out_both]",
              ].join(" ")}
            >
              <Image
                src={currentSlide.image}
                alt={
                  currentSlide.headlineLine1 ||
                  "MANGOSTA"
                }
                fill
                priority={
                  currentIndex === 0
                }
                sizes="100vw"
                className={[
                  "object-cover",
                  prefersReducedMotion
                    ? ""
                    : "scale-[1.015]",
                ].join(" ")}
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-charcoal" />
          )}
        </div>

        {/* ================================================== */}
        {/* EDITORIAL OVERLAYS */}
        {/* ================================================== */}

        <div className="absolute inset-0 bg-black/25" />

        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />

        {/* ================================================== */}
        {/* TOP META */}
        {/* ================================================== */}

        <div className="absolute left-5 right-5 top-5 z-30 sm:left-8 sm:right-8 sm:top-7 lg:left-10 lg:right-10">
          <div className="flex items-start justify-between">
            {/* LEFT META */}

            <div>
              <p className="label-technical text-bone">
                {currentSlide.topLabel}
              </p>

              {currentSlide.secondaryLabel && (
                <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-stone">
                  {
                    currentSlide.secondaryLabel
                  }
                </p>
              )}
            </div>

            {/* RIGHT META */}

            <div className="text-right">
              <p className="label-technical text-bone">
                {currentSlide.issueLabel}
              </p>

              {currentSlide.issueSubtitle && (
                <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-stone">
                  {
                    currentSlide.issueSubtitle
                  }
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ================================================== */}
        {/* MAIN CONTENT */}
        {/* ================================================== */}

        <div
          key={`${currentSlide.id}-content`}
          className={[
            "absolute bottom-28 left-5 z-20",
            "max-w-[calc(100%-2.5rem)]",
            "sm:bottom-32 sm:left-8 sm:max-w-4xl",
            "lg:bottom-32 lg:left-10",
            prefersReducedMotion
              ? ""
              : "animate-[heroContentIn_750ms_cubic-bezier(.22,1,.36,1)_both]",
          ].join(" ")}
        >
          <h1
            className={[
              "font-display uppercase",
              "text-[11vw]",
              "leading-[0.84]",
              "tracking-[-0.055em]",
              "text-bone",
              "sm:text-[5.25rem]",
              "md:text-[6rem]",
              "lg:text-[7rem]",
              "xl:text-[8rem]",
            ].join(" ")}
          >
            {headline.map(
              (line, index) => (
                <span
                  key={`${currentSlide.id}-${index}`}
                  className="block"
                >
                  {line}
                </span>
              )
            )}
          </h1>

          {/* DESCRIPTION */}

          {currentSlide.description && (
            <p className="mt-5 max-w-sm text-xs leading-[1.65] text-stone sm:mt-6 sm:text-sm">
              {
                currentSlide.description
              }
            </p>
          )}

          {/* CTA */}

          {currentSlide.buttonText && (
            <div className="mt-6 sm:mt-7">
              <Link
                href={destination}
                className="group inline-flex items-center gap-5 border border-bone/70 px-5 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-bone transition-all duration-300 hover:border-bone hover:bg-bone hover:text-void sm:px-6 sm:py-3.5"
              >
                <span>
                  {
                    currentSlide.buttonText
                  }
                </span>

                <span className="text-sm transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* ================================================== */}
        {/* CAROUSEL NAVIGATION */}
        {/* ================================================== */}

        {slides.length > 1 && (
          <div className="absolute bottom-7 left-5 right-5 z-30 flex items-end justify-between sm:bottom-8 sm:left-8 sm:right-8 lg:left-10 lg:right-10">
            {/* PROGRESS */}

            <div className="flex items-end gap-1.5">
              {slides.map(
                (slide, index) => {
                  const active =
                    index === currentIndex;

                  return (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Go to slide ${index + 1}`}
                      aria-current={
                        active
                          ? "true"
                          : undefined
                      }
                      onClick={() =>
                        goToSlide(index)
                      }
                      className="group relative h-8 w-9 sm:w-14"
                    >
                      {/* NUMBER */}

                      <span
                        className={[
                          "absolute -top-4 left-0 text-[8px]",
                          "uppercase tracking-[0.16em]",
                          active
                            ? "text-bone"
                            : "text-bone/45",
                        ].join(" ")}
                      >
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      {/* LINE */}

                      <span
                        className={[
                          "absolute bottom-1 left-0 h-px w-full",
                          "transition-all duration-500",
                          active
                            ? "bg-bone"
                            : "bg-bone/25 group-hover:bg-bone/60",
                        ].join(" ")}
                      />
                    </button>
                  );
                }
              )}
            </div>

            {/* COUNTER + ARROWS */}

            <div className="flex items-center gap-3 sm:gap-4">
              <span className="hidden text-[9px] uppercase tracking-[0.18em] text-stone sm:block">
                {String(
                  currentIndex + 1
                ).padStart(2, "0")}
                {" / "}
                {String(
                  slides.length
                ).padStart(2, "0")}
              </span>

              <button
                type="button"
                aria-label="Previous slide"
                onClick={
                  previousSlide
                }
                className="flex h-9 w-9 items-center justify-center border border-bone/30 text-bone transition-all duration-300 hover:border-bone hover:bg-bone hover:text-void"
              >
                <span aria-hidden="true">
                  ←
                </span>
              </button>

              <button
                type="button"
                aria-label="Next slide"
                onClick={
                  nextSlide
                }
                className="flex h-9 w-9 items-center justify-center border border-bone/30 text-bone transition-all duration-300 hover:border-bone hover:bg-bone hover:text-void"
              >
                <span aria-hidden="true">
                  →
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* SCROLL INDICATOR */}
        {/* ================================================== */}

        <div
          className="absolute bottom-5 left-1/2 z-20 hidden -translate-x-1/2 sm:block"
          aria-hidden="true"
        >
          <div className="h-8 w-px overflow-hidden bg-bone/20">
            <div className="h-full w-full origin-top animate-[heroScroll_2s_ease-in-out_infinite] bg-bone/70" />
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SCREEN READER */}
      {/* ==================================================== */}

      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        Slide{" "}
        {currentIndex + 1} of{" "}
        {slides.length}:{" "}
        {headline.join(" ")}
      </div>

      {/* ==================================================== */}
      {/* ANIMATIONS */}
      {/* ==================================================== */}

      <style jsx>{`
        @keyframes heroFadeIn {
          0% {
            opacity: 0;
            transform: scale(1.035);
          }

          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes heroSlideIn {
          0% {
            opacity: 0;
            transform: translateX(4%) scale(1.025);
          }

          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        @keyframes heroContentIn {
          0% {
            opacity: 0;
            transform: translateY(28px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes heroScroll {
          0% {
            transform: scaleY(0);
            transform-origin: top;
          }

          50% {
            transform: scaleY(1);
            transform-origin: top;
          }

          51% {
            transform-origin: bottom;
          }

          100% {
            transform: scaleY(0);
            transform-origin: bottom;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </section>
  );
}