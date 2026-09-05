"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCartStore } from "@/app/store/useCartStore";
import { formatPrice } from "@/app/data/productTypes";
import ProductPlaceholderArt from "./ProductPlaceholderArt";
import { useCursorHover } from "@/app/lib/useCursorHover";

export default function CartDrawer() {
  const { isBagOpen, closeBag, lines, updateQuantity, removeLine, subtotal } = useCartStore();
  const viewCursor = useCursorHover("view", "VIEW");
  const shopCursor = useCursorHover("shop", "SHOP");
  const [failedLines, setFailedLines] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isBagOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isBagOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isBagOpen) closeBag();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isBagOpen, closeBag]);

  return (
    <AnimatePresence>
      {isBagOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={closeBag}
            className="fixed inset-0 z-[9993] bg-void/70 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-[9994] flex w-full max-w-md flex-col bg-charcoal"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-6">
              <h2 className="label-technical">
                BAG {lines.length > 0 && `(${lines.length})`}
              </h2>
              <button
                type="button"
                onClick={closeBag}
                aria-label="Close bag"
                className="text-xl leading-none text-bone-dim transition-colors hover:text-bone"
                {...viewCursor}
              >
                &times;
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-sm text-stone">Your bag is empty.</p>
                <Link
                  href="/shop"
                  onClick={closeBag}
                  {...shopCursor}
                  className="border border-line-strong px-6 py-3 text-xs tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango"
                >
                  SHOP NOW
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <ul className="flex flex-col gap-6">
                    {lines.map((line) => (
                      <li key={line.lineId} className="flex gap-4">
                        <Link
                          href={`/product/${line.product.slug}`}
                          onClick={closeBag}
                          className="relative h-24 w-20 shrink-0 overflow-hidden bg-void"
                          {...viewCursor}
                        >
                          {line.product.images[0] && !failedLines.has(line.lineId) ? (
                            <Image
                              src={line.product.images[0]}
                              alt={line.product.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                              onError={() =>
                                setFailedLines((prev) => new Set(prev).add(line.lineId))
                              }
                            />
                          ) : (
                            <ProductPlaceholderArt seed={line.product.id} className="h-full w-full" />
                          )}
                        </Link>
                        <div className="flex flex-1 flex-col justify-between">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-bone">{line.product.name}</p>
                              <p className="mt-1 text-xs text-stone">
                                {line.color} / {line.size}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLine(line.lineId)}
                              aria-label={`Remove ${line.product.name}`}
                              className="text-xs text-stone-dark transition-colors hover:text-bone"
                            >
                              REMOVE
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center border border-line-strong">
                              <button
                                type="button"
                                onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                                aria-label="Decrease quantity"
                                className="flex h-7 w-7 items-center justify-center text-bone-dim transition-colors hover:text-bone"
                              >
                                −
                              </button>
                              <span className="w-6 text-center font-mono text-xs text-bone">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                                aria-label="Increase quantity"
                                className="flex h-7 w-7 items-center justify-center text-bone-dim transition-colors hover:text-bone"
                              >
                                +
                              </button>
                            </div>
                            <p className="font-mono text-sm text-bone-dim">
                              {formatPrice(line.product.price * line.quantity)}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-line px-6 py-6">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="label-technical">SUBTOTAL</span>
                    <span className="font-mono text-base text-bone">{formatPrice(subtotal())}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Link
                      href="/checkout"
                      onClick={closeBag}
                      className="border border-line-strong py-3.5 text-center text-xs font-medium tracking-[0.15em] text-bone transition-colors hover:border-bone"
                      {...viewCursor}
                    >
                      VIEW BAG
                    </Link>
                    <Link
                      href="/checkout"
                      onClick={closeBag}
                      className="bg-bone py-3.5 text-center text-xs font-medium tracking-[0.15em] text-void transition-colors hover:bg-mango"
                      {...shopCursor}
                    >
                      CHECKOUT
                    </Link>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
