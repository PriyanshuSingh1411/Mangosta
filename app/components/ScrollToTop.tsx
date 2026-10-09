"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * "Back to top" button (bottom-left, larger screens) once the page has
 * been scrolled. Not shown in the admin panel, where that corner holds the
 * sidebar's Log out link.
 */
export default function ScrollToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible || pathname.startsWith("/admin")) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className="fixed bottom-5 left-5 z-[9990] hidden h-10 w-10 border border-line-strong bg-void/90 text-bone backdrop-blur sm:flex sm:items-center sm:justify-center hover:border-bone"
    >
      ↑
    </button>
  );
}
