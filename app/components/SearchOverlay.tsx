"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import Link from "next/link";
import Image from "next/image";

import { useCartStore } from "@/app/store/useCartStore";
import { useProducts } from "@/app/lib/useProducts";
import { formatPrice } from "@/app/data/productTypes";

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string;
  price: number;
  images?: string[];
}

interface SearchResult {
  suggestions: string[];
  results: Product[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const POPULAR_SEARCHES = [
  "Hoodies",
  "T-Shirts",
  "Jackets",
  "Pants",
  "Accessories",
  "New Arrivals",
] as const;

const STORAGE_KEY = "mangosta-recent-searches";
const MAX_RECENT_SEARCHES = 8;
const MAX_SUGGESTIONS = 8;
const MAX_RESULTS_DISPLAY = 20;
const SEARCH_INPUT_FOCUS_DELAY = 100;
const ANIMATION_DURATION = 0.2;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize text for fuzzy matching:
 * - Lowercase
 * - Remove spaces and hyphens
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-\s]+/g, "");
}

/**
 * Safely get recent searches from localStorage
 */
function getRecentSearchesFromStorage(): string[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    // Validate each item is a string
    return parsed.filter(
      (item): item is string => typeof item === "string"
    );
  } catch {
    console.error("Failed to load recent searches");
    return [];
  }
}

/**
 * Safely save recent searches to localStorage
 */
function saveRecentSearchesToStorage(
  searches: string[]
): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(searches)
    );
    return true;
  } catch {
    console.error("Failed to save recent searches");
    return false;
  }
}

/**
 * Clear all recent searches from localStorage
 */
