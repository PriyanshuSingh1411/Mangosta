"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSiteStore } from "@/app/store/useSiteStore";

gsap.registerPlugin(ScrollTrigger);

export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useSiteStore((s) => s.prefersReducedMotion);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set(contentRef.current, { opacity: 1, y: 0 });
        return;
      }

      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
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
      className="relative overflow-hidden px-5 pb-28 pt-16 sm:px-8 sm:pb-40 sm:pt-24"
    >
      <div
        className="pointer-events-none absolute -right-[12vw] top-[8vw] h-[45vw] w-[45vw] rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "radial-gradient(circle, #c4ff61 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1600px]">
        <div className="border-b border-line pb-8 sm:pb-12">
          <div className="flex items-end justify-between gap-6">
            <p className="label-technical">07 — ABOUT MANGOSTA</p>
            <span className="hidden font-mono text-[10px] tracking-[0.18em] text-stone sm:block">FW / 26</span>
          </div>
          <h1 className="mt-8 font-display text-[18vw] leading-[0.76] tracking-[-0.075em] text-bone sm:text-[15vw] lg:text-[12.5vw]">
            ABOUT
          </h1>
        </div>

        <div ref={contentRef} className="grid gap-14 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          <div>
            <p className="max-w-3xl font-display text-3xl uppercase leading-[0.98] tracking-[-0.035em] text-bone sm:text-5xl lg:text-6xl">
              WE DON&apos;T FOLLOW THE CULTURE. WE CREATE IT.
            </p>
          </div>

          <div className="space-y-7">
            <p className="text-sm leading-relaxed text-bone-dim sm:text-base">
              Mangosta was founded on a simple observation: the mongoose survives by moving faster
              and thinking sharper than everything around it. We build clothing with the same
              instinct — quick, deliberate, built for people who don&apos;t wait for permission.
            </p>
            <p className="text-sm leading-relaxed text-stone sm:text-base">
              Every piece is designed in-house, cut in limited runs, and built to outlast the trend
              cycle it launches into. No filler drops. No noise. Just the next move.
            </p>
          </div>
        </div>

        <div className="mt-16 grid border-y border-line sm:mt-24 sm:grid-cols-3">
          <div className="border-b border-line px-0 py-7 sm:border-b-0 sm:border-r sm:py-9 sm:pr-8">
            <p className="label-technical mb-3">01 / FOUNDED</p>
            <p className="font-display text-4xl tracking-tight text-bone">2024</p>
          </div>
          <div className="border-b border-line px-0 py-7 sm:border-b-0 sm:border-r sm:px-8 sm:py-9">
            <p className="label-technical mb-3">02 / STUDIO</p>
            <p className="font-display text-4xl tracking-tight text-bone">GLOBAL</p>
          </div>
          <div className="px-0 py-7 sm:py-9 sm:pl-8">
            <p className="label-technical mb-3">03 / DROPS</p>
            <p className="font-display text-4xl tracking-tight text-bone">LIMITED</p>
          </div>
        </div>

        <div className="mt-16 flex flex-col justify-between gap-8 sm:mt-24 lg:flex-row lg:items-end">
          <p className="label-technical max-w-sm">DESIGNED IN-HOUSE / LIMITED RUNS / BUILT TO MOVE</p>
          <p className="max-w-xl text-sm leading-relaxed text-stone sm:text-base lg:text-right">
            The goal is simple: make fewer things, make them matter, and keep moving before the
            culture catches up.
          </p>
        </div>
      </div>
    </section>
  );
}
