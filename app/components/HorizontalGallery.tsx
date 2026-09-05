"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSiteStore } from "@/app/store/useSiteStore";

gsap.registerPlugin(ScrollTrigger);

export type MangostaStudio = {
  enabled: boolean;
  productId: string;
  title: string;
  image: string;
  tag: string;
  titleStyle: "display" | "body" | "technical" | "mono";
  link: string;
  order: number;
};

type HorizontalGalleryProps = {
  enabled: boolean;
  label: string;
  studios: MangostaStudio[];
};

function getTitleClass(
  style: MangostaStudio["titleStyle"]
) {
  switch (style) {
    case "body":
      return "font-body text-2xl tracking-tight text-bone sm:text-3xl";

    case "technical":
      return "label-technical text-bone";

    case "mono":
      return "font-mono text-2xl tracking-tight text-bone sm:text-3xl";

    case "display":
    default:
      return "font-display text-3xl tracking-tight text-bone sm:text-4xl";
  }
}

export default function HorizontalGallery({
  enabled,
  label,
  studios,
}: HorizontalGalleryProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = useSiteStore(
    (s) => s.prefersReducedMotion
  );

  /*
   * Only display:
   * - enabled Studio cards
   * - cards with an image
   *
   * Order is controlled by the Admin Panel.
   */
  const visibleStudios = [...studios]
    .filter(
      (studio) =>
        studio.enabled &&
        Boolean(studio.image)
    )
    .sort(
      (a, b) => a.order - b.order
    );

  /*
   * GSAP horizontal scroll
   */
  useEffect(() => {
    if (
      prefersReducedMotion ||
      !enabled ||
      visibleStudios.length === 0
    ) {
      return;
    }

    const ctx = gsap.context(() => {
      const track = trackRef.current;
      const section = sectionRef.current;

      if (!track || !section) {
        return;
      }

      const getScrollDistance = () =>
        Math.max(
          0,
          track.scrollWidth -
            window.innerWidth
        );

      gsap.to(track, {
        x: () => -getScrollDistance(),
        ease: "none",

        scrollTrigger: {
          trigger: section,
          start: "top top",

          end: () =>
            `+=${getScrollDistance()}`,

          scrub: 0.7,
          pin: true,

          invalidateOnRefresh: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [
    prefersReducedMotion,
    enabled,
    visibleStudios.length,
  ]);

  /*
   * Section disabled or no configured
   * Studio products.
   */
  if (
    !enabled ||
    visibleStudios.length === 0
  ) {
    return null;
  }

  /*
   * Reduced-motion layout
   */
  if (prefersReducedMotion) {
    return (
      <section className="bg-void px-5 py-24 sm:px-8">
        <p className="label-technical mb-8">
          {label}
        </p>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {visibleStudios.map(
            (studio, index) => {
              const card = (
                <div className="relative aspect-[3/4] overflow-hidden bg-charcoal">
                  <Image
                    src={studio.image}
                    alt={studio.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-transparent to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 p-5">
                    {studio.tag && (
                      <p className="label-technical mb-1">
                        {String(index + 1).padStart(
                          2,
                          "0"
                        )}{" "}
                        /{" "}
                        {visibleStudios.length} —{" "}
                        {studio.tag}
                      </p>
                    )}

                    <h3
                      className={getTitleClass(
                        studio.titleStyle
                      )}
                    >
                      {studio.title}
                    </h3>
                  </div>
                </div>
              );

              if (!studio.link) {
                return (
                  <div
                    key={`${studio.productId}-${index}`}
                  >
                    {card}
                  </div>
                );
              }

              return (
                <Link
                  key={`${studio.productId}-${index}`}
                  href={studio.link}
                  className="block"
                  aria-label={`View ${studio.title}`}
                >
                  {card}
                </Link>
              );
            }
          )}
        </div>
      </section>
    );
  }

  /*
   * Normal animated horizontal gallery
   */
  return (
    <section
      ref={sectionRef}
      className="relative h-[100svh] overflow-hidden bg-void"
    >
      {/* SECTION LABEL */}

      <div className="absolute left-5 top-8 z-10 sm:left-8 sm:top-10">
        <p className="label-technical">
          {label}
        </p>
      </div>

      {/* HORIZONTAL TRACK */}

      <div
        ref={trackRef}
        className="flex h-full items-center gap-6 pl-5 pr-[10vw] sm:gap-8 sm:pl-8"
      >
        {visibleStudios.map(
          (studio, index) => {
            const card = (
              <div className="relative h-[62vh] w-[68vw] shrink-0 overflow-hidden bg-charcoal sm:w-[32vw]">
                <Image
                  src={studio.image}
                  alt={studio.title}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 640px) 68vw, 32vw"
                  className="object-cover transition-transform duration-700 hover:scale-105"
                />

                {/* DARK GRADIENT */}

                <div className="absolute inset-0 bg-gradient-to-t from-void/90 via-void/10 to-transparent" />

                {/* CONTENT */}

                <div className="absolute inset-x-0 bottom-0 p-6">
                  {studio.tag && (
                    <p className="label-technical mb-1">
                      {String(index + 1).padStart(
                        2,
                        "0"
                      )}{" "}
                      /{" "}
                      {visibleStudios.length} —{" "}
                      {studio.tag}
                    </p>
                  )}

                  <h3
                    className={getTitleClass(
                      studio.titleStyle
                    )}
                  >
                    {studio.title}
                  </h3>
                </div>
              </div>
            );

            /*
             * Entire Studio card is clickable.
             */
            if (!studio.link) {
              return (
                <div
                  key={`${studio.productId}-${index}`}
                >
                  {card}
                </div>
              );
            }

            return (
              <Link
                key={`${studio.productId}-${index}`}
                href={studio.link}
                className="block shrink-0"
                aria-label={`View ${studio.title}`}
              >
                {card}
              </Link>
            );
          }
        )}
      </div>
    </section>
  );
}