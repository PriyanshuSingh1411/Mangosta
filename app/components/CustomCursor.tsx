"use client";

import { useEffect, useRef, useState } from "react";
import { useSiteStore } from "@/app/store/useSiteStore";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cursorVariant = useSiteStore((s) => s.cursorVariant);
  const cursorLabel = useSiteStore((s) => s.cursorLabel);
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => {
    const touch = window.matchMedia("(pointer: coarse), (hover: none)").matches;
    setIsTouch(touch);
    if (touch) return;

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%,-50%)`;
      }
    };

    const tick = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%,-50%)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (isTouch) return null;

  const isExpanded = cursorVariant !== "default" && cursorVariant !== "hidden";
  const isHidden = cursorVariant === "hidden";

  return (
    <>
      <div
        ref={dotRef}
        className="cursor-dot"
        style={{ opacity: isHidden ? 0 : 1 }}
        aria-hidden="true"
      />
      <div
        ref={ringRef}
        className="cursor-ring"
        aria-hidden="true"
        style={{
          width: isExpanded ? 68 : 40,
          height: isExpanded ? 68 : 40,
          opacity: isHidden ? 0 : 1,
          backgroundColor: isExpanded ? "rgba(196,255,97,0.95)" : "transparent",
          borderColor: isExpanded ? "transparent" : "var(--color-bone)",
          color: isExpanded ? "var(--color-void)" : "var(--color-bone)",
        }}
      >
        {isExpanded && cursorLabel}
      </div>
    </>
  );
}