function clearRecentSearchesFromStorage(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    console.error("Failed to clear recent searches");
    return false;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SearchOverlay() {
  const {
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    closeSearch,
  } = useCartStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  const { products } = useProducts();

  const [recentSearches, setRecentSearches] =
    useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // =========================================================================
  // INITIALIZATION: Load recent searches on mount and when search opens
  // =========================================================================

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isSearchOpen || !mounted) {
      return;
    }

    const saved = getRecentSearchesFromStorage();
    setRecentSearches(saved);
  }, [isSearchOpen, mounted]);

  // =========================================================================
  // SAVE SEARCH TO RECENT
  // =========================================================================

  const saveSearchToRecent = useCallback(
    (query: string) => {
      const trimmedQuery = query.trim();

      if (!trimmedQuery) {
        return;
      }

      setRecentSearches((prevSearches) => {
        // Remove duplicate (case-insensitive) and prepend
        const updated = [
          trimmedQuery,
          ...prevSearches.filter(
            (search) =>
              search.toLowerCase() !==
              trimmedQuery.toLowerCase()
          ),
        ].slice(0, MAX_RECENT_SEARCHES);

        // Persist to localStorage
        saveRecentSearchesToStorage(updated);

        return updated;
      });
    },
    []
  );

  // =========================================================================
  // DELETE INDIVIDUAL RECENT SEARCH
  // =========================================================================

  const deleteRecentSearch = useCallback(
    (searchToDelete: string) => {
      setRecentSearches((prevSearches) => {
        const updated = prevSearches.filter(
          (search) =>
            search.toLowerCase() !==
            searchToDelete.toLowerCase()
        );

        saveRecentSearchesToStorage(updated);

        return updated;
      });
    },
    []
  );

  // =========================================================================
  // CLEAR ALL RECENT SEARCHES
  // =========================================================================

  const clearAllRecentSearches = useCallback(() => {
    setRecentSearches([]);
    clearRecentSearchesFromStorage();
  }, []);

  // =========================================================================
  // SEARCH / FILTER PRODUCTS
  // =========================================================================

  const { suggestions, results }: SearchResult = useMemo(() => {
    const query = searchQuery.trim();

    if (!query) {
      return {
        suggestions: [],
        results: [],
      };
    }

    const lowerQuery = query.toLowerCase();
    const normalizedQuery = normalizeText(query);

    // Filter products by name, category, or description
    const filtered = (products as Product[]).filter(
      (product) => {
        const searchText = [
          product.name,
          product.category,
          product.description,
        ]
          .filter(Boolean)
          .join(" ");

        const lowerText = searchText.toLowerCase();
        const normalizedText = normalizeText(searchText);

        return (
          lowerText.includes(lowerQuery) ||
          normalizedText.includes(normalizedQuery)
        );
      }
    );

    // Generate autocomplete suggestions from product names and categories
    const suggestionsSet = new Set<string>();

    filtered.forEach((product) => {
      const productName = product.name || "";
      const category = product.category || "";

      // Match product name
      if (
        productName
          .toLowerCase()
          .includes(lowerQuery) ||
        normalizeText(productName).includes(
          normalizedQuery
        )
      ) {
        suggestionsSet.add(productName);
      }

      // Match category
      if (
        category
          .toLowerCase()
          .includes(lowerQuery) ||
        normalizeText(category).includes(normalizedQuery)
      ) {
        suggestionsSet.add(category);
      }
    });

    // Sort suggestions by length (shorter first) and limit
    const sortedSuggestions = Array.from(
      suggestionsSet
    )
      .sort((a, b) => a.length - b.length)
      .slice(0, MAX_SUGGESTIONS);

    return {
      suggestions: sortedSuggestions,
      results: filtered,
    };
  }, [searchQuery, products]);

  // =========================================================================
  // LOCK BACKGROUND SCROLL
  // =========================================================================

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    // Store previous styles
    const previousStyles = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverscroll: body.style.overscrollBehavior,
    };

    // Lock scroll
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";

    // Cleanup on unmount or when search closes
    return () => {
      html.style.overflow = previousStyles.htmlOverflow;
      html.style.overscrollBehavior =
        previousStyles.htmlOverscroll;
      body.style.overflow = previousStyles.bodyOverflow;
      body.style.position = previousStyles.bodyPosition;
      body.style.top = previousStyles.bodyTop;
      body.style.left = previousStyles.bodyLeft;
      body.style.right = previousStyles.bodyRight;
      body.style.width = previousStyles.bodyWidth;
      body.style.overscrollBehavior =
        previousStyles.bodyOverscroll;

      window.scrollTo({
        top: scrollY,
        left: 0,
        behavior: "auto",
      });
    };
  }, [isSearchOpen]);

  // =========================================================================
  // FOCUS SEARCH INPUT
  // =========================================================================

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, SEARCH_INPUT_FOCUS_DELAY);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isSearchOpen]);

  // =========================================================================
  // ESC KEY HANDLER
  // =========================================================================

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isSearchOpen, closeSearch]);

  // =========================================================================
  // HANDLE SUGGESTION CLICK
  // =========================================================================

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setSearchQuery(suggestion);
      saveSearchToRecent(suggestion);

      // Scroll to top after setting query
      requestAnimationFrame(() => {
        resultsContainerRef.current?.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      });
    },
    [setSearchQuery, saveSearchToRecent]
  );

  // =========================================================================
  // HANDLE PRODUCT CLICK
  // =========================================================================

  const handleProductClick = useCallback(() => {
    saveSearchToRecent(searchQuery);
    closeSearch();
  }, [searchQuery, saveSearchToRecent, closeSearch]);

  // =========================================================================
  // EARLY EXIT: Not open
  // =========================================================================

  if (!isSearchOpen) {
    return null;
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <>
          {/* ==================================================
              BACKDROP
              ================================================== */}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION }}
            onClick={closeSearch}
            className="
              fixed
              inset-0
              z-[9990]
              bg-black/40
              backdrop-blur-sm
            "
            aria-hidden="true"
          />

          {/* ==================================================
              SEARCH OVERLAY
              ================================================== */}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION_DURATION }}
            className="
              fixed
              inset-0
              z-[9995]
              flex
              h-[100dvh]
              w-full
              flex-col
              overflow-hidden
              bg-void
            "
            style={{ isolation: "isolate" }}
            role="dialog"
            aria-modal="true"
            aria-label="Search products"
          >
            {/* =================================================
                SEARCH HEADER
                ================================================= */}

            <div
              className="
                relative
                z-20
                w-full
                shrink-0
                border-b
                border-line
                bg-void
              "
            >
              <div
                className="
                  mx-auto
                  flex
                  h-[66px]
                  max-w-[1600px]
                  items-center
                  gap-4
                  px-5
                  sm:px-8
                  lg:px-10
                "
              >

                {/* INPUT */}

                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(
                      event.currentTarget.value
                    )
                  }
                  placeholder="Search hoodies, tees, jackets..."
                  className="
                    min-w-0
                    flex-1
                    bg-transparent
                    font-body
                    text-sm
                    text-bone
                    outline-none
                    placeholder:text-stone
                  "
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-label="Search products"
                />

                {/* CLEAR INPUT */}

                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="
                      shrink-0
                      text-xs
                      text-stone-dark
                      transition-colors
                      hover:text-stone
                    "
                    aria-label="Clear search input"
                  >
                    ✕
                  </button>
                )}

                {/* CLOSE */}

                <button
                  type="button"
                  onClick={closeSearch}
                  className="
                    shrink-0
                    text-xs
                    font-medium
                    tracking-[0.1em]
                    text-bone-dim
                    transition-colors
                    hover:text-bone
                  "
                  aria-label="Close search (Escape)"
                >
                  ESC
                </button>
              </div>
            </div>

            {/* =================================================
                RESULTS CONTAINER
                ================================================= */}

            <div
              ref={resultsContainerRef}
              data-search-scroll
              data-lenis-prevent
              className="
                relative
                min-h-0
                flex-1
                overflow-y-auto
                overscroll-contain
              "
              style={{
                height: 0,
                minHeight: 0,
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
                touchAction: "pan-y",
                scrollbarGutter: "stable",
              }}
            >
              {/* ==============================================
                  CONTENT
                  ============================================= */}

              <div
                className="
                  mx-auto
                  min-h-full
                  max-w-[1600px]
                  px-5
                  py-6
                  pb-24
                  sm:px-8
                  lg:px-10
                "
              >
                {/* QUERY ENTERED */}

                {searchQuery.trim().length > 0 ? (
                  <>
                    {/* =========================================
                        SUGGESTIONS
                        ========================================= */}

                    {suggestions.length > 0 && (
                      <div className="mb-8">
                        <p className="label-technical mb-3 text-bone/70">
                          SUGGESTIONS
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {suggestions.map(
                            (suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() =>
                                  handleSuggestionClick(
                                    suggestion
                                  )
                                }
                                className="
                                  border
                                  border-line-strong
                                  px-4
                                  py-2
                                  text-xs
                                  text-bone
                                  transition-colors
                                  hover:border-mango
                                  hover:text-mango
                                "
                              >
                                {suggestion}
                              </button>
                            )
                          )}
                        </div>

                        <div className="my-6 h-px bg-line-strong" />
                      </div>
                    )}

                    {/* =========================================
                        NO RESULTS
                        ========================================= */}

                    {results.length === 0 ? (
                      <div className="py-12 text-center">
                        <p className="mb-4 text-sm text-stone">
                          No products found for &ldquo;
                          {searchQuery}&rdquo;
                        </p>

                        <p className="mb-6 text-xs text-stone-dark">
                          Try different keywords or check
                          the popular searches below
                        </p>

                        <div className="flex flex-wrap justify-center gap-2">
                          {POPULAR_SEARCHES.slice(
                            0,
                            3
                          ).map((search) => (
                            <button
                              key={search}
                              type="button"
                              onClick={() =>
                                handleSuggestionClick(
                                  search
                                )
                              }
                              className="
                                border
                                border-line
                                px-3
                                py-1.5
                                text-xs
                                text-bone-dim
                                transition-colors
                                hover:text-bone
                              "
                            >
                              {search}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* =========================================
                            RESULT COUNT
                            ========================================= */}

                        <p className="label-technical mb-4 text-bone/70">
                          {results.length} RESULT
                          {results.length !== 1 ? "S" : ""}{" "}
                          FOUND
                        </p>

                        {/* =========================================
                            PRODUCT GRID
                            ========================================= */}

                        <motion.div
                          initial="hidden"
                          animate="visible"
                          variants={{
                            hidden: { opacity: 0 },
                            visible: {
                              opacity: 1,
                              transition: {
                                staggerChildren: 0.02,
                              },
                            },
                          }}
                          className="
                            grid
                            grid-cols-2
                            gap-x-3
                            gap-y-6
                            sm:grid-cols-3
                            sm:gap-x-4
                            sm:gap-y-8
                            lg:grid-cols-4
                            xl:grid-cols-5
                          "
                        >
                          {results
                            .slice(0, MAX_RESULTS_DISPLAY)
                            .map((product) => (
                              <motion.div
                                key={product.id}
                                variants={{
                                  hidden: {
                                    opacity: 0,
                                    y: 5,
                                  },
                                  visible: {
                                    opacity: 1,
                                    y: 0,
                                  },
                                }}
                              >
                                <Link
                                  href={`/product/${product.slug}`}
                                  className="group block"
                                  onClick={
                                    handleProductClick
                                  }
                                >
                                  {/* PRODUCT IMAGE */}

                                  <div
                                    className="
                                      relative
                                      mb-2
                                      aspect-[3/4]
                                      overflow-hidden
                                      rounded
                                      bg-charcoal
                                    "
                                  >
                                    {product
                                      .images?.[0] ? (
                                      <Image
                                        src={
                                          product
                                            .images[0]
                                        }
                                        alt={
                                          product.name
                                        }
                                        fill
                                        sizes="
                                          (max-width: 640px) 50vw,
                                          (max-width: 1024px) 33vw,
                                          20vw
                                        "
                                        className="
                                          object-contain
                                          p-2
                                          transition-transform
                                          duration-300
                                          group-hover:scale-105
                                        "
                                      />
                                    ) : (
                                      <div
                                        className="
                                          flex
                                          h-full
                                          items-center
                                          justify-center
                                          text-xs
                                          text-stone
                                        "
                                      >
                                        No image
                                      </div>
                                    )}
                                  </div>

                                  {/* NAME */}

                                  <h3
                                    className="
                                      line-clamp-2
                                      text-[11px]
                                      font-medium
                                      text-bone
                                      transition-colors
                                      group-hover:text-bone/80
                                    "
                                  >
                                    {product.name}
                                  </h3>

                                  {/* CATEGORY */}

                                  <p className="mt-0.5 text-[10px] text-stone">
                                    {
                                      product.category
                                    }
                                  </p>

                                  {/* PRICE */}

                                  <p className="mt-1 font-mono text-[11px] text-bone-dim">
                                    {formatPrice(
                                      product.price
                                    )}
                                  </p>
                                </Link>
                              </motion.div>
                            ))}
                        </motion.div>

                        {/* =========================================
                            VIEW ALL RESULTS
                            ========================================= */}

                        {results.length >
                          MAX_RESULTS_DISPLAY && (
                          <div className="mt-8 text-center">
                            <Link
                              href={`/shop?search=${encodeURIComponent(
                                searchQuery
                              )}`}
                              onClick={
                                handleProductClick
                              }
                              className="
                                text-xs
                                text-bone
                                underline
                                transition-colors
                                hover:text-bone/80
                              "
                            >
                              View all {results.length}{" "}
                              results →
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  /* =================================================
                     NO QUERY
                     ================================================= */

                  <>
                    {/* =============================================
                        RECENT SEARCHES
                        ============================================= */}

                    {recentSearches.length > 0 && (
                      <div className="mb-8">
                        {/* HEADER */}

                        <div className="mb-3 flex items-center justify-between">
                          <p className="label-technical text-bone/70">
                            RECENT SEARCHES
                          </p>

                          {/* CLEAR ALL */}

                          <button
                            type="button"
                            onClick={
                              clearAllRecentSearches
                            }
                            className="
                              text-[10px]
                              font-medium
                              tracking-[0.08em]
                              text-stone
                              transition-colors
                              hover:text-red-400
                            "
                            aria-label="Clear all recent searches"
                          >
                            CLEAR ALL
                          </button>
                        </div>

                        {/* RECENT SEARCH ITEMS */}

                        <div className="flex flex-wrap gap-2">
                          {recentSearches.map(
                            (search) => (
                              <div
                                key={search}
                                className="
                                  inline-flex
                                  items-center
                                  border
                                  border-line-strong
                                  text-xs
                                  text-bone-dim
                                  transition-colors
                                  hover:border-bone
                                  hover:text-bone
                                "
                              >
                                {/* SEARCH BUTTON */}

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSuggestionClick(
                                      search
                                    )
                                  }
                                  className="
                                    px-3
                                    py-1.5
                                    text-left
                                    transition-colors
                                    hover:text-bone
                                  "
                                >
                                  {search}
                                </button>

                                {/* DELETE BUTTON */}

                                <button
                                  type="button"
                                  onClick={() => {
                                    deleteRecentSearch(
                                      search
                                    );
                                  }}
                                  className="
                                    flex
                                    h-full
                                    items-center
                                    justify-center
                                    border-l
                                    border-line-strong
                                    px-2
                                    text-[10px]
                                    text-stone
                                    transition-colors
                                    hover:bg-red-500/10
                                    hover:text-red-400
                                  "
                                  aria-label={`Delete ${search}`}
                                  title={`Delete ${search}`}
                                >
                                  ✕
                                </button>
                              </div>
                            )
                          )}
                        </div>

                        <div className="my-6 h-px bg-line-strong" />
                      </div>
                    )}

                    {/* =============================================
                        POPULAR SEARCHES
                        ============================================= */}

                    <div>
                      <p className="label-technical mb-3 text-bone/70">
                        POPULAR SEARCHES
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {POPULAR_SEARCHES.map(
                          (search) => (
                            <button
                              key={search}
                              type="button"
                              onClick={() =>
                                handleSuggestionClick(
                                  search
                                )
                              }
                              className="
                                border
                                border-line-strong
                                px-4
                                py-2
                                text-xs
                                text-bone
                                transition-colors
                                hover:border-mango
                                hover:text-mango
                              "
                            >
                              {search}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}