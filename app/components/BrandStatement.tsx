"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSiteStore } from "@/app/store/useSiteStore";

gsap.registerPlugin(ScrollTrigger);

export default function BrandStatement() {
  const sectionRef = useRef<HTMLElement>(null);
  const line1Ref = useRef<HTMLDivElement>(null);
  const line2Ref = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const prefersReducedMotion = useSiteStore((s) => s.prefersReducedMotion);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set([line1Ref.current, line2Ref.current, bodyRef.current], { opacity: 1, y: 0 });
        return;
      }

      gsap.set([line1Ref.current, line2Ref.current], { yPercent: 110 });
      gsap.set(bodyRef.current, { opacity: 0, y: 16 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 65%",
          toggleActions: "play none none reverse",
        },
      });

      tl.to(line1Ref.current, { yPercent: 0, duration: 1, ease: "power4.out" })
        .to(line2Ref.current, { yPercent: 0, duration: 1, ease: "power4.out" }, "-=0.8")
        .to(bodyRef.current, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, "-=0.4");
    }, sectionRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[70vh] flex-col items-center justify-center bg-void px-6 py-32 text-center"
    >
      <p className="label-technical mb-8">02 — MANIFESTO</p>
      <h2 className="font-display text-[10vw] leading-[0.9] tracking-tight text-bone sm:text-7xl md:text-8xl">
        <span className="block overflow-hidden">
          <div ref={line1Ref}>NOT MADE</div>
        </span>
        <span className="block overflow-hidden">
          <div ref={line2Ref}>TO BLEND IN.</div>
        </span>
      </h2>
      <p ref={bodyRef} className="mt-10 max-w-lg text-balance text-sm text-stone sm:text-base">
        Mangosta is a new generation fashion label built for people who create their own rules.
      </p>
    </section>
  );
}
