"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSiteStore } from "@/app/store/useSiteStore";

gsap.registerPlugin(ScrollTrigger);

interface CollectionSettings {
  collectionEnabled: boolean;
  collectionLabel: string;
  collectionTitle: string;
  collectionSubtitle: string;
  collectionDescription: string;
  collectionImage: string;
  collectionOverlayEnabled: boolean;
  collectionOverlayOpacity: number;
}

const DEFAULT_COLLECTION: CollectionSettings = {
  collectionEnabled: true,
  collectionLabel: "05 — NEW COLLECTION",
  collectionTitle: "MANGOSTA",
  collectionSubtitle: "FW / 26",
  collectionDescription:
    "Twelve pieces. One attitude. The Fall/Winter 2026 collection is built for movement in any city.",
  collectionImage: "",
  collectionOverlayEnabled: true,
  collectionOverlayOpacity: 45,
};

export default function CollectionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);

  const prefersReducedMotion = useSiteStore(
    (s) => s.prefersReducedMotion
  );

  const [settings, setSettings] =
    useState<CollectionSettings>(DEFAULT_COLLECTION);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/settings")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load collection settings.");
        }

        return res.json();
      })
      .then((data) => {
        if (cancelled) return;

        setSettings({
          ...DEFAULT_COLLECTION,
          collectionEnabled:
            Boolean(data.collectionEnabled),
          collectionLabel:
            typeof data.collectionLabel === "string"
              ? data.collectionLabel
              : DEFAULT_COLLECTION.collectionLabel,
          collectionTitle:
            typeof data.collectionTitle === "string"
              ? data.collectionTitle
              : DEFAULT_COLLECTION.collectionTitle,
          collectionSubtitle:
            typeof data.collectionSubtitle === "string"
              ? data.collectionSubtitle
              : DEFAULT_COLLECTION.collectionSubtitle,
          collectionDescription:
            typeof data.collectionDescription === "string"
              ? data.collectionDescription
              : DEFAULT_COLLECTION.collectionDescription,
          collectionImage:
            typeof data.collectionImage === "string"
              ? data.collectionImage
              : "",
          collectionOverlayEnabled:
            Boolean(data.collectionOverlayEnabled),
          collectionOverlayOpacity:
            typeof data.collectionOverlayOpacity === "number"
              ? data.collectionOverlayOpacity
              : DEFAULT_COLLECTION.collectionOverlayOpacity,
        });
      })
      .catch(() => {
        // Keep the default collection content if the public
        // settings endpoint is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        imgRef.current,
        { yPercent: -12 },
        {
          yPercent: 12,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        }
      );

      gsap.fromTo(
        headlineRef.current,
        {
          clipPath: "inset(0 0 100% 0)",
        },
        {
          clipPath: "inset(0 0 0% 0)",
          duration: 1.1,
          ease: "power4.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 60%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  if (!settings.collectionEnabled) {
    return null;
  }

  const overlayOpacity = Math.min(
    100,
    Math.max(0, settings.collectionOverlayOpacity)
  );

  return (
    <section
      ref={sectionRef}
      className="relative h-[110vh] overflow-hidden bg-void"
    >
      {/* Background */}
      <div
        ref={imgRef}
        className="absolute inset-0 h-[124%]"
      >
        {settings.collectionImage ? (
          <img
            src={settings.collectionImage}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-charcoal" />
        )}

        {settings.collectionOverlayEnabled && (
          <div
            className="absolute inset-0 bg-void"
            style={{
              opacity: overlayOpacity / 100,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="label-technical mb-6">
          {settings.collectionLabel}
        </p>

        <div ref={headlineRef}>
          <h2 className="font-display text-[14vw] leading-[0.85] tracking-tight text-bone sm:text-8xl md:text-9xl">
            {settings.collectionTitle}

            {settings.collectionSubtitle && (
              <>
                <br />
                {settings.collectionSubtitle}
              </>
            )}
          </h2>
        </div>

        <p className="mt-8 max-w-md text-balance text-sm text-bone-dim sm:text-base">
          {settings.collectionDescription}
        </p>
      </div>
    </section>
  );
}