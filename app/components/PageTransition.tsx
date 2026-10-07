"use client";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useSiteStore } from "@/app/store/useSiteStore";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useSiteStore((s) => s.prefersReducedMotion);
  return (
    <motion.div key={pathname} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.28, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
