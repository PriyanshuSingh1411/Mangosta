"use client";

import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/app/data/productTypes";
import type { DropSettings } from "@/app/lib/dataStore";

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

export default function DropShowcase({
  settings,
  products,
}: DropShowcaseProps) {
  if (!settings.enabled) return null;

  const cards = settings.products
    .filter((item) => item.enabled && item.productId)
    .sort((a, b) => a.order - b.order)
    .map((item) => {
      const product = products.find(
        (candidate) => candidate.id === item.productId
      );

      if (!product || !product.images?.[0]) return null;

      return {
        item,
        product,
        image: product.images[0],
        title: item.title.trim() || product.name,
        href: item.link.trim() || `/product/${product.slug}`,
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);

  return (
    <section className="relative overflow-hidden bg-void py-20 sm:py-28">
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12">
        <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
          <div>
            <p className="label-technical mb-3 text-stone">
              {settings.label}
            </p>
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
          <div className="grid grid-cols-1 gap-px bg-line-strong sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ item, product, image, title, href }, index) => (
              <Link
                key={`${item.productId}-${index}`}
                href={href}
                className="group relative bg-void"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-void">
                  <Image
                    src={image}
                    alt={title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";

                      const fallback =
                        event.currentTarget.parentElement?.querySelector(
                          "[data-drop-image-fallback]"
                        ) as HTMLElement | null;

                      if (fallback) {
                        fallback.style.display = "flex";
                      }
                    }}
                  />

                  <div
                    data-drop-image-fallback
                    className="absolute inset-0 hidden items-center justify-center bg-void"
                  >
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-line-strong">
                        <span className="font-display text-2xl text-bone">
                          M
                        </span>
                      </div>

                      <p className="font-display text-sm uppercase tracking-[0.2em] text-bone">
                        MANGOSTA
                      </p>

                      <p className="label-technical mt-2 text-stone">
                        IMAGE UNAVAILABLE
                      </p>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80" />
                  <div className="absolute left-3 top-3">
                    <span className="label-technical text-bone">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                </div>

                <div className="flex min-h-[110px] flex-col justify-between p-4 sm:p-5">
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-stone">
                      MANGOSTA
                    </p>
                    <h3
                      className={`${titleFontClass[item.titleStyle]} text-sm uppercase tracking-tight text-bone sm:text-base`}
                    >
                      {title}
                    </h3>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-stone transition-colors group-hover:text-bone">
                    <span>VIEW PRODUCT</span>
                    <span>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-line-strong px-5 py-16 text-center">
            <p className="label-technical text-stone">
              NO DROP PRODUCTS CONFIGURED
            </p>
          </div>
        )}

        <Link
          href="/shop"
          className="mt-6 inline-flex border border-line-strong px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void sm:hidden"
        >
          SHOP ALL →
        </Link>
      </div>
    </section>
  );
}
