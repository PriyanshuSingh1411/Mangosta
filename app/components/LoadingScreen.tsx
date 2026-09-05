"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import Image from "next/image";
import { useSiteStore } from "@/app/store/useSiteStore";

export default function LoadingScreen() {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [isDone, setIsDone] = useState(false);
  const setLoaded = useSiteStore((s) => s.setLoaded);
  const prefersReducedMotion = useSiteStore((s) => s.prefersReducedMotion);

  useEffect(() => {
    const counterObj = { value: 0 };
    const tl = gsap.timeline({
      defaults: { ease: "power2.inOut" },
      onComplete: () => {
        setLoaded();
        // allow the reveal transition to play before unmounting
        gsap.delayedCall(prefersReducedMotion ? 0.05 : 0.9, () => setIsDone(true));
      },
    });

    if (prefersReducedMotion) {
      // Fast, minimal path: skip the theatrical count-up entirely.
      if (counterRef.current) counterRef.current.textContent = "100";
      tl.to(containerRef.current, { opacity: 0, duration: 0.2, delay: 0.1 });
      return () => {
        tl.kill();
      };
    }

    tl.set(logoRef.current, { opacity: 0, y: 14 })
      .to(logoRef.current, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" })
      .to(
        counterObj,
        {
          value: 100,
          duration: 2.1,
          ease: "power1.inOut",
          onUpdate: () => {
            if (counterRef.current) {
              counterRef.current.textContent = String(Math.floor(counterObj.value)).padStart(2, "0");
            }
          },
        },
        "-=0.5"
      )
      .to(lineRef.current, { scaleX: 1, duration: 2.1, ease: "power1.inOut" }, "<")
      .to(logoRef.current, { scale: 1.06, duration: 0.45, ease: "power2.out" }, ">-0.1")
      .to(containerRef.current, { yPercent: -100, duration: 1.0, ease: "power4.inOut" }, ">-0.05");

    return () => {
      tl.kill();
    };
  }, [setLoaded, prefersReducedMotion]);

  if (isDone) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9997] flex flex-col items-center justify-center bg-void"
      role="status"
      aria-live="polite"
      aria-label="Loading Mangosta"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMDAnIGhlaWdodD0nMjAwJz48ZmlsdGVyIGlkPSdub2lzZSc+PGZlVHVyYnVsZW5jZSB0eXBlPSdmcmFjdGFsTm9pc2UnIGJhc2VGcmVxdWVuY3k9JzAuOScgbnVtT2N0YXZlcz0nMicgc3RpdGNoVGlsZXM9J3N0aXRjaCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxMDAlJyBoZWlnaHQ9JzEwMCUnIGZpbHRlcj0ndXJsKCNub2lzZSknLz48L3N2Zz4=\")",
        }}
      />

      <div ref={logoRef} className="relative flex flex-col items-center gap-6">
        <div className="relative h-16 w-16 sm:h-20 sm:w-20">
          <Image
            src="/images/mark-white.png"
            alt=""
            fill
            sizes="80px"
            className="object-contain"
            priority
          />
        </div>
        <h1 className="font-display text-[13vw] leading-[0.85] tracking-tight text-bone sm:text-[7rem]">
          MANGOSTA
        </h1>
      </div>

      <div className="mt-10 flex items-center gap-4 font-mono text-xs tracking-[0.2em] text-stone">
        <span ref={counterRef}>00</span>
        <div className="relative h-px w-32 overflow-hidden bg-line sm:w-48">
          <div
            ref={lineRef}
            className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-bone"
          />
        </div>
        <span>100</span>
      </div>
    </div>
  );
}
