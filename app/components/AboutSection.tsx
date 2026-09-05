"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSiteStore } from "@/app/store/useSiteStore";

gsap.registerPlugin(ScrollTrigger);

export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useSiteStore((s) => s.prefersReducedMotion);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set([headlineRef.current, bodyRef.current], { opacity: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        headlineRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 65%",
            toggleActions: "play none none reverse",
          },
        }
      );

      gsap.fromTo(
        bodyRef.current,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 55%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="relative overflow-hidden px-5 py-28 sm:px-8 sm:py-40"
    >
      <div
        className="pointer-events-none absolute -right-[10vw] -top-[10vw] h-[45vw] w-[45vw] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "radial-gradient(circle, #c4ff61 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-14 lg:grid-cols-[1.3fr_1fr] lg:gap-10">
        <div>
          <p className="label-technical mb-6">07 — ABOUT MANGOSTA</p>
          <h2
            ref={headlineRef}
            className="font-display text-[10vw] leading-[0.92] tracking-tight text-bone sm:text-6xl md:text-7xl"
          >
            WE DON&apos;T FOLLOW
            <br />
            THE CULTURE.
            <br />
            WE CREATE IT.
          </h2>
        </div>

        <div ref={bodyRef} className="flex flex-col gap-6 self-end">
          <p className="text-sm leading-relaxed text-bone-dim sm:text-base">
            Mangosta was founded on a simple observation: the mongoose survives by moving faster
            and thinking sharper than everything around it. We build clothing with the same
            instinct — quick, deliberate, built for people who don&apos;t wait for permission.
          </p>
          <p className="text-sm leading-relaxed text-stone sm:text-base">
            Every piece is designed in-house, cut in limited runs, and built to outlast the trend
            cycle it launches into. No filler drops. No noise. Just the next move.
          </p>
          <div className="hairline mt-2" />
          <dl className="grid grid-cols-3 gap-6 font-mono text-xs text-stone">
            <div>
              <dt className="mb-1 text-stone-dark">FOUNDED</dt>
              <dd className="text-bone-dim">2024</dd>
            </div>
            <div>
              <dt className="mb-1 text-stone-dark">STUDIO</dt>
              <dd className="text-bone-dim">GLOBAL</dd>
            </div>
            <div>
              <dt className="mb-1 text-stone-dark">DROPS</dt>
              <dd className="text-bone-dim">LIMITED</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
