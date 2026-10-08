"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Product, ProductColor } from "@/app/data/productTypes";
import {
  formatPrice,
  getColorImages,
  getProductSalePrice,
  getVariantStock,
  hasProductDiscount,
  getProductStrikethroughPrice,
  ONE_SIZE,
} from "@/app/data/productTypes";
import type { DropSettings, RailSettings } from "@/app/lib/dataStore";
import { maxAllowedForLine, useCartStore } from "@/app/store/useCartStore";
import { flyToBag } from "@/app/lib/flyToBag";
import { useAuth } from "@/app/components/AuthProvider";
import WishlistButton from "@/app/components/WishlistButton";
import SizeGuideLink from "@/app/components/SizeGuide";
import NotifyMe from "@/app/components/NotifyMe";
import ProductCard from "./ProductCard";

type DropShowcaseProps = {
  settings: DropSettings;
  products: Product[];
};

const titleFontClass: Record<
  DropSettings["products"][number]["titleStyle"],
  string
> = {
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
    .filter(
      (item) =>
        item.enabled &&
        item.productId
    )
    .sort(
      (a, b) =>
        a.order - b.order
    )
    .map((item) => {
      const product = products.find(
        (candidate) =>
          candidate.id === item.productId
      );

      if (!product) return null;

      return {
        item,
        product,
        title:
          item.title.trim() ||
          product.name,
        href:
          item.link.trim() ||
          `/product/${product.slug}`,
      };
    })
    .filter(
      (
        card
      ): card is NonNullable<
        typeof card
      > => card !== null
    );

  /*
   * Same grid as every product listing on the site:
   * phones  → 2 columns, edge to edge, 4px gap (like the reference)
   * tablet+ → normal page padding, roomier gaps
   */
  const getGridClasses = () => {
    const count = cards.length;

    let classes =
      "-mx-5 grid grid-cols-2 gap-x-1 gap-y-8 sm:mx-0 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-12";

    if (count >= 4) {
      classes += " lg:grid-cols-4";
    } else if (count === 3) {
      classes += " lg:grid-cols-3";
    } else if (count === 2) {
      classes += " lg:grid-cols-2";
    }

    return classes;
  };

  return (
    <section className="relative overflow-hidden bg-void pt-8 pb-20 sm:pt-12 sm:pb-28">
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12">
        {/* =========================================================
            HEADER
        ========================================================= */}
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

        {/* =========================================================
            DROP PRODUCTS — shared site-wide product card
        ========================================================= */}
        {cards.length > 0 ? (
          <div className={getGridClasses()}>
            {cards.map(({ item, product, title, href }, index) => (
              <ProductCard
                key={`${item.productId}-${index}`}
                product={product}
                href={href}
                title={title}
                titleClassName={titleFontClass[item.titleStyle]}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 rounded border border-line-strong bg-void py-20 text-center">
            <p className="text-sm text-stone">
              No drops available at the moment.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
/* =====================================================================
 * ON THE RAIL
 *
 * Homepage "clothes on a rail" section (managed from
 * Admin → Settings → On the Rail).
 *
 * - Desktop: hover a garment to turn it to the front and enlarge it,
 *   click it to open the product view.
 * - Touch:   tap a garment to turn it, tap it again to open the view.
 * - Product view: FRONT / BACK flip, colour, size, ADD TO BAG and a
 *   link to the full product page.
 * ===================================================================== */

type RailShowcaseProps = {
  settings: RailSettings;
  products: Product[];
};

type RailGarment = {
  key: string;
  product: Product;
  title: string;
  front: string;
  /** Empty string when the garment has no back view. */
  back: string;
  /** Admin uploaded rail-specific images (used for every colour). */
  customImages: boolean;
};

const RAIL_LIMIT = 20;
const RAIL_HOVER_QUERY = "(hover: hover) and (pointer: fine)";

/** Phones (same breakpoint as Admin → On the Rail → "Show on phones"). */
const RAIL_PHONE_QUERY = "(max-width: 767px)";
/** Garments on the rail at a time on phones. */
const RAIL_PHONE_GROUP = 3;
/**
 * Space kept at each end of the rail for the ‹ › buttons on phones
 * (the buttons also use the page's side margin, so this can stay small).
 */
const RAIL_ARROW_SPACE = 22;
/** Phones: the 3 garments hang straight; the others are this much of the selected one. */
const RAIL_PHONE_IDLE_RATIO = 0.84;
/** Phones: gap between the 3 garments (px). */
const RAIL_PHONE_GAP = 6;
/** Horizontal finger movement (px) that counts as a swipe. */
const RAIL_SWIPE_DISTANCE = 40;

/** Width of the 3D-turned hanger compared with the facing one. */
const RAIL_IDLE_ROTATION = 66;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * next/image only optimises hosts listed in next.config.ts
 * (res.cloudinary.com) and local files. Any other pasted URL is
 * shown as-is so it can never crash the page.
 */
function isOptimizableImage(src: string) {
  return (
    src.startsWith("/") ||
    src.startsWith("https://res.cloudinary.com/")
  );
}

function buildRailGarments(
  settings: RailSettings,
  products: Product[]
): RailGarment[] {
  const chosen = settings.items
    .filter((item) => item.enabled && item.productId)
    .sort((a, b) => a.order - b.order)
    .map((item, index) => {
      const product = products.find(
        (candidate) => candidate.id === item.productId
      );

      if (!product) return null;

      const photos = getColorImages(product, product.colors[0]?.name);
      const front = item.frontImage.trim() || photos[0] || "";

      if (!front) return null;

      return {
        key: `${product.id}-${index}`,
        product,
        title: item.title.trim() || product.name,
        front,
        back: item.backImage.trim() || photos[1] || "",
        customImages: Boolean(item.frontImage.trim() || item.backImage.trim()),
      } satisfies RailGarment;
    })
    .filter(
      (garment): garment is RailGarment => garment !== null
    );

  if (chosen.length > 0) {
    return chosen.slice(0, RAIL_LIMIT);
  }

  // Nothing chosen in Admin → every product that has an image.
  return products
    .map((product) => ({
      product,
      photos: getColorImages(product, product.colors[0]?.name),
    }))
    .filter(({ photos }) => Boolean(photos[0]))
    .slice(0, RAIL_LIMIT)
    .map(({ product, photos }) => ({
      key: product.id,
      product,
      title: product.name,
      front: photos[0],
      back: photos[1] || "",
      customImages: false,
    }));
}

function subscribeToHoverQuery(onChange: () => void) {
  const query = window.matchMedia(RAIL_HOVER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useCanHover() {
  return useSyncExternalStore(
    subscribeToHoverQuery,
    () => window.matchMedia(RAIL_HOVER_QUERY).matches,
    () => true
  );
}

function subscribeToPhoneQuery(onChange: () => void) {
  const query = window.matchMedia(RAIL_PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsPhone() {
  return useSyncExternalStore(
    subscribeToPhoneQuery,
    () => window.matchMedia(RAIL_PHONE_QUERY).matches,
    () => false
  );
}

/**
 * First garment of each group of 3 on phones. The last group always
 * shows 3 garments, so it can repeat some of the previous group
 * (11 garments → 1–3, 4–6, 7–9, 9–11).
 */
function phoneGroupStarts(count: number): number[] {
  if (count <= RAIL_PHONE_GROUP) return [0];

  const starts: number[] = [];
  for (let index = 0; index < count; index += RAIL_PHONE_GROUP) {
    const start = Math.min(index, count - RAIL_PHONE_GROUP);
    if (!starts.includes(start)) starts.push(start);
  }
  return starts;
}

/** Wooden hanger with a metal hook (drawn behind the garment). */
function RailHanger({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 44"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      {/* hook */}
      <path
        d="M50 22 V11 C50 4.5 57.5 2.5 59 7.5"
        stroke="var(--color-silver)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* wooden body */}
      <path
        d="M50 19 L9 37.5 Q4.5 40 9.5 41.5 H90.5 Q95.5 40 91 37.5 Z"
        fill="#8b5e3c"
      />
      <path
        d="M10 40.2 H90"
        stroke="#5e3d25"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="50" cy="20.5" r="2.4" fill="#5e3d25" />
    </svg>
  );
}

function RailPrice({
  product,
  large = false,
}: {
  product: Product;
  large?: boolean;
}) {
  const salePrice = getProductSalePrice(product);
  const strikethrough = getProductStrikethroughPrice(product);
  const discountPercent = Math.round(
    Number(product.discountPercent) || 0
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
      {strikethrough !== null && (
        <span
          className={`font-mono text-stone-dark line-through ${
            large ? "text-sm" : "text-[10px]"
          }`}
        >
          {formatPrice(strikethrough)}
        </span>
      )}

      <span
        className={`font-mono text-bone-dim ${
          large ? "text-base" : "text-xs"
        }`}
      >
        {formatPrice(salePrice)}
      </span>

      {hasProductDiscount(product) && discountPercent > 0 && (
        <span className="text-[10px] font-medium tracking-[0.12em] text-mango">
          {discountPercent}% OFF
        </span>
      )}
    </div>
  );
}

export function RailShowcase({
  settings,
  products,
}: RailShowcaseProps) {
  const garments = buildRailGarments(settings, products);
  const count = garments.length;

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, Math.floor((count - 1) / 2))
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(1200);
  // Phones: which group of 3 garments is on the rail, and the side the
  // group slid in from (+1 next, −1 previous, 0 no slide).
  const [group, setGroup] = useState({ index: 0, direction: 0 });

  const canHover = useCanHover();
  const isPhone = useIsPhone();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastPointerType = useRef<string>("");
  const activeRef = useRef(activeIndex);
  const openRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  // ------------------------------------------------------------
  // Measure the available width (fires once on mount too).
  // ------------------------------------------------------------
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const width = Math.round(
        entries[0]?.contentRect.width ?? 0
      );

      if (width > 0) {
        setTrackWidth(width);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // ------------------------------------------------------------
  // Phones: 3 garments at a time, ‹ › / swipe for the next 3.
  // ------------------------------------------------------------
  const groupStarts = phoneGroupStarts(count);
  const showArrows = isPhone && groupStarts.length > 1;
  const safeGroup = Math.min(group.index, groupStarts.length - 1);
  const groupStart = isPhone ? groupStarts[safeGroup] : 0;
  const visibleCount = isPhone
    ? Math.min(RAIL_PHONE_GROUP, count)
    : count;

  // ------------------------------------------------------------
  // Sizes. Tablets / computers: one garment faces the front, the rest
  // are turned. Phones: all 3 hang straight, facing front, side by
  // side — the selected one a little bigger.
  // ------------------------------------------------------------
  const clampedActive = Math.min(activeIndex, Math.max(0, count - 1));
  // On phones the facing garment is always one of the 3 on the rail
  // (the middle one when a new group comes in).
  const safeActive =
    isPhone &&
    (clampedActive < groupStart ||
      clampedActive >= groupStart + visibleCount)
      ? groupStart + Math.floor((visibleCount - 1) / 2)
      : clampedActive;

  // Phones: room for the ‹ › buttons at both ends of the rail.
  const railSpace = showArrows
    ? trackWidth - RAIL_ARROW_SPACE * 2
    : trackWidth;
  const gap = isPhone ? RAIL_PHONE_GAP : 0;
  const others = Math.max(0, visibleCount - 1);
  const activeWidth = Math.round(
    isPhone
      ? clampNumber(
          (railSpace - gap * others) / (1 + RAIL_PHONE_IDLE_RATIO * others),
          80,
          220
        )
      : clampNumber(trackWidth * 0.24, 150, 280)
  );
  // Turned garments look wider than their slot, so keep a little room
  // at both ends of the rail for the first and last garment. Phones
  // don't turn them, so no extra room is needed there.
  const edgePad = isPhone ? 0 : Math.round(activeWidth * 0.2);
  const idleWidth = isPhone
    ? Math.floor(activeWidth * RAIL_PHONE_IDLE_RATIO)
    : visibleCount > 1
      ? Math.floor(
          clampNumber(
            (railSpace - activeWidth - edgePad * 2) / (visibleCount - 1),
            36,
            84
          )
        )
      : 0;
  const rowWidth = activeWidth + (idleWidth + gap) * others;
  // Phones never scroll the rail — the 3 garments always fit.
  const overflows = !isPhone && rowWidth + edgePad * 2 > trackWidth + 1;
  const hookHeight = settings.showHangers
    ? Math.round(activeWidth * 0.2)
    : 14;
  const garmentHeight = Math.round(activeWidth * 1.22);
  // The bar sits inside the curl of the hanger hooks.
  const barTop =
    6 + (settings.showHangers ? Math.round(activeWidth * 0.036) : 0);

  /** Scroll position that centres garment `index` once it faces front. */
  const centreScrollLeft = useCallback(
    (index: number) =>
      Math.max(
        0,
        edgePad +
          idleWidth * index +
          activeWidth / 2 -
          trackWidth / 2
      ),
    [edgePad, idleWidth, activeWidth, trackWidth]
  );

  // Phones / small tablets: the rail is wider than the screen, so keep
  // the facing garment centred on first paint and after a resize.
  useEffect(() => {
    const element = scrollerRef.current;
    if (!element || !overflows) return;

    element.scrollTo({
      left: centreScrollLeft(activeRef.current),
    });
  }, [overflows, centreScrollLeft]);

  /**
   * Turns garment `index` to the front. `scroll` is only used for taps
   * and keyboard focus — never for mouse hover, otherwise the rail
   * would slide away under the cursor.
   */
  const selectGarment = (index: number, scroll = false) => {
    activeRef.current = index;
    setActiveIndex(index);

    const element = scrollerRef.current;
    if (scroll && element && overflows) {
      element.scrollTo({
        left: centreScrollLeft(index),
        behavior: "smooth",
      });
    }
  };

  const openView = (index: number) => {
    activeRef.current = index;
    openRef.current = index;
    setActiveIndex(index);
    setOpenIndex(index);
  };

  const closeView = useCallback(() => {
    const current = openRef.current;
    openRef.current = null;
    setOpenIndex(null);

    if (current !== null) {
      // Return keyboard focus to the garment that was open.
      window.requestAnimationFrame(() =>
        itemRefs.current[current]?.focus({ preventScroll: true })
      );
    }
  }, []);

  const navigateView = useCallback(
    (next: number) => {
      if (count === 0) return;
      const wrapped = (next + count) % count;
      activeRef.current = wrapped;
      openRef.current = wrapped;
      setActiveIndex(wrapped);
      setOpenIndex(wrapped);

      // Phones: keep the garment shown in the product view on the rail
      // (so closing the view lands on the right group of 3).
      const inGroup = (start: number) =>
        wrapped >= start && wrapped < start + RAIL_PHONE_GROUP;
      if (!inGroup(groupStarts[safeGroup] ?? 0)) {
        const found = groupStarts.findIndex(inGroup);
        if (found >= 0) setGroup({ index: found, direction: 0 });
      }
    },
    [count, groupStarts, safeGroup]
  );

  /** Phones: show the next (+1) or previous (−1) group of 3. Loops. */
  const goToGroup = (step: number) => {
    const total = groupStarts.length;
    if (total < 2) return;

    const next = (safeGroup + step + total) % total;
    const start = groupStarts[next];
    const middle = start + Math.floor((visibleCount - 1) / 2);

    setGroup({ index: next, direction: step });
    setActiveIndex(middle);
  };

  // Slide the new group of 3 in from the side it came from.
  useEffect(() => {
    const direction = group.direction;
    const list = listRef.current;
    if (!direction || !list || typeof list.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    list.animate(
      [
        { opacity: 0, transform: `translateX(${direction * 28}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  }, [group]);

  const handleItemClick = (index: number) => {
    const pointer = lastPointerType.current;
    lastPointerType.current = "";

    // A swipe that ended on a garment changes the group — it's not a tap.
    if (swiped.current) {
      swiped.current = false;
      return;
    }

    // Touch / pen: first tap turns the garment, second tap opens it.
    if (
      (pointer === "touch" || pointer === "pen") &&
      index !== (isPhone ? safeActive : activeRef.current)
    ) {
      selectGarment(index, true);
      return;
    }

    openView(index);
  };

  if (!settings.enabled || count === 0) return null;

  const active = garments[safeActive];
  const hint = canHover
    ? "HOVER TO SEE — CLICK TO EXPLORE"
    : isPhone
      ? "TAP TO SELECT — TAP AGAIN TO EXPLORE"
      : "TAP TO TURN — TAP AGAIN TO EXPLORE";

  return (
    <section
      id="on-the-rail"
      aria-label={settings.label || "On the rail"}
      className={`relative overflow-hidden bg-void pt-16 pb-8 sm:pt-24 sm:pb-12 ${
        // Admin "Show on phones" off → hidden below 768px only.
        settings.showOnMobile ? "" : "hidden md:block"
      }`}
    >
      {/* soft spotlight behind the rail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto h-[60%] max-w-4xl rounded-full bg-bone/[0.04] blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12">
        {/* ============================================================
            LABELS
        ============================================================ */}
        <div className="mb-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-center sm:mb-14">
          {settings.label && (
            <p className="label-technical !text-bone">
              {settings.label}
            </p>
          )}
          {settings.secondaryLabel && (
            <p className="label-technical">
              {settings.secondaryLabel}
            </p>
          )}
        </div>

        {/* ============================================================
            THE RAIL
        ============================================================ */}
        <div
          ref={scrollerRef}
          className={`no-scrollbar relative -mx-5 px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 ${
            overflows ? "overflow-x-auto" : "overflow-x-hidden"
          }`}
          // Phones: swipe left = next 3, swipe right = previous 3.
          style={showArrows ? { touchAction: "pan-y" } : undefined}
          onTouchStart={
            showArrows
              ? (event) => {
                  const touch = event.touches[0];
                  touchStart.current = touch
                    ? { x: touch.clientX, y: touch.clientY }
                    : null;
                  swiped.current = false;
                }
              : undefined
          }
          onTouchEnd={
            showArrows
              ? (event) => {
                  const start = touchStart.current;
                  touchStart.current = null;
                  const touch = event.changedTouches[0];
                  if (!start || !touch) return;

                  const dx = touch.clientX - start.x;
                  const dy = touch.clientY - start.y;
                  if (
                    Math.abs(dx) >= RAIL_SWIPE_DISTANCE &&
                    Math.abs(dx) > Math.abs(dy) * 1.2
                  ) {
                    swiped.current = true;
                    goToGroup(dx < 0 ? 1 : -1);
                  }
                }
              : undefined
          }
        >
          <div
            className="relative mx-auto"
            style={{
              width: Math.max(rowWidth + edgePad * 2, trackWidth),
              paddingTop: 6,
            }}
          >
            {/* bar + end brackets */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 h-[3px] rounded-full bg-gradient-to-b from-bone-dim to-stone"
              style={{ top: barTop }}
            />
            <div
              aria-hidden="true"
              className="absolute left-0 h-[15px] w-[5px] rounded-sm border border-stone"
              style={{ top: barTop - 6 }}
            />
            <div
              aria-hidden="true"
              className="absolute right-0 h-[15px] w-[5px] rounded-sm border border-stone"
              style={{ top: barTop - 6 }}
            />

            <ul
              ref={listRef}
              className="relative flex items-start"
              style={{
                justifyContent: overflows ? "flex-start" : "center",
                paddingInline: overflows ? edgePad : 0,
                gap,
              }}
            >
              {garments.map((garment, index) => {
                // Phones: only the current group of 3 hangs on the rail.
                if (
                  isPhone &&
                  (index < groupStart || index >= groupStart + visibleCount)
                ) {
                  return null;
                }

                const isActive = index === safeActive;
                // Phones: every garment hangs straight, facing front.
                const rotation =
                  isActive || isPhone
                    ? 0
                    : index < safeActive
                      ? RAIL_IDLE_ROTATION
                      : -RAIL_IDLE_ROTATION;

                return (
                  <li
                    key={garment.key}
                    className="relative shrink-0"
                    style={{
                      width: isActive ? activeWidth : idleWidth,
                      height: hookHeight + garmentHeight,
                      zIndex: isActive
                        ? 40
                        : 20 - Math.min(19, Math.abs(index - safeActive)),
                      transition:
                        "width 650ms var(--ease-editorial)",
                    }}
                  >
                    <button
                      ref={(element) => {
                        itemRefs.current[index] = element;
                      }}
                      type="button"
                      onPointerDown={(event) => {
                        lastPointerType.current = event.pointerType;
                      }}
                      onPointerEnter={(event) => {
                        if (event.pointerType === "mouse") {
                          selectGarment(index);
                        }
                      }}
                      onFocus={() => {
                        // Keyboard only — taps/clicks already set
                        // lastPointerType in onPointerDown.
                        if (!lastPointerType.current) {
                          selectGarment(index, true);
                        }
                      }}
                      onClick={() => handleItemClick(index)}
                      aria-current={isActive ? "true" : undefined}
                      aria-label={`${garment.title}, ${formatPrice(
                        getProductSalePrice(garment.product)
                      )}. Open product view`}
                      className="absolute inset-0 block cursor-pointer focus-visible:outline-offset-[-2px]"
                    >
                      <span
                        className="pointer-events-none absolute top-0 block"
                        style={
                          isPhone
                            ? {
                                // Phones: the garment fills its own slot
                                // (the slot grows when it is selected).
                                left: 0,
                                width: "100%",
                                height: hookHeight + garmentHeight,
                                transformOrigin: "50% 0",
                                transition: "opacity 500ms ease",
                                opacity: isActive ? 1 : 0.8,
                              }
                            : {
                                left: "50%",
                                width: activeWidth,
                                height: hookHeight + garmentHeight,
                                marginLeft: -activeWidth / 2,
                                transformOrigin: "50% 0",
                                transform: `perspective(1100px) rotateY(${rotation}deg) scale(${
                                  isActive ? 1 : 0.9
                                })`,
                                transition:
                                  "transform 750ms var(--ease-editorial), opacity 500ms ease",
                                opacity: isActive ? 1 : 0.92,
                              }
                        }
                      >
                        <span
                          className={`absolute inset-0 block ${
                            isActive ? "rail-swing" : ""
                          }`}
                          style={{ transformOrigin: "50% 0" }}
                        >
                          {settings.showHangers && (
                            <RailHanger
                              className="absolute left-1/2 top-0 w-[62%] -translate-x-1/2"
                            />
                          )}

                          <span
                            className="absolute inset-x-0 block"
                            style={{
                              top: Math.round(hookHeight * 0.92),
                              height: garmentHeight,
                            }}
                          >
                            <Image
                              src={garment.front}
                              alt=""
                              fill
                              sizes={`${activeWidth}px`}
                              unoptimized={
                                !isOptimizableImage(garment.front)
                              }
                              className="object-contain object-top drop-shadow-[0_18px_22px_rgba(0,0,0,0.28)]"
                            />
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Phones: ‹ › at both ends of the rail (next / previous 3) */}
            {showArrows &&
              ([-1, 1] as const).map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => goToGroup(step)}
                  aria-label={
                    step < 0 ? "Previous 3 products" : "Next 3 products"
                  }
                  className={`absolute z-50 flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-void/70 text-bone backdrop-blur-sm transition-colors active:bg-bone active:text-void ${
                    // Sits partly in the page's side margin.
                    step < 0 ? "-left-4" : "-right-4"
                  }`}
                  style={{
                    top:
                      6 + hookHeight + Math.round(garmentHeight / 2) - 18,
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={step < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
                  </svg>
                </button>
              ))}
          </div>
        </div>

        {/* ============================================================
            ACTIVE GARMENT + CALL TO ACTION
        ============================================================ */}
        <div className="mt-8 flex flex-col items-center gap-2 text-center sm:mt-10">
          <p className="label-technical" aria-live="polite">
            {String(safeActive + 1).padStart(2, "0")} /{" "}
            {String(count).padStart(2, "0")}
          </p>

          <button
            type="button"
            onClick={() => openView(safeActive)}
            aria-label={`Open ${active.title}`}
            className="max-w-full truncate font-display text-lg uppercase tracking-tight text-bone transition-colors hover:text-mango sm:text-xl"
          >
            {active.title}
          </button>

          <RailPrice product={active.product} />

          <p className="mt-1 font-mono text-[10px] tracking-[0.16em] text-stone">
            {hint}
          </p>

          {settings.buttonText && (
            <Link
              href={settings.buttonUrl || "/shop"}
              className="mt-5 inline-flex items-center gap-2 border border-line-strong px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void"
            >
              {settings.buttonText} <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      </div>

      {openIndex !== null && garments[openIndex] && (
        <RailProductView
          key={garments[openIndex].key}
          garment={garments[openIndex]}
          index={openIndex}
          count={count}
          label={settings.label}
          showHanger={settings.showHangers}
          onClose={closeView}
          onNavigate={navigateView}
        />
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------
 * Product view (opened from the rail)
 * ------------------------------------------------------------------- */

type RailProductViewProps = {
  garment: RailGarment;
  index: number;
  count: number;
  label: string;
  showHanger: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

function RailProductView({
  garment,
  index,
  count,
  label,
  showHanger,
  onClose,
  onNavigate,
}: RailProductViewProps) {
  const { product } = garment;
  const singleSize =
    product.sizes.length === 1
      ? product.sizes[0]
      : product.sizes.length === 0
        ? ONE_SIZE
        : null;

  const [sideChoice, setSide] = useState<"front" | "back">("front");
  const [selectedColor, setSelectedColor] =
    useState<ProductColor | null>(product.colors[0] ?? null);
  const [selectedSize, setSelectedSize] = useState<string | null>(
    singleSize
  );
  const [sizeError, setSizeError] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const colorName = selectedColor?.name ?? "";

  // Photos follow the chosen colour, unless the admin uploaded
  // rail-specific hanger images for this garment.
  const colorPhotos = garment.customImages
    ? [garment.front, garment.back]
    : getColorImages(product, colorName);
  const frontImage = colorPhotos[0] || garment.front;
  const backImage = colorPhotos[1] || "";
  const hasBack = Boolean(backImage);
  const side = hasBack ? sideChoice : "front";

  const selectedStock = selectedSize
    ? getVariantStock(product, colorName, selectedSize)
    : 0;
  const selectedSoldOut = Boolean(selectedSize) && selectedStock <= 0;

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Used for the "garment flies into the bag" animation.
  const garmentBoxRef = useRef<HTMLButtonElement>(null);
  const frontFaceRef = useRef<HTMLSpanElement>(null);
  const backFaceRef = useRef<HTMLSpanElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const addToBag = useCartStore((state) => state.addToBag);
  const { user, loading: authLoading, openAuth } = useAuth();

  const soldOut = (Number(product.inventory) || 0) <= 0;
  const needsSize = product.sizes.length > 0;
  const category = product.category.replace(/-/g, " ");

  // Lock page scroll + move focus into the dialog (once per garment).
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Esc closes, ← / → browse the rail.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ignore keys typed in another dialog opened on top
      // (e.g. the sign-in form).
      const focused = document.activeElement;
      if (
        focused &&
        focused !== document.body &&
        !dialogRef.current?.contains(focused)
      ) {
        return;
      }

      if (event.key === "Escape") {
        onClose();
      } else if (count > 1 && event.key === "ArrowRight") {
        onNavigate(index + 1);
      } else if (count > 1 && event.key === "ArrowLeft") {
        onNavigate(index - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, index, onClose, onNavigate]);

  const addProductToBag = () => {
    if (!selectedSize) return;

    const state = useCartStore.getState();
    const lineId = `${product.id}-${selectedSize}-${colorName}`;
    const inBag = state.lines.find((line) => line.lineId === lineId)?.quantity ?? 0;
    if (inBag + 1 > maxAllowedForLine(state.lines, product, selectedSize, colorName, lineId)) {
      setStockError(
        inBag > 0
          ? "All available units of this size are already in your bag."
          : "This size just sold out."
      );
      return;
    }

    addToBag(product, selectedSize, colorName, 1);

    // The side bag does NOT open: the garment flies into BAG in the top
    // bar (the icon bumps), then the view closes so the flight is seen
    // over the page.
    launchGarmentToBag();
    onClose();
  };

  /**
   * Starts the flight from a flat copy of the side that is showing
   * (FRONT or BACK). A flat copy is needed because the 3D flip box
   * would show the wrong side once it fades out. On phones the garment
   * may be scrolled out of view, so the flight then starts from the
   * ADD TO BAG button instead.
   */
  const launchGarmentToBag = () => {
    const face =
      (side === "back" && backFaceRef.current) || frontFaceRef.current;
    const image = face?.querySelector("img");
    const box = garmentBoxRef.current;
    if (!image || !box) return;

    let rect = box.getBoundingClientRect();
    const garmentInView =
      rect.bottom > 80 && rect.top < window.innerHeight - 80;
    const button = addButtonRef.current;

    if (!garmentInView && button) {
      const buttonRect = button.getBoundingClientRect();
      rect = new DOMRect(
        buttonRect.left + buttonRect.width / 2 - 36,
        buttonRect.top + buttonRect.height / 2 - 45,
        72,
        90
      );
    }

    const launch = document.createElement("div");
    Object.assign(launch.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      pointerEvents: "none",
    });
    const copy = image.cloneNode(true) as HTMLImageElement;
    // Already downloaded — paint it on the very first frame.
    copy.loading = "eager";
    copy.decoding = "sync";
    launch.appendChild(copy);
    document.body.appendChild(launch);

    flyToBag(launch); // copies `launch` and animates the copy
    launch.remove();
  };

  const handleAddToBag = () => {
    if (soldOut || selectedSoldOut) return;

    if (!selectedSize) {
      setSizeError(true);
      return;
    }

    setSizeError(false);

    if (authLoading) return;

    if (!user) {
      openAuth("signin", addProductToBag);
      return;
    }

    addProductToBag();
  };

  const faceStyle = {
    backfaceVisibility: "hidden" as const,
    WebkitBackfaceVisibility: "hidden" as const,
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[10010]"
      role="dialog"
      aria-modal="true"
      aria-label={`${garment.title} — product view`}
    >
      {/* blurred page behind */}
      <div
        className="absolute inset-0 bg-void/70 backdrop-blur-xl"
        onMouseDown={onClose}
        aria-hidden="true"
      />

      <div
        data-lenis-prevent
        className="pointer-events-none relative h-full overflow-y-auto overscroll-contain"
      >
        <div className="pointer-events-auto mx-auto flex min-h-full w-full max-w-[1200px] flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-12">
          {/* ---------------- top bar ---------------- */}
          <div className="flex items-center justify-between gap-4">
            <p className="label-technical">
              {label ? `${label} · ` : ""}
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(count).padStart(2, "0")}
            </p>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 border border-line-strong px-3 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void"
            >
              CLOSE <span aria-hidden="true" className="text-sm leading-none">×</span>
            </button>
          </div>

          <div className="grid flex-1 grid-cols-1 items-center gap-8 py-4 lg:grid-cols-[1fr_1fr] lg:gap-12">
            {/* ---------------- garment ---------------- */}
            <div className="flex flex-col items-center">
              <div className="relative flex w-full items-center justify-center">
                {count > 1 && (
                  <button
                    type="button"
                    onClick={() => onNavigate(index - 1)}
                    aria-label="Previous garment"
                    className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-line-strong bg-void/40 text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void"
                  >
                    ←
                  </button>
                )}

                {/* Width follows the screen height too, so the garment and the
                    FRONT / BACK switch always fit without scrolling. */}
                <div className="relative w-[max(190px,min(64vw,340px,calc((100svh_-_240px)_*_0.7)))] lg:w-[max(220px,min(30vw,380px,calc((100svh_-_240px)_*_0.7)))]">
                  {showHanger && (
                    <RailHanger className="absolute left-1/2 top-0 z-0 w-[58%] -translate-x-1/2" />
                  )}

                  <button
                    ref={garmentBoxRef}
                    type="button"
                    onClick={() =>
                      hasBack &&
                      setSide((current) =>
                        current === "front" ? "back" : "front"
                      )
                    }
                    disabled={!hasBack}
                    aria-label={
                      hasBack
                        ? `Turn to the ${side === "front" ? "back" : "front"}`
                        : garment.title
                    }
                    className="relative z-[1] mt-[11%] block aspect-[4/5] w-full enabled:cursor-pointer disabled:cursor-default"
                    style={{ perspective: 1600 }}
                  >
                    <span
                      className="absolute inset-0 block"
                      style={{
                        transformStyle: "preserve-3d",
                        transition:
                          "transform 850ms var(--ease-editorial)",
                        transform: `rotateY(${
                          side === "back" ? 180 : 0
                        }deg)`,
                      }}
                    >
                      <span
                        ref={frontFaceRef}
                        className="absolute inset-0 block"
                        style={faceStyle}
                      >
                        <Image
                          src={frontImage}
                          alt={`${garment.title} — front`}
                          fill
                          sizes="(max-width: 1024px) 64vw, 380px"
                          unoptimized={!isOptimizableImage(frontImage)}
                          className="object-contain object-top drop-shadow-[0_28px_30px_rgba(0,0,0,0.35)]"
                        />
                      </span>

                      {hasBack && (
                        <span
                          ref={backFaceRef}
                          className="absolute inset-0 block"
                          style={{
                            ...faceStyle,
                            transform: "rotateY(180deg)",
                          }}
                        >
                          <Image
                            src={backImage}
                            alt={`${garment.title} — back`}
                            fill
                            sizes="(max-width: 1024px) 64vw, 380px"
                            unoptimized={!isOptimizableImage(backImage)}
                            className="object-contain object-top drop-shadow-[0_28px_30px_rgba(0,0,0,0.35)]"
                          />
                        </span>
                      )}
                    </span>
                  </button>
                </div>

                {count > 1 && (
                  <button
                    type="button"
                    onClick={() => onNavigate(index + 1)}
                    aria-label="Next garment"
                    className="absolute right-0 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-line-strong bg-void/40 text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void"
                  >
                    →
                  </button>
                )}
              </div>

              {hasBack && (
                <div
                  role="group"
                  aria-label="View side"
                  className="mt-4 inline-flex border border-line-strong"
                >
                  {(["front", "back"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSide(option)}
                      aria-pressed={side === option}
                      className={`px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors ${
                        side === option
                          ? "bg-bone text-void"
                          : "text-stone hover:text-bone"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ---------------- details ---------------- */}
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <p className="label-technical mb-3">{category}</p>

              <div className="flex items-start gap-3">
                <h2 className="font-display text-3xl uppercase leading-[0.95] tracking-[-0.03em] text-bone sm:text-4xl xl:text-5xl">
                  {garment.title}
                </h2>
                <WishlistButton
                  productId={product.id}
                  productName={product.name}
                  className="mt-0.5 h-10 w-10 shrink-0 border border-line-strong hover:border-bone"
                />
              </div>

              <div className="mt-4">
                <RailPrice product={product} large />
              </div>

              {product.description && (
                <p className="mt-5 max-w-md text-sm leading-relaxed text-bone-dim">
                  {product.description}
                </p>
              )}

              {/* colour */}
              {product.colors.length > 0 && (
                <div className="mt-6 w-full max-w-md border-t border-line pt-5">
                  <p className="label-technical mb-3">
                    COLOR —{" "}
                    <span className="text-bone-dim">
                      {selectedColor?.name ?? "SELECT"}
                    </span>
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                    {product.colors.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => {
                          setSelectedColor(color);
                          setStockError(null);
                        }}
                        aria-label={color.name}
                        aria-pressed={selectedColor?.name === color.name}
                        className={`h-8 w-8 rounded-full border-2 transition-transform ${
                          selectedColor?.name === color.name
                            ? "scale-110 border-mango"
                            : "border-line-strong hover:border-bone-dim"
                        }`}
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* size */}
              {needsSize && (
                <div className="mt-6 w-full max-w-md">
                  <div className="mb-3 flex items-center justify-center gap-4 lg:justify-between">
                    <p className="label-technical">
                      SIZE
                      {sizeError && (
                        <span className="text-mango"> — PLEASE SELECT A SIZE</span>
                      )}
                    </p>
                    <SizeGuideLink category={product.category} />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
                    {product.sizes.map((size) => {
                      const sizeSoldOut = getVariantStock(product, colorName, size) <= 0;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            setSelectedSize(size);
                            setSizeError(false);
                            setStockError(null);
                          }}
                          aria-pressed={selectedSize === size}
                          aria-label={sizeSoldOut ? `${size} — sold out` : size}
                          className={`min-w-12 border px-3 py-2.5 text-xs font-medium tracking-wide transition-colors ${
                            selectedSize === size
                              ? sizeSoldOut
                                ? "border-bone text-stone line-through"
                                : "border-bone bg-bone text-void"
                              : sizeSoldOut
                                ? "border-line text-stone-dark line-through hover:border-line-strong"
                                : "border-line-strong text-bone-dim hover:border-bone hover:text-bone"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                  {selectedSize && !selectedSoldOut && selectedStock <= 3 && (
                    <p className="mt-3 text-xs font-medium text-mango">Only {selectedStock} left in this size</p>
                  )}
                </div>
              )}

              <div className="mt-6 flex w-full max-w-md flex-col gap-3">
                {selectedSoldOut && selectedSize ? (
                  <NotifyMe productId={product.id} color={colorName} size={selectedSize} className="text-left" />
                ) : (
                  <button
                    ref={addButtonRef}
                    type="button"
                    onClick={handleAddToBag}
                    disabled={soldOut}
                    className="w-full bg-bone py-4 text-xs font-medium uppercase tracking-[0.18em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bone"
                  >
                    {soldOut ? "SOLD OUT" : "ADD TO BAG"}
                  </button>
                )}

                {stockError && (
                  <p role="alert" className="text-xs text-mango">{stockError}</p>
                )}

                <Link
                  href={`/product/${product.slug}`}
                  onClick={onClose}
                  className="w-full border border-line-strong py-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-bone transition-colors hover:border-bone"
                >
                  VIEW FULL DETAILS →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}