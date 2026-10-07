"use client";

import gsap from "gsap";

/**
 * Animates a ghost element flying from the source element (e.g. product image)
 * toward the bag icon in the nav, then triggers the bag drawer callback.
 */
export function flyToBag(sourceEl: HTMLElement, onComplete?: () => void) {
  const bagIcon = document.querySelector('[aria-label^="Bag"]');
  if (!bagIcon || !sourceEl) {
    onComplete?.();
    return;
  }

  const sourceRect = sourceEl.getBoundingClientRect();
  const bagRect = bagIcon.getBoundingClientRect();

  const ghost = sourceEl.cloneNode(true) as HTMLElement;
  ghost.style.position = "fixed";
  ghost.style.top = `${sourceRect.top}px`;
  ghost.style.left = `${sourceRect.left}px`;
  ghost.style.width = `${sourceRect.width}px`;
  ghost.style.height = `${sourceRect.height}px`;
  ghost.style.zIndex = "9999";
  ghost.style.pointerEvents = "none";
  ghost.style.borderRadius = "2px";
  ghost.style.overflow = "hidden";
  document.body.appendChild(ghost);

  gsap.to(ghost, {
    top: bagRect.top + bagRect.height / 2,
    left: bagRect.left + bagRect.width / 2,
    width: 24,
    height: 24,
    opacity: 0.3,
    duration: 0.85,
    ease: "power2.in",
    onComplete: () => {
      ghost.remove();
      onComplete?.();
    },
  });

  gsap.to(bagIcon, {
    scale: 1.25,
    duration: 0.15,
    delay: 0.75,
    yoyo: true,
    repeat: 1,
    ease: "power2.out",
  });
}
