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
  imagePosition: "center",

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
  /*
   * ============================================================
   * SITE STATE
   * ============================================================
   */

  const isLoaded = useSiteStore(
    (state) => state.isLoaded
  );

  const prefersReducedMotion = useSiteStore(
    (state) => state.prefersReducedMotion
  );

  /*
   * ============================================================
   * CAROUSEL STATE
   * ============================================================
   */

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [isPaused, setIsPaused] =
    useState(false);

  const [isAnimating, setIsAnimating] =
    useState(false);

  // The hero uses the uploaded image's natural aspect ratio.
  // The image itself controls the section height so no part of the artwork is cropped.

  /*
   * ============================================================
   * TOUCH STATE
   * ============================================================
   */

  const touchStartX = useRef<number | null>(
    null
  );

  const touchEndX = useRef<number | null>(
    null
  );

  const touchStartY = useRef<number | null>(
    null
  );

  const touchEndY = useRef<number | null>(
    null
  );

  /*
   * ============================================================
   * ANIMATION TIMER
   * ============================================================
   */

  const animationTimer =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

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
   * ============================================================
   * KEEP INDEX VALID
   * ============================================================
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

  /*
   * ============================================================
   * CURRENT SLIDE
   * ============================================================
   */

  const currentSlide =
    slides[currentIndex] ??
    slides[0] ??
    DEFAULT_SLIDE;

  /*
   * ============================================================
   * TRANSITION SETTINGS
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
    goToSlide(currentIndex + 1);
  }, [
    currentIndex,
    goToSlide,
  ]);

  const previousSlide = useCallback(() => {
    goToSlide(currentIndex - 1);
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
      settings.autoplayDuration || 6000
    );

    const timer = setInterval(() => {
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
   * KEYBOARD NAVIGATION
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

    touchStartY.current =
      event.touches[0]?.clientY ??
      null;

    touchEndX.current = null;
    touchEndY.current = null;
  };

  const handleTouchMove = (
    event: TouchEvent
  ) => {
    touchEndX.current =
      event.touches[0]?.clientX ??
      null;

    touchEndY.current =
      event.touches[0]?.clientY ??
      null;
  };

  const handleTouchEnd = () => {
    if (
      touchStartX.current === null ||
      touchEndX.current === null
    ) {
      return;
    }

    const distanceX =
      touchStartX.current -
      touchEndX.current;

    const distanceY =
      (touchStartY.current ?? 0) -
      (touchEndY.current ??
        touchStartY.current ??
        0);

    const minimumDistance = 50;

    if (
      Math.abs(distanceX) >=
        minimumDistance &&
      Math.abs(distanceX) >
        Math.abs(distanceY) * 1.4
    ) {
      if (distanceX > 0) {
        nextSlide();
      } else {
        previousSlide();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
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
   * Desktop image
   */
  const desktopImage = currentSlide.image || "";
  const mobileImage = currentSlide.mobileImage || desktopImage;

  const objectPosition =
    currentSlide.imagePosition ||
    "center";

  const destination =
    currentSlide.buttonUrl ||
    "/shop";

  /*
   * ============================================================
   * HERO
   * ============================================================
   */

  return (
    <section
      aria-label="Mangosta hero carousel"
      className="
        relative
        mt-[76px]
        w-full
        overflow-hidden
        bg-void
        touch-pan-y
        lg:mt-[50px]
      "
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
      {/*
       * Responsive frame: the same uploaded image is automatically
       * reframed for each viewport. An optional mobileImage can override
       * the artwork on phones, but it is never required.
       */}

      {/*
       * The uploaded artwork determines the hero height.
       * We deliberately do NOT use `fill`, `object-cover`, or a fixed
       * aspect-ratio frame here. The browser renders the image at 100% width
       * with auto height, so the complete uploaded artwork remains visible
       * on every screen size.
       */}

      {desktopImage ? (
        <div
          key={currentSlide.id}
          className={[
            "relative w-full overflow-hidden bg-void",
            transitionType === "slide"
              ? "animate-[heroSlideIn_900ms_cubic-bezier(.22,1,.36,1)_both]"
              : "animate-[heroFadeIn_900ms_ease-out_both]",
          ].join(" ")}
        >
          <picture className="block w-full">
            {mobileImage && mobileImage !== desktopImage ? (
              <source
                media="(max-width: 767px)"
                srcSet={mobileImage}
              />
            ) : null}

            <img
              src={desktopImage}
              alt={currentSlide.headlineLine1 || "MANGOSTA"}
              fetchPriority={currentIndex === 0 ? "high" : "auto"}
              decoding="async"
              className="block h-auto w-full max-w-none"
              style={{ objectPosition }}
            />
          </picture>
        </div>
      ) : (
        <div className="relative aspect-[16/9] w-full bg-charcoal" />
      )}

        {/*
         * ======================================================
         * TOP META
         * ======================================================
         */}

        <div
          className="
            absolute
            left-5
            right-5
            top-[92px]
            z-30

            sm:left-8
            sm:right-8
            sm:top-[100px]

            lg:left-10
            lg:right-10
            lg:top-[72px]
          "
        >
          <div className="flex items-start justify-between gap-4">

            {/* LEFT META */}

            <div className="min-w-0">
              <p className="label-technical text-bone">
                {currentSlide.topLabel}
              </p>

              {currentSlide.secondaryLabel && (
                <p
                  className="
                    mt-1
                    text-[9px]
                    uppercase
                    tracking-[0.24em]
                    text-stone
                  "
                >
                  {
                    currentSlide.secondaryLabel
                  }
                </p>
              )}
            </div>

            {/* RIGHT META */}

            <div className="min-w-0 text-right">
              <p className="label-technical text-bone">
                {currentSlide.issueLabel}
              </p>

              {currentSlide.issueSubtitle && (
                <p
                  className="
                    mt-1
                    text-[9px]
                    uppercase
                    tracking-[0.22em]
                    text-stone
                  "
                >
                  {
                    currentSlide.issueSubtitle
                  }
                </p>
              )}
            </div>
          </div>
        </div>

        {/*
         * ======================================================
         * MAIN CONTENT
         * ======================================================
         */}

        <div
          key={`${currentSlide.id}-content`}
          className={[
            "hero-content",
            "absolute",
            "left-5",
            "z-20",
            slides.length > 1
              ? "bottom-16 md:bottom-24"
              : "bottom-8 md:bottom-12",
            "max-w-[calc(100%-2.5rem)]",
            "sm:bottom-20",
            "sm:left-8",
            "sm:max-w-[calc(100%-4rem)]",
            "md:max-w-4xl",
            "lg:bottom-32",
            "lg:left-10",
            prefersReducedMotion
              ? ""
              : "animate-[heroContentIn_750ms_cubic-bezier(.22,1,.36,1)_both]",
          ].join(" ")}
        >
          {/* HEADLINE */}

          <h1
            className={[
              "hero-headline",
              "font-display",
              "uppercase",
              "break-words",
              "text-[7vw]",
              "leading-[0.84]",
              "tracking-[-0.055em]",
              "text-bone",

              "sm:text-[4rem]",
              "md:text-[5.25rem]",
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
            <p
              className="
                hero-description
                mt-3
                max-w-sm
                text-[11px]
                leading-[1.6]
                text-stone

                sm:mt-6
                sm:text-sm
              "
            >
              {
                currentSlide.description
              }
            </p>
          )}

          {/* CTA */}

          {currentSlide.buttonText && (
            <div className="mt-4 sm:mt-7">
              <Link
                href={destination}
                className="
                  group
                  inline-flex
                  items-center
                  gap-3
                  border
                  border-bone/70
                  px-3
                  py-2
                  text-[8px]
                  font-medium
                  uppercase
                  tracking-[0.15em]
                  text-bone
                  transition-all
                  duration-300

                  hover:border-bone
                  hover:bg-bone
                  hover:text-void

                  sm:gap-5
                  sm:px-6
                  sm:py-3.5
                  sm:text-[10px]
                  sm:tracking-[0.2em]
                "
              >
                <span>
                  {
                    currentSlide.buttonText
                  }
                </span>

                <span
                  className="
                    text-xs
                    transition-transform
                    duration-300
                    group-hover:translate-x-1

                    sm:text-sm
                  "
                >
                  →
                </span>
              </Link>
            </div>
          )}
        </div>

        {/*
         * ======================================================
         * CAROUSEL NAVIGATION
         * ======================================================
         */}

        {slides.length > 1 && (
          <div
            className="
              absolute
              bottom-3
              left-5
              right-5
              z-30
              flex
              items-end
              justify-between
              gap-2

              sm:bottom-8
              sm:left-8
              sm:right-8
              sm:gap-4

              lg:left-10
              lg:right-10
            "
          >
            {/* PROGRESS INDICATORS */}

            <div
              className="
                flex
                min-w-0
                flex-1
                items-end
                gap-1.5
                sm:max-w-[36rem]
              "
            >
              {slides.map(
                (slide, index) => {
                  const active =
                    index ===
                    currentIndex;

                  return (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Go to slide ${
                        index + 1
                      }`}
                      aria-current={
                        active
                          ? "true"
                          : undefined
                      }
                      onClick={() =>
                        goToSlide(index)
                      }
                      className="
                        group
                        relative
                        h-8
                        min-w-0
                        max-w-12
                        flex-1

                        sm:h-8
                      "
                    >
                      {/* SLIDE NUMBER */}

                      <span
                        className={[
                          "hero-slide-number",
                          "absolute",
                          "-top-5",
                          "left-0",
                          "text-[6px]",
                          "uppercase",
                          "tracking-[0.12em]",

                          "sm:-top-4",
                          "sm:text-[8px]",

                          active
                            ? "text-bone"
                            : "text-bone/45",
                        ].join(" ")}
                      >
                        {String(
                          index + 1
                        ).padStart(2, "0")}
                      </span>

                      {/* PROGRESS LINE */}

                      <span
                        className={[
                          "absolute",
                          "bottom-2",
                          "left-0",
                          "h-px",
                          "w-full",
                          "transition-all",
                          "duration-500",

                          "sm:bottom-1",

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

            {/* NAVIGATION CONTROLS */}

            <div
              className="
                flex
                shrink-0
                items-center
                gap-2

                sm:gap-4
              "
            >
              <span
                className="
                  hidden
                  text-[9px]
                  uppercase
                  tracking-[0.18em]
                  text-stone

                  sm:block
                "
              >
                {String(
                  currentIndex + 1
                ).padStart(2, "0")}

                {" / "}

                {String(
                  slides.length
                ).padStart(2, "0")}
              </span>

              {/* PREVIOUS */}

              <button
                type="button"
                aria-label="Previous slide"
                onClick={
                  previousSlide
                }
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  border
                  border-bone/30
                  text-bone
                  transition-all
                  duration-300

                  hover:border-bone
                  hover:bg-bone
                  hover:text-void

                  sm:h-9
                  sm:w-9
                "
              >
                <span
                  aria-hidden="true"
                  className="
                    text-xs
                    sm:text-base
                  "
                >
                  ←
                </span>
              </button>

              {/* NEXT */}

              <button
                type="button"
                aria-label="Next slide"
                onClick={nextSlide}
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  border
                  border-bone/30
                  text-bone
                  transition-all
                  duration-300

                  hover:border-bone
                  hover:bg-bone
                  hover:text-void

                  sm:h-9
                  sm:w-9
                "
              >
                <span
                  aria-hidden="true"
                  className="
                    text-xs
                    sm:text-base
                  "
                >
                  →
                </span>
              </button>
            </div>
          </div>
        )}
      {/*
       * ========================================================
       * SCREEN READER
       * ========================================================
       */}

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
    </section>
  );
}