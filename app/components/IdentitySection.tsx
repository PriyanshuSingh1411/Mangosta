"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type MangostaCodeStyle =
  | "display"
  | "body"
  | "technical"
  | "mono";

interface MangostaCodeBox {
  enabled: boolean;
  heading: string;
  description: string;
  headingStyle: MangostaCodeStyle;
  descriptionStyle: MangostaCodeStyle;
  productId: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  images?: string[];
}

interface SettingsResponse {
  mangostaCode?: MangostaCodeBox[];
}

const DEFAULT_BOXES: MangostaCodeBox[] = [
  {
    enabled: true,
    heading: "MOVE",
    description:
      "Designed for movement. Built for everyday life, from the street to wherever you go next.",
    headingStyle: "display",
    descriptionStyle: "body",
    productId: "",
  },
  {
    enabled: true,
    heading: "CREATE",
    description:
      "No borrowed formulas. Every piece starts with an idea and earns its place in the collection.",
    headingStyle: "display",
    descriptionStyle: "body",
    productId: "",
  },
  {
    enabled: true,
    heading: "DEFINE",
    description:
      "Your clothes should say something before you do. Wear what feels like you.",
    headingStyle: "display",
    descriptionStyle: "body",
    productId: "",
  },
];

function getHeadingClass(style: MangostaCodeStyle) {
  switch (style) {
    case "body":
      return "font-sans text-4xl font-bold leading-none";

    case "technical":
      return "label-technical text-xl";

    case "mono":
      return "font-mono text-4xl font-bold leading-none";

    case "display":
    default:
      return "font-display text-5xl font-bold leading-none sm:text-6xl";
  }
}

function getDescriptionClass(
  style: MangostaCodeStyle
) {
  switch (style) {
    case "display":
      return "font-display text-lg leading-relaxed text-bone-dim";

    case "technical":
      return "label-technical leading-relaxed text-stone";

    case "mono":
      return "font-mono text-sm leading-relaxed text-bone-dim";

    case "body":
    default:
      return "font-sans text-base leading-relaxed text-bone-dim";
  }
}

export default function IdentitySection() {
  const router = useRouter();

  const sectionRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  const [boxes, setBoxes] =
    useState<MangostaCodeBox[]>(DEFAULT_BOXES);

  const [products, setProducts] = useState<Product[]>(
    []
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/settings").then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load settings.");
        }

        return res.json();
      }),

      fetch("/api/products").then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load products.");
        }

        return res.json();
      }),
    ])
      .then(([settingsData, productsData]) => {
        if (cancelled) return;

        if (
          Array.isArray(
            settingsData?.mangostaCode
          )
        ) {
          setBoxes(
            [0, 1, 2].map(
              (index) =>
                settingsData.mangostaCode[index] ||
                DEFAULT_BOXES[index]
            )
          );
        }

        const productList = Array.isArray(productsData)
          ? productsData
          : Array.isArray(productsData?.products)
            ? productsData.products
            : [];

        setProducts(productList);
      })
      .catch(() => {
        // Keep defaults if public settings/products
        // are temporarily unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!itemsRef.current) return;

      gsap.fromTo(
        itemsRef.current.children,
        {
          y: 50,
          opacity: 0,
        },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.12,
          ease: "power4.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 40%",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, [boxes]);

  const visibleBoxes = boxes.filter(
    (box) => box.enabled
  );

  return (
    <section
      ref={sectionRef}
      className="relative w-full"
    >
      <div
        ref={itemsRef}
        className="grid grid-cols-1 border-y border-line md:grid-cols-3"
      >
        {visibleBoxes.map((box, visibleIndex) => {
          const originalIndex = boxes.indexOf(box);

          const product = products.find(
            (item) => item.id === box.productId
          );

          const hasProduct = Boolean(product);

          const handleClick = () => {
            if (!product) return;

            router.push(`/product/${product.slug}`);
          };

          return (
            <article
              key={`${originalIndex}-${box.productId}`}
              onClick={
                hasProduct
                  ? handleClick
                  : undefined
              }
              onKeyDown={(event) => {
                if (
                  hasProduct &&
                  (event.key === "Enter" ||
                    event.key === " ")
                ) {
                  event.preventDefault();
                  handleClick();
                }
              }}
              role={
                hasProduct
                  ? "link"
                  : undefined
              }
              tabIndex={
                hasProduct
                  ? 0
                  : undefined
              }
              className={`group relative min-h-[410px] border-line px-10 py-16 transition-colors md:min-h-[440px] ${
                visibleIndex > 0
                  ? "border-t md:border-l md:border-t-0"
                  : ""
              } ${
                hasProduct
                  ? "cursor-pointer hover:bg-charcoal"
                  : ""
              }`}
            >
              {/* Number */}

              <div className="flex items-center justify-between">
                <span className="h-2.5 w-2.5 rounded-full bg-mango transition-transform duration-300 group-hover:scale-125" />
              </div>

              {/* Content */}


<div className="mt-16">
  {/* Product Image */}
  {product?.images?.[0] && (
    <div className="mb-10 overflow-hidden border border-line">
      <img
        src={product.images[0]}
        alt={product.name}
        className="h-52 w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      />
    </div>
  )}

  {box.heading && (
    <h3
      className={`${getHeadingClass(
        box.headingStyle
      )} text-bone transition-transform duration-500 group-hover:translate-x-1`}
    >
      {box.heading}
    </h3>
  )}

  {box.description && (
    <p
      className={`mt-8 max-w-sm ${getDescriptionClass(
        box.descriptionStyle
      )}`}
    >
      {box.description}
    </p>
  )}
</div>

              {/* Product indicator */}

              {product && (
                <div className="absolute bottom-8 left-10 right-10 flex items-center justify-between border-t border-line pt-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="label-technical">
                    {product.name}
                  </span>

                  <span className="font-mono text-xs text-stone">
                    VIEW →
                  </span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}