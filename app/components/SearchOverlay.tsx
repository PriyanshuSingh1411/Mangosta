"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCartStore } from "@/app/store/useCartStore";
import { formatPrice } from "@/app/data/productTypes";
import { useProducts } from "@/app/lib/useProducts";
import { useCursorHover } from "@/app/lib/useCursorHover";

const POPULAR = ["Hoodies", "T-Shirts", "New Drop", "Jackets"];

export default function SearchOverlay() {
  const { isSearchOpen, closeSearch } = useCartStore();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const viewCursor = useCursorHover("view", "VIEW");
  const { products } = useProducts();

  const results =
    query.trim().length > 0
      ? products.filter((p) =>
          `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase())
        )
      : [];

  useEffect(() => {
    if (isSearchOpen) {
      document.body.style.overflow = "hidden";
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSearchOpen) closeSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSearchOpen, closeSearch]);

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9996] flex flex-col bg-void/98 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <div className="flex items-center justify-between px-5 py-6 sm:px-8">
            <span className="label-technical">SEARCH</span>
            <button
              type="button"
              onClick={closeSearch}
              className="text-xs font-medium tracking-[0.12em] text-bone-dim transition-colors hover:text-bone"
              {...viewCursor}
            >
              CLOSE <span className="ml-1 text-stone">(ESC)</span>
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-5 pb-16 sm:px-8"
          >
            <div className="border-b border-line-strong py-6">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="SEARCH MANGOSTA"
                className="w-full bg-transparent font-display text-3xl tracking-tight text-bone placeholder:text-stone-dark focus:outline-none sm:text-5xl"
              />
            </div>

            {results.length === 0 && query.trim().length === 0 && (
              <div className="mt-10">
                <p className="label-technical mb-5">POPULAR SEARCHES</p>
                <div className="flex flex-wrap gap-3">
                  {POPULAR.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setQuery(term)}
                      className="border border-line-strong px-5 py-2.5 text-xs tracking-[0.1em] text-bone-dim transition-colors hover:border-mango hover:text-mango"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {query.trim().length > 0 && results.length === 0 && (
              <p className="mt-10 text-sm text-stone">No results for &ldquo;{query}&rdquo;.</p>
            )}

            {results.length > 0 && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                className="mt-10 flex flex-col divide-y divide-line"
              >
                {results.map((product) => (
                  <motion.div
                    key={product.id}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 },
                    }}
                  >
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={closeSearch}
                      className="flex items-center justify-between py-4 group"
                      {...viewCursor}
                    >
                      <span className="text-sm text-bone-dim transition-colors group-hover:text-bone">
                        {product.name}
                      </span>
                      <span className="font-mono text-sm text-stone">
                        {formatPrice(product.price)}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
