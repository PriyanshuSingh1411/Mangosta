"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/app/data/productTypes";
import { formatPrice } from "@/app/data/productTypes";
import type { DropSettings } from "@/app/lib/dataStore";
import ProductQuickAddModal from "./ProductQuickAddModal";

type DropShowcaseProps = {
  settings: DropSettings;
  products: Product[];
};

const titleFontClass: Record<DropSettings["products"][number]["titleStyle"], string> = {
  display: "font-display",
  body: "font-body",
  technical: "font-technical",
  mono: "font-mono",
};

export default function DropShowcase({ settings, products }: DropShowcaseProps) {
  const [quickAddProduct, setQuickAddProduct] = useState<Product | null>(null);

  if (!settings.enabled) return null;

  const cards = settings.products
    .filter((item) => item.enabled && item.productId)
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) return null;
      return {
        item,
        product,
        image: product.images?.[0] || null,
        title: item.title.trim() || product.name,
        href: item.link.trim() || `/product/${product.slug}`,
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);

  const getGridClasses = () => {
    const count = cards.length;
    let classes = "grid grid-cols-2 gap-px bg-line-strong sm:grid-cols-3";
    if (count >= 4) classes += " lg:grid-cols-4";
    else if (count === 3) classes += " lg:grid-cols-3";
    else if (count === 2) classes += " lg:grid-cols-2";
    return classes;
  };

  return (
    <section className="relative overflow-hidden bg-void py-20 sm:py-28">
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12">
        <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
          <div>
            <p className="label-technical mb-3 text-stone">{settings.label}</p>
            <h2 className="font-display text-4xl uppercase tracking-[-0.04em] text-bone sm:text-6xl">
              {settings.title}
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden border border-line-strong px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void sm:inline-flex"
          >
            SHOP ALL →
          </Link>
        </div>

        {cards.length > 0 ? (
          <div className={getGridClasses()}>
            {cards.map(({ item, product, image, title, href }, index) => (
              <article key={`${item.productId}-${index}`} className="group relative bg-void">
                <Link href={href} className="block">
                  <div className="relative aspect-[4/5] overflow-hidden bg-charcoal">
                    {image ? (
                      <Image
                        src={image}
                        alt={title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-contain object-center transition-transform duration-700 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-stone to-charcoal">
                        <span className="font-display text-6xl text-bone/40">M</span>
                      </div>
                    )}
                  </div>
                </Link>

                <div className="flex items-start justify-between gap-3 bg-void p-3 sm:p-4">
                  <Link href={href} className="min-w-0 flex-1">
                    <p className={`truncate text-xs font-medium uppercase tracking-[0.16em] text-bone sm:text-[10px] ${titleFontClass[item.titleStyle]}`}>
                      {title}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex gap-1.5" aria-label={`Available colors: ${product.colors.map((c) => c.name).join(", ")}`}>
                        {product.colors.map((color) => (
                          <span
                            key={color.name}
                            className="h-3 w-3 rounded-full border border-line-strong"
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          />
                        ))}
                      </div>
                      <span className="font-mono text-xs text-bone-dim">{formatPrice(product.price)}</span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setQuickAddProduct(product)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong text-xl leading-none text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void"
                    aria-label={`Add ${product.name} to bag`}
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 rounded border border-line-strong bg-void py-20 text-center">
            <p className="text-sm text-stone">No drops available at the moment.</p>
          </div>
        )}
      </div>

      <ProductQuickAddModal product={quickAddProduct} onClose={() => setQuickAddProduct(null)} />
    </section>
  );
}
