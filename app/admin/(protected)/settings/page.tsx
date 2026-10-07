"use client";

import { useEffect, useRef, useState } from "react";

type MangostaCodeStyle =
  | "display"
  | "body"
  | "technical"
  | "mono";

type HeroTransition = "fade" | "slide";

type HeroImagePosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "left top"
  | "right top"
  | "left bottom"
  | "right bottom";

const HERO_IMAGE_POSITION_OPTIONS: {
  value: HeroImagePosition;
  label: string;
}[] = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "left top", label: "Top left" },
  { value: "right top", label: "Top right" },
  { value: "left bottom", label: "Bottom left" },
  { value: "right bottom", label: "Bottom right" },
];

interface HeroSlide {
  id: string;
  enabled: boolean;
  order: number;
  image: string;
  mobileImage?: string;

  imagePosition?: HeroImagePosition;
  topLabel: string;
  secondaryLabel: string;
  headlineLine1: string;
  headlineLine2: string;
  headlineLine3: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  issueLabel: string;
  issueSubtitle: string;
  productId: string;
  productTitle: string;
  productImage: string;
  productLink: string;
  titleStyle: MangostaCodeStyle;
}

interface HeroSettings {
  enabled: boolean;
  autoplay: boolean;
  autoplayDuration: number;
  transitionDuration: number;
  transition: HeroTransition;
  slides: HeroSlide[];
}

interface MangostaCodeBox {
  enabled: boolean;
  heading: string;
  description: string;
  headingStyle: MangostaCodeStyle;
  descriptionStyle: MangostaCodeStyle;
  productId: string;
}

interface DropProduct {
  enabled: boolean;
  productId: string;
  title: string;
  link: string;
  titleStyle: MangostaCodeStyle;
  order: number;
}

interface DropSettings {
  enabled: boolean;
  label: string;
  title: string;
  products: DropProduct[];
}

interface MangostaStudio {
  enabled: boolean;
  productId: string;
  title: string;
  image: string;
  tag: string;
  titleStyle: MangostaCodeStyle;
  link: string;
  order: number;
}

interface RailItem {
  enabled: boolean;
  productId: string;
  title: string;
  frontImage: string;
  backImage: string;
  order: number;
}

interface RailSettings {
  enabled: boolean;
  label: string;
  secondaryLabel: string;
  buttonText: string;
  buttonUrl: string;
  showHangers: boolean;
  showOnMobile: boolean;
  items: RailItem[];
}

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  images: string[];
}

interface SiteSettings {
  hero: HeroSettings;

  // Kept for compatibility with existing settings data.
  heroHeadline: string;
  heroSubline: string;

  announcementBar: string;
  announcementEnabled: boolean;

  collectionEnabled: boolean;
  collectionLabel: string;
  collectionTitle: string;
  collectionSubtitle: string;
  collectionDescription: string;
  collectionImage: string;
  collectionOverlayEnabled: boolean;
  collectionOverlayOpacity: number;

  drop: DropSettings;

  rail: RailSettings;

  mangostaStudiosEnabled: boolean;
  mangostaStudiosLabel: string;
  mangostaStudios: MangostaStudio[];

  mangostaCode: MangostaCodeBox[];
}

const DEFAULT_HERO_SLIDE: HeroSlide = {
  id: "hero-slide-1",
  enabled: true,
  order: 0,
  image: "",
  mobileImage: "",

  imagePosition: "center",
  topLabel: "MANGOSTA / 04",
  secondaryLabel: "MANGOSTA STUDIOS",
  headlineLine1: "WEAR",
  headlineLine2: "YOUR",
  headlineLine3: "ATTITUDE.",
  description:
    "A new generation fashion label built for people who create their own rules.",
  buttonText: "SHOP THE DROP",
  buttonUrl: "/shop",
  issueLabel: "ISSUE 04",
  issueSubtitle: "MANGOSTA STUDIOS",
  productId: "",
  productTitle: "",
  productImage: "",
  productLink: "",
  titleStyle: "display",
};

const DEFAULT_HERO: HeroSettings = {
  enabled: true,
  autoplay: true,
  autoplayDuration: 6000,
  transitionDuration: 800,
  transition: "fade",
  slides: [DEFAULT_HERO_SLIDE],
};

const DEFAULT_DROP: DropSettings = {
  enabled: true,
  label: "03 — THE DROP",
  title: "THE DROP",
  products: [],
};

/** Maximum garments on the rail (same limit as the server). */
const RAIL_MAX_ITEMS = 20;

const DEFAULT_RAIL: RailSettings = {
  enabled: true,
  label: "02 — ON THE RAIL",
  secondaryLabel: "MANGOSTA / FW26",
  buttonText: "EXPLORE MANGOSTA",
  buttonUrl: "/shop",
  showHangers: true,
  showOnMobile: true,
  items: [],
};

const DEFAULT_SETTINGS: SiteSettings = {
  hero: DEFAULT_HERO,

  heroHeadline: "WEAR\nYOUR\nATTITUDE.",

  heroSubline:
    "A new generation fashion label built for people who create their own rules.",

  announcementBar: "",
  announcementEnabled: false,

  collectionEnabled: true,
  collectionLabel: "05 — NEW COLLECTION",
  collectionTitle: "MANGOSTA",
  collectionSubtitle: "FW / 26",
  collectionDescription:
    "Twelve pieces. One attitude. The Fall/Winter 2026 collection is built for movement in any city.",

  collectionImage: "",

 collectionOverlayEnabled: true,
collectionOverlayOpacity: 45,

  drop: DEFAULT_DROP,

  rail: DEFAULT_RAIL,

mangostaStudiosEnabled: true,

mangostaStudiosLabel:
  "04 — MANGOSTA STUDIOS",

mangostaStudios: [],

mangostaCode: [
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
  ],
};

const STYLE_OPTIONS: {
  value: MangostaCodeStyle;
  label: string;
}[] = [
  {
    value: "display",
    label: "Display",
  },
  {
    value: "body",
    label: "Body",
  },
  {
    value: "technical",
    label: "Technical",
  },
  {
    value: "mono",
    label: "Mono",
  },
];

function normalizeHeroSettings(
  value: unknown
): HeroSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_HERO;
  }

  const source = value as Partial<HeroSettings>;
  const rawSlides = Array.isArray(source.slides)
    ? source.slides
    : [];

  const slides: HeroSlide[] = rawSlides
    .map((raw, index) => {
      const slide = (
        raw && typeof raw === "object"
          ? raw
          : {}
      ) as Partial<HeroSlide>;

      return {
        ...DEFAULT_HERO_SLIDE,
        ...slide,
        id:
          typeof slide.id === "string" &&
          slide.id
            ? slide.id
            : `hero-slide-${Date.now()}-${index}`,
        enabled:
          typeof slide.enabled === "boolean"
            ? slide.enabled
            : true,
        order:
          typeof slide.order === "number"
            ? slide.order
            : index,
        titleStyle:
          slide.titleStyle === "display" ||
          slide.titleStyle === "body" ||
          slide.titleStyle === "technical" ||
          slide.titleStyle === "mono"
            ? slide.titleStyle
            : "display",
      };
    })
    .sort((a, b) => a.order - b.order)
    .slice(0, 10)
    .map((slide, index) => ({
      ...slide,
      order: index,
    }));

  return {
    enabled:
      typeof source.enabled === "boolean"
        ? source.enabled
        : DEFAULT_HERO.enabled,
    autoplay:
      typeof source.autoplay === "boolean"
        ? source.autoplay
        : DEFAULT_HERO.autoplay,
    autoplayDuration:
      typeof source.autoplayDuration === "number"
        ? Math.max(
            2000,
            Math.min(30000, source.autoplayDuration)
          )
        : DEFAULT_HERO.autoplayDuration,
    transitionDuration:
      typeof source.transitionDuration === "number"
        ? Math.max(
            200,
            Math.min(3000, source.transitionDuration)
          )
        : DEFAULT_HERO.transitionDuration,
    transition:
      source.transition === "slide" ||
      source.transition === "fade"
        ? source.transition
        : DEFAULT_HERO.transition,
    slides:
      slides.length > 0
        ? slides
        : [DEFAULT_HERO_SLIDE],
  };
}

function normalizeRailSettings(
  value: unknown
): RailSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_RAIL;
  }

  const source = value as Partial<RailSettings>;
  const text = (input: unknown, fallback = "") =>
    typeof input === "string" ? input : fallback;

  const items = (Array.isArray(source.items) ? source.items : [])
    .slice(0, RAIL_MAX_ITEMS)
    .map((raw, index) => {
      const item = (
        raw && typeof raw === "object" ? raw : {}
      ) as Partial<RailItem>;

      return {
        enabled:
          typeof item.enabled === "boolean" ? item.enabled : true,
        productId: text(item.productId),
        title: text(item.title),
        frontImage: text(item.frontImage),
        backImage: text(item.backImage),
        order:
          typeof item.order === "number" ? item.order : index,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));

  return {
    enabled:
      typeof source.enabled === "boolean"
        ? source.enabled
        : DEFAULT_RAIL.enabled,
    label: text(source.label, DEFAULT_RAIL.label),
    secondaryLabel: text(
      source.secondaryLabel,
      DEFAULT_RAIL.secondaryLabel
    ),
    buttonText: text(source.buttonText, DEFAULT_RAIL.buttonText),
    buttonUrl: text(source.buttonUrl, DEFAULT_RAIL.buttonUrl),
    showHangers:
      typeof source.showHangers === "boolean"
        ? source.showHangers
        : DEFAULT_RAIL.showHangers,
    showOnMobile:
      typeof source.showOnMobile === "boolean"
        ? source.showOnMobile
        : DEFAULT_RAIL.showOnMobile,
    items,
  };
}

function normalizeLoadedSettings(
  data: Partial<SiteSettings>
): SiteSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    hero: normalizeHeroSettings(data.hero),
    drop:
      data.drop && typeof data.drop === "object"
        ? (() => {
            const source = data.drop as Partial<DropSettings>;
            const rawProducts = Array.isArray(source.products)
              ? source.products
              : [];

            const products = rawProducts
              .map((item: Partial<DropProduct>, index: number) => ({
                enabled: typeof item.enabled === "boolean" ? item.enabled : true,
                productId: typeof item.productId === "string" ? item.productId : "",
                title: typeof item.title === "string" ? item.title : "",
                link: typeof item.link === "string" ? item.link : "",
                titleStyle:
                  item.titleStyle === "display" ||
                  item.titleStyle === "body" ||
                  item.titleStyle === "technical" ||
                  item.titleStyle === "mono"
                    ? item.titleStyle
                    : "display",
                order: typeof item.order === "number" ? item.order : index,
              }))
              .sort((a, b) => a.order - b.order)
              .map((item, index) => ({ ...item, order: index }));

            return {
              enabled: typeof source.enabled === "boolean" ? source.enabled : true,
              label: typeof source.label === "string" ? source.label : "03 — THE DROP",
              title: typeof source.title === "string" ? source.title : "THE DROP",
              products,
            };
          })()
        : DEFAULT_DROP,
    rail: normalizeRailSettings(data.rail),
    mangostaStudios:
      Array.isArray(data.mangostaStudios)
        ? data.mangostaStudios
            .map(
              (
                studio: Partial<MangostaStudio>,
                index: number
              ) => ({
                enabled:
                  typeof studio.enabled === "boolean"
                    ? studio.enabled
                    : true,
                productId:
                  typeof studio.productId === "string"
                    ? studio.productId
                    : "",
                title:
                  typeof studio.title === "string"
                    ? studio.title
                    : "",
                image:
                  typeof studio.image === "string"
                    ? studio.image
                    : "",
                tag:
                  typeof studio.tag === "string"
                    ? studio.tag
                    : "",
                titleStyle:
                  studio.titleStyle === "display" ||
                  studio.titleStyle === "body" ||
                  studio.titleStyle === "technical" ||
                  studio.titleStyle === "mono"
                    ? studio.titleStyle
                    : "display",
                link:
                  typeof studio.link === "string"
                    ? studio.link
                    : "",
                order:
                  typeof studio.order === "number"
                    ? studio.order
                    : index,
              })
            )
            .sort((a, b) => a.order - b.order)
            .map((studio, index) => ({
              ...studio,
              order: index,
            }))
        : DEFAULT_SETTINGS.mangostaStudios,
    mangostaCode:
      Array.isArray(data.mangostaCode) &&
      data.mangostaCode.length > 0
        ? data.mangostaCode.map(
            (
              box: Partial<MangostaCodeBox>,
              index: number
            ) => ({
              ...DEFAULT_SETTINGS.mangostaCode[
                index
              ],
              ...box,
            })
          )
        : DEFAULT_SETTINGS.mangostaCode,
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] =
    useState<SiteSettings>(DEFAULT_SETTINGS);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [products, setProducts] =
    useState<AdminProduct[]>([]);

  const [productsLoading, setProductsLoading] =
    useState(true);

  const [heroUploadIndex, setHeroUploadIndex] =
    useState<number | null>(null);

  const imageInputRef =
    useRef<HTMLInputElement>(null);

  const [selectedSection, setSelectedSection] = useState<
  "hero" | "rail" | "announcement" | "drop"
>("hero");

  // "<index>-frontImage" / "<index>-backImage" while a rail image uploads
  const [railUploadKey, setRailUploadKey] =
    useState<string | null>(null);

  // ============================================================
  // SECTION CONFIGURATION
  // ============================================================

 const SECTION_CONFIG = [
  {
    id: "hero" as const,
    label: "Hero Carousel",
    description: "Manage slides, images, transitions",
  },
  {
    id: "rail" as const,
    label: "On the Rail",
    description: "Clothes rail shown right after the hero — garments, order, front/back hanger images",
  },
  {
    id: "announcement" as const,
    label: "Announcement Bar",
    description: "Header announcement message",
  },
  {
    id: "drop" as const,
    label: "The Drop",
    description: "Featured drop section with products",
  },
];

  // ============================================================
  // LOAD SETTINGS
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/settings")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load settings.");
        }

        return res.json();
      })
      .then((data) => {
        if (cancelled) return;

        setSettings(
          normalizeLoadedSettings(data)
        );
      })
      .catch((err) => {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load settings."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // LOAD PRODUCTS
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/products")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            "Failed to load products."
          );
        }

        return res.json();
      })
      .then((data) => {
        if (cancelled) return;

        const productList: AdminProduct[] =
          Array.isArray(data)
            ? data
            : Array.isArray(data.products)
              ? data.products
              : [];

        setProducts(productList);
      })
      .catch((err) => {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load products."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setProductsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ============================================================
  // HERO CAROUSEL
  // ============================================================

  const updateHero = (
    updates: Partial<HeroSettings>
  ) => {
    setSettings((current) => ({
      ...current,
      hero: {
        ...current.hero,
        ...updates,
      },
    }));

    setSaved(false);
    setError(null);
  };

  const updateHeroSlide = (
    index: number,
    updates: Partial<HeroSlide>
  ) => {
    setSettings((current) => {
      const slides = [...current.hero.slides];

      slides[index] = {
        ...slides[index],
        ...updates,
      };

      return {
        ...current,
        hero: {
          ...current.hero,
          slides,
        },
      };
    });

    setSaved(false);
    setError(null);
  };

  const addHeroSlide = () => {
    setSettings((current) => {
      if (current.hero.slides.length >= 10) {
        return current;
      }

      const index = current.hero.slides.length;

      const newSlide: HeroSlide = {
        ...DEFAULT_HERO_SLIDE,
        id: `hero-slide-${Date.now()}-${index}`,
        order: index,
        topLabel: `MANGOSTA / ${String(
          index + 1
        ).padStart(2, "0")}`,
        headlineLine1: "NEW",
        headlineLine2: "HERO",
        headlineLine3: "SLIDE.",
        productId: "",
        productTitle: "",
        productImage: "",
        productLink: "",
      };

      return {
        ...current,
        hero: {
          ...current.hero,
          slides: [
            ...current.hero.slides,
            newSlide,
          ],
        },
      };
    });

    setSaved(false);
    setError(null);
  };

  const removeHeroSlide = (index: number) => {
    setSettings((current) => ({
      ...current,
      hero: {
        ...current.hero,
        slides: current.hero.slides
          .filter(
            (_, slideIndex) =>
              slideIndex !== index
          )
          .map((slide, newIndex) => ({
            ...slide,
            order: newIndex,
          })),
      },
    }));

    setSaved(false);
    setError(null);
  };

  const moveHeroSlide = (
    index: number,
    direction: "up" | "down"
  ) => {
    setSettings((current) => {
      const slides = [...current.hero.slides];

      const targetIndex =
        direction === "up"
          ? index - 1
          : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= slides.length
      ) {
        return current;
      }

      [
        slides[index],
        slides[targetIndex],
      ] = [
        slides[targetIndex],
        slides[index],
      ];

      return {
        ...current,
        hero: {
          ...current.hero,
          slides: slides.map(
            (slide, slideIndex) => ({
              ...slide,
              order: slideIndex,
            })
          ),
        },
      };
    });

    setSaved(false);
    setError(null);
  };

  const handleHeroProductChange = (
    index: number,
    productId: string
  ) => {
    const selectedProduct =
      products.find(
        (product) =>
          product.id === productId
      );

    updateHeroSlide(index, {
      productId,
      ...(selectedProduct
        ? {
            productTitle:
              selectedProduct.name,
            productImage:
              selectedProduct.images?.[0] ||
              "",
            productLink: `/product/${selectedProduct.slug}`,
          }
        : {
            productTitle: "",
            productImage: "",
            productLink: "",
          }),
    });
  };

  const handleHeroImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    const index = Number(
      e.currentTarget.dataset.heroIndex
    );

    const imageField: "image" = "image";

    e.target.value = "";

    if (
      !file ||
      !Number.isInteger(index) ||
      index < 0
    ) {
      return;
    }

    setHeroUploadIndex(null);

    setError(null);
    setSaved(false);
    setIsUploading(true);

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error(
          "Please select a valid image file."
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error(
          "Image must be smaller than 10 MB."
        );
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "/api/admin/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to upload Hero image."
        );
      }

      if (!data?.url) {
        throw new Error(
          "Image uploaded but no image URL was returned."
        );
      }

      updateHeroSlide(index, {
        [imageField]: data.url,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload Hero image."
      );
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================================
// HERO MOBILE IMAGE UPLOAD
// ============================================================

const handleHeroMobileImageUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];
  const index = Number(e.currentTarget.dataset.heroIndex);

  // Allow selecting the same file again
  e.target.value = "";

  if (!file || !Number.isInteger(index) || index < 0) {
    return;
  }

  setHeroUploadIndex(index);
  setError(null);
  setSaved(false);
  setIsUploading(true);

  try {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please select a valid image file.");
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Image must be smaller than 10 MB.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.url) {
      throw new Error(
        data?.error || "Failed to upload mobile Hero image."
      );
    }

    updateHeroSlide(index, {
      mobileImage: data.url,
    });
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to upload mobile Hero image."
    );
  } finally {
    setIsUploading(false);
    setHeroUploadIndex(null);
  }
};

  const updateSetting = <
    K extends keyof SiteSettings
  >(
    key: K,
    value: SiteSettings[K]
  ) => {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));

    setSaved(false);
    setError(null);
  };

  // ============================================================
  // DROP
  // ============================================================

  const updateDrop = (updates: Partial<DropSettings>) => {
    setSettings((current) => ({
      ...current,
      drop: {
        ...current.drop,
        ...updates,
      },
    }));
    setSaved(false);
    setError(null);
  };

  const updateDropProduct = (
    index: number,
    updates: Partial<DropProduct>
  ) => {
    setSettings((current) => {
      const productsList = [...current.drop.products];
      productsList[index] = {
        ...productsList[index],
        ...updates,
      };
      return {
        ...current,
        drop: {
          ...current.drop,
          products: productsList,
        },
      };
    });
    setSaved(false);
    setError(null);
  };

  const addDropProduct = () => {
    setSettings((current) => ({
      ...current,
      drop: {
        ...current.drop,
        products: [
          ...current.drop.products,
          {
            enabled: true,
            productId: "",
            title: "",
            link: "",
            titleStyle: "display",
            order: current.drop.products.length,
          },
        ],
      },
    }));
    setSaved(false);
    setError(null);
  };

  const removeDropProduct = (index: number) => {
    setSettings((current) => ({
      ...current,
      drop: {
        ...current.drop,
        products: current.drop.products
          .filter((_, productIndex) => productIndex !== index)
          .map((product, newIndex) => ({
            ...product,
            order: newIndex,
          })),
      },
    }));
    setSaved(false);
    setError(null);
  };

  const moveDropProduct = (
    index: number,
    direction: "up" | "down"
  ) => {
    setSettings((current) => {
      const productsList = [...current.drop.products];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= productsList.length) {
        return current;
      }
      [productsList[index], productsList[targetIndex]] = [
        productsList[targetIndex],
        productsList[index],
      ];
      return {
        ...current,
        drop: {
          ...current.drop,
          products: productsList.map((product, productIndex) => ({
            ...product,
            order: productIndex,
          })),
        },
      };
    });
    setSaved(false);
    setError(null);
  };

  const handleDropProductChange = (
    index: number,
    productId: string
  ) => {
    const selectedProduct = products.find(
      (product) => product.id === productId
    );

    updateDropProduct(index, {
      productId,
      ...(selectedProduct
        ? {
            title: selectedProduct.name,
            link: `/product/${selectedProduct.slug}`,
          }
        : {
            title: "",
            link: "",
          }),
    });
  };

  // ============================================================
  // ON THE RAIL
  // ============================================================

  const updateRail = (updates: Partial<RailSettings>) => {
    setSettings((current) => ({
      ...current,
      rail: {
        ...current.rail,
        ...updates,
      },
    }));
    setSaved(false);
    setError(null);
  };

  const updateRailItem = (
    index: number,
    updates: Partial<RailItem>
  ) => {
    setSettings((current) => {
      const items = [...current.rail.items];
      if (!items[index]) return current;
      items[index] = {
        ...items[index],
        ...updates,
      };
      return {
        ...current,
        rail: {
          ...current.rail,
          items,
        },
      };
    });
    setSaved(false);
    setError(null);
  };

  const addRailItem = () => {
    setSettings((current) => {
      if (current.rail.items.length >= RAIL_MAX_ITEMS) {
        return current;
      }
      return {
        ...current,
        rail: {
          ...current.rail,
          items: [
            ...current.rail.items,
            {
              enabled: true,
              productId: "",
              title: "",
              frontImage: "",
              backImage: "",
              order: current.rail.items.length,
            },
          ],
        },
      };
    });
    setSaved(false);
    setError(null);
  };

  const removeRailItem = (index: number) => {
    setSettings((current) => ({
      ...current,
      rail: {
        ...current.rail,
        items: current.rail.items
          .filter((_, itemIndex) => itemIndex !== index)
          .map((item, newIndex) => ({
            ...item,
            order: newIndex,
          })),
      },
    }));
    setSaved(false);
    setError(null);
  };

  const moveRailItem = (
    index: number,
    direction: "up" | "down"
  ) => {
    setSettings((current) => {
      const items = [...current.rail.items];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) {
        return current;
      }
      [items[index], items[targetIndex]] = [
        items[targetIndex],
        items[index],
      ];
      return {
        ...current,
        rail: {
          ...current.rail,
          items: items.map((item, itemIndex) => ({
            ...item,
            order: itemIndex,
          })),
        },
      };
    });
    setSaved(false);
    setError(null);
  };

  const handleRailImageUpload = async (
    index: number,
    field: "frontImage" | "backImage",
    file: File | undefined
  ) => {
    if (!file) return;

    setRailUploadKey(`${index}-${field}`);
    setError(null);
    setSaved(false);
    setIsUploading(true);

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please select a valid image file.");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Image must be smaller than 10 MB.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.url) {
        throw new Error(
          data?.error || "Failed to upload rail image."
        );
      }

      updateRailItem(index, { [field]: data.url });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload rail image."
      );
    } finally {
      setIsUploading(false);
      setRailUploadKey(null);
    }
  };

    // ============================================================
  // SAVE SETTINGS
  // ============================================================

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setIsSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(
        "/api/admin/settings",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        }
      );

      const data = await res
        .json()
        .catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Failed to save settings."
        );
      }

      setSettings(
        normalizeLoadedSettings(data)
      );

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <p className="label-technical mb-2">
          CONFIGURATION
        </p>

        <h1 className="font-display text-2xl sm:text-3xl tracking-tight text-bone">
          Settings
        </h1>

        <p className="mt-8 text-sm text-stone">
          Loading…
        </p>
      </div>
    );
  }

  // ============================================================
  // ON THE RAIL — each product can hang on the rail only once
  // ============================================================

  const railUsedProductIds = new Set(
    settings.rail.items
      .map((item) => item.productId)
      .filter(Boolean)
  );

  // Rows added but not yet given a product.
  const railEmptyRows = settings.rail.items.filter(
    (item) => !item.productId
  ).length;

  const railNoProductsLeft =
    !productsLoading &&
    products.filter(
      (product) => !railUsedProductIds.has(product.id)
    ).length <= railEmptyRows;

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div>
      <p className="label-technical mb-2">
        CONFIGURATION
      </p>

      <h1 className="mb-10 font-display text-2xl sm:text-3xl tracking-tight text-bone">
        Settings
      </h1>

      {/* SECTION DROPDOWN NAVIGATION */}
      <div className="mb-8 flex flex-col gap-3">
        <label htmlFor="section-select" className="text-xs text-stone">
          SELECT SECTION
            <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={
              isSaving || isUploading
            }
            className="bg-bone px-6 py-3 text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "SAVING…"
              : "SAVE SETTINGS"}
          </button>

          {saved && (
            <span className="text-xs text-mango">
              Saved.
            </span>
          )}
        </div>
        </label>
        <select
          id="section-select"
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value as any)}
          className="max-w-xs rounded border border-line-strong bg-charcoal px-3 py-2 text-sm text-bone hover:border-mango focus:border-mango focus:outline-none"
        >
          {SECTION_CONFIG.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] leading-relaxed text-stone">
          {SECTION_CONFIG.find(s => s.id === selectedSection)?.description}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex max-w-3xl flex-col gap-12"
      >
        {/* ================================================= */}
        {/* HERO */}
        {/* ================================================= */}

        {selectedSection === "hero" && (
        <fieldset className="flex flex-col gap-6">
          <div>
            <legend className="label-technical mb-2">
              HERO CAROUSEL
            </legend>

            <p className="text-xs leading-relaxed text-stone">
              Manage the homepage hero carousel, including
              slides, images, text, products and transitions.
            </p>
          </div>

          {/* GLOBAL HERO SETTINGS */}

          <div className="flex flex-col gap-4 border border-line-strong bg-charcoal/30 p-5">
            <label className="flex items-center gap-2 text-sm text-bone-dim">
              <input
                type="checkbox"
                checked={settings.hero.enabled}
                onChange={(e) =>
                  updateHero({
                    enabled: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-[color:var(--color-mango)]"
              />

              Enable Hero Carousel
            </label>

            <label className="flex items-center gap-2 text-sm text-bone-dim">
              <input
                type="checkbox"
                checked={settings.hero.autoplay}
                onChange={(e) =>
                  updateHero({
                    autoplay: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-[color:var(--color-mango)]"
              />

              Enable Autoplay
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-stone">
                  Autoplay Duration
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2"
                    max="30"
                    step="0.5"
                    value={
                      settings.hero.autoplayDuration /
                      1000
                    }
                    onChange={(e) =>
                      updateHero({
                        autoplayDuration:
                          Math.max(
                            2,
                            Math.min(
                              30,
                              Number(e.target.value) ||
                                6
                            )
                          ) * 1000,
                      })
                    }
                    className={inputClass}
                  />

                  <span className="shrink-0 text-xs text-stone">
                    SEC
                  </span>
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-stone">
                  Transition
                </span>

                <select
                  value={settings.hero.transition}
                  onChange={(e) =>
                    updateHero({
                      transition:
                        e.target
                          .value as HeroTransition,
                    })
                  }
                  className={selectClass}
                >
                  <option value="fade">Fade</option>
                  <option value="slide">Slide</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-stone">
                  Transition Speed
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="200"
                    max="3000"
                    step="100"
                    value={
                      settings.hero
                        .transitionDuration
                    }
                    onChange={(e) =>
                      updateHero({
                        transitionDuration:
                          Math.max(
                            200,
                            Math.min(
                              3000,
                              Number(
                                e.target.value
                              ) || 800
                            )
                          ),
                      })
                    }
                    className={inputClass}
                  />

                  <span className="shrink-0 text-xs text-stone">
                    MS
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* SLIDES */}

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <div>
                <p className="label-technical">
                  HERO SLIDES
                </p>

                <p className="mt-2 text-xs leading-relaxed text-stone">
                  Add up to 10 slides. Use the arrows to
                  control the display order.
                </p>
              </div>

              <button
                type="button"
                onClick={addHeroSlide}
                disabled={
                  settings.hero.slides.length >= 10
                }
                className="border border-line-strong px-5 py-3 text-xs font-medium tracking-[0.18em] text-bone transition-colors hover:border-bone hover:text-mango disabled:cursor-not-allowed disabled:opacity-30"
              >
                + ADD HERO SLIDE
              </button>
            </div>

            {settings.hero.slides.map(
              (slide, index) => {
                const selectedProduct =
                  products.find(
                    (product) =>
                      product.id ===
                      slide.productId
                  );

                return (
                  <div
                    key={slide.id}
                    className={`border border-line-strong bg-charcoal/30 ${
                      !slide.enabled
                        ? "opacity-60"
                        : ""
                    }`}
                  >
                    {/* SLIDE HEADER */}

                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-strong px-5 py-4">
                      <div>
                        <p className="label-technical">
                          SLIDE{" "}
                          {String(index + 1).padStart(
                            2,
                            "0"
                          )}
                        </p>

                        <p className="mt-1 text-xs text-stone">
                          Homepage hero slide
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-bone-dim">
                          <input
                            type="checkbox"
                            checked={
                              slide.enabled
                            }
                            onChange={(e) =>
                              updateHeroSlide(
                                index,
                                {
                                  enabled:
                                    e.target
                                      .checked,
                                }
                              )
                            }
                            className="h-4 w-4 accent-[color:var(--color-mango)]"
                          />

                          Enabled
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            moveHeroSlide(
                              index,
                              "up"
                            )
                          }
                          disabled={index === 0}
                          className="border border-line-strong px-3 py-2 text-xs text-bone transition-colors hover:border-mango hover:text-mango disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Move Hero slide up"
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            moveHeroSlide(
                              index,
                              "down"
                            )
                          }
                          disabled={
                            index ===
                            settings.hero.slides
                              .length -
                              1
                          }
                          className="border border-line-strong px-3 py-2 text-xs text-bone transition-colors hover:border-mango hover:text-mango disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Move Hero slide down"
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            removeHeroSlide(
                              index
                            )
                          }
                          className="border border-line-strong px-3 py-2 text-xs text-bone transition-colors hover:border-mango hover:text-mango"
                        >
                          REMOVE
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-5 p-5">
                      {/* ============================================================
                          HERO IMAGE
                          Fixed admin preview area. Uploaded image dimensions
                          do not control the preview size.
                      ============================================================ */}

                      <div className="border-b border-line pb-5">
                        <p className="label-technical mb-3">
                          HERO IMAGE
                        </p>

                        <input
                          id={`hero-image-${slide.id}`}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          data-hero-index={index}
                          data-hero-field="image"
                          onChange={handleHeroImageUpload}
                          className="hidden"
                        />

                        {slide.image ? (
                          <div className="overflow-hidden border border-line-strong bg-charcoal">
                            {/* Fixed preview area */}
                            <div
                              className="relative h-[450px] w-full overflow-hidden bg-charcoal"
                              aria-label="Hero image preview"
                            >
                              <img
                                src={slide.image}
                                alt={
                                  slide.headlineLine1 ||
                                  "Hero preview"
                                }
                                className="absolute inset-0 h-full w-full object-cover"
                                style={{
                                  objectPosition:
                                    slide.imagePosition ||
                                    "center",
                                }}
                              />
                            </div>

                            <div className="flex flex-wrap gap-3 border-t border-line-strong p-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setHeroUploadIndex(index);

                                  const input =
                                    document.getElementById(
                                      `hero-image-${slide.id}`
                                    ) as HTMLInputElement | null;

                                  input?.click();
                                }}
                                disabled={isUploading}
                                className="bg-bone px-5 py-3 text-xs font-medium tracking-[0.15em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isUploading &&
                                heroUploadIndex === index
                                  ? "UPLOADING…"
                                  : "REPLACE IMAGE"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateHeroSlide(index, {
                                    image: "",
                                  })
                                }
                                disabled={isUploading}
                                className="border border-line-strong px-5 py-3 text-xs font-medium tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                REMOVE IMAGE
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setHeroUploadIndex(index);

                              const input =
                                document.getElementById(
                                  `hero-image-${slide.id}`
                                ) as HTMLInputElement | null;

                              input?.click();
                            }}
                            disabled={isUploading}
                            className="flex h-[450px] w-full flex-col items-center justify-center border border-dashed border-line-strong px-5 text-center transition-colors hover:border-bone disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="text-xs font-medium tracking-[0.18em] text-bone">
                              {isUploading &&
                              heroUploadIndex === index
                                ? "UPLOADING…"
                                : "ADD HERO IMAGE"}
                            </span>

                            {!isUploading && (
                              <span className="mt-2 text-[11px] text-stone">
                                JPG, PNG, WEBP or GIF · Maximum 10 MB
                              </span>
                            )}
                          </button>
                        )}
                      </div>

                      {/* MOBILE HERO IMAGE OVERRIDE */}
                      <div className="border-b border-line pb-5">
                        <p className="label-technical mb-3">
                          MOBILE HERO IMAGE OVERRIDE
                        </p>
                        <p className="mb-3 max-w-2xl text-[11px] leading-relaxed text-stone">
                          Not required. The main Hero Image automatically reframes itself for desktop and mobile. Upload a portrait override only when you want different artwork on phones.
                        </p>
                        <input
                          id={`hero-mobile-image-${slide.id}`}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          data-hero-index={index}
                          onChange={handleHeroMobileImageUpload}
                          className="hidden"
                        />
                        {slide.mobileImage ? (
                          <div className="overflow-hidden border border-line-strong bg-charcoal">
                            <div className="relative h-[420px] w-full overflow-hidden bg-charcoal sm:w-[320px]">
                              <img
                                src={slide.mobileImage}
                                alt={`${slide.headlineLine1 || "Hero"} mobile preview`}
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex flex-wrap gap-3 border-t border-line-strong p-3">
                              <button
                                type="button"
                                onClick={() => document.getElementById(`hero-mobile-image-${slide.id}`)?.click()}
                                disabled={isUploading}
                                className="bg-bone px-5 py-3 text-xs font-medium tracking-[0.15em] text-void transition-colors hover:bg-mango disabled:opacity-50"
                              >
                                REPLACE MOBILE IMAGE
                              </button>
                              <button
                                type="button"
                                onClick={() => updateHeroSlide(index, { mobileImage: "" })}
                                disabled={isUploading}
                                className="border border-line-strong px-5 py-3 text-xs font-medium tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango disabled:opacity-50"
                              >
                                REMOVE
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => document.getElementById(`hero-mobile-image-${slide.id}`)?.click()}
                            disabled={isUploading}
                            className="flex h-[300px] w-full max-w-[320px] flex-col items-center justify-center border border-dashed border-line-strong px-5 text-center transition-colors hover:border-bone disabled:opacity-50"
                          >
                            <span className="text-xs font-medium tracking-[0.18em] text-bone">
                              ADD MOBILE OVERRIDE
                            </span>
                            <span className="mt-2 text-[11px] text-stone">
                              Portrait JPG, PNG, WEBP or GIF · Maximum 10 MB
                            </span>
                          </button>
                        )}
                      </div>

                      {/* IMAGE FOCAL POINT */}

                      <label className="flex flex-col gap-1.5">
                          <span className="text-xs text-stone">
                            Image focal point
                          </span>

                          <select
                            value={
                              slide.imagePosition ||
                              "center"
                            }
                            onChange={(e) =>
                              updateHeroSlide(index, {
                                imagePosition: e.target
                                  .value as HeroImagePosition,
                              })
                            }
                            className={selectClass}
                          >
                            {HERO_IMAGE_POSITION_OPTIONS.map(
                              (option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              )
                            )}
                          </select>

                          <span className="text-[11px] leading-relaxed text-stone-dark">
                            Choose the part of the image
                            that must always stay visible
                            (for example the model&apos;s
                            face) when the picture is
                            cropped on different screens.
                          </span>
                        </label>
                      </div>

                      {/* LABELS */}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs text-stone">
                            Top Label
                          </span>

                          <input
                            value={
                              slide.topLabel
                            }
                            onChange={(e) =>
                              updateHeroSlide(
                                index,
                                {
                                  topLabel:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            className={inputClass}
                            placeholder="MANGOSTA / 04"
                          />
                        </label>

                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs text-stone">
                            Secondary Label
                          </span>

                          <input
                            value={
                              slide.secondaryLabel
                            }
                            onChange={(e) =>
                              updateHeroSlide(
                                index,
                                {
                                  secondaryLabel:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            className={inputClass}
                            placeholder="MANGOSTA STUDIOS"
                          />
                        </label>
                      </div>

                      {/* HEADLINE */}

                      <div className="border-t border-line pt-5">
                        <p className="label-technical mb-3">
                          HEADLINE
                        </p>

                        <div className="grid gap-4">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-stone">
                              Line 1
                            </span>

                            <input
                              value={
                                slide.headlineLine1
                              }
                              onChange={(e) =>
                                updateHeroSlide(
                                  index,
                                  {
                                    headlineLine1:
                                      e.target
                                        .value,
                                  }
                                )
                              }
                              className={inputClass}
                              placeholder="WEAR"
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-stone">
                              Line 2
                            </span>

                            <input
                              value={
                                slide.headlineLine2
                              }
                              onChange={(e) =>
                                updateHeroSlide(
                                  index,
                                  {
                                    headlineLine2:
                                      e.target
                                        .value,
                                  }
                                )
                              }
                              className={inputClass}
                              placeholder="YOUR"
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-stone">
                              Line 3
                            </span>

                            <input
                              value={
                                slide.headlineLine3
                              }
                              onChange={(e) =>
                                updateHeroSlide(
                                  index,
                                  {
                                    headlineLine3:
                                      e.target
                                        .value,
                                  }
                                )
                              }
                              className={inputClass}
                              placeholder="ATTITUDE."
                            />
                          </label>
                        </div>

                        <label className="mt-4 flex flex-col gap-1.5">
                          <span className="text-xs text-stone">
                            Headline Font
                          </span>

                          <select
                            value={
                              slide.titleStyle
                            }
                            onChange={(e) =>
                              updateHeroSlide(
                                index,
                                {
                                  titleStyle:
                                    e.target
                                      .value as MangostaCodeStyle,
                                }
                              )
                            }
                            className={selectClass}
                          >
                            {STYLE_OPTIONS.map(
                              (style) => (
                                <option
                                  key={
                                    style.value
                                  }
                                  value={
                                    style.value
                                  }
                                >
                                  {style.label}
                                </option>
                              )
                            )}
                          </select>
                        </label>
                      </div>

                      {/* DESCRIPTION */}

                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-stone">
                          Description
                        </span>

                        <textarea
                          value={
                            slide.description
                          }
                          onChange={(e) =>
                            updateHeroSlide(
                              index,
                              {
                                description:
                                  e.target
                                    .value,
                              }
                            )
                          }
                          rows={4}
                          className={inputClass}
                          placeholder="Enter hero description..."
                        />
                      </label>

                      {/* CTA */}

                      <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs text-stone">
                            Button Text
                          </span>

                          <input
                            value={
                              slide.buttonText
                            }
                            onChange={(e) =>
                              updateHeroSlide(
                                index,
                                {
                                  buttonText:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            className={inputClass}
                            placeholder="SHOP THE DROP"
                          />
                        </label>

                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs text-stone">
                            Button URL
                          </span>

                          <input
                            value={
                              slide.buttonUrl
                            }
                            onChange={(e) =>
                              updateHeroSlide(
                                index,
                                {
                                  buttonUrl:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            className={inputClass}
                            placeholder="/shop"
                          />
                        </label>
                      </div>

                      {/* ISSUE */}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs text-stone">
                            Issue Label
                          </span>

                          <input
                            value={
                              slide.issueLabel
                            }
                            onChange={(e) =>
                              updateHeroSlide(
                                index,
                                {
                                  issueLabel:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            className={inputClass}
                            placeholder="ISSUE 04"
                          />
                        </label>

                        <label className="flex flex-col gap-1.5">
                          <span className="text-xs text-stone">
                            Issue Subtitle
                          </span>

                          <input
                            value={
                              slide.issueSubtitle
                            }
                            onChange={(e) =>
                              updateHeroSlide(
                                index,
                                {
                                  issueSubtitle:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            className={inputClass}
                            placeholder="MANGOSTA STUDIOS"
                          />
                        </label>
                      </div>

                      {/* PRODUCT */}

                      <div className="border-t border-line pt-5">
                        <p className="label-technical mb-3">
                          FEATURED PRODUCT
                        </p>

                        <label className="flex flex-col gap-2">
                          <span className="text-xs text-stone">
                            Product
                          </span>

                          <select
                            value={
                              slide.productId
                            }
                            onChange={(e) =>
                              handleHeroProductChange(
                                index,
                                e.target.value
                              )
                            }
                            disabled={
                              productsLoading
                            }
                            className={selectClass}
                          >
                            <option value="">
                              {productsLoading
                                ? "Loading products…"
                                : "No product — content only"}
                            </option>

                            {products.map(
                              (product) => (
                                <option
                                  key={
                                    product.id
                                  }
                                  value={
                                    product.id
                                  }
                                >
                                  {product.name}
                                </option>
                              )
                            )}
                          </select>

                          <p className="text-[11px] leading-relaxed text-stone-dark">
                            Selecting a product
                            automatically fills its
                            title, image and product
                            page link. These values
                            can still be edited below.
                          </p>
                        </label>

                        {selectedProduct && (
                          <div className="mt-4 flex items-center gap-4 border border-line-strong p-3">
                            {selectedProduct.images?.[0] ? (
                              <div className="h-16 w-16 shrink-0 overflow-hidden bg-charcoal">
                                <img
                                  src={
                                    selectedProduct
                                      .images[0]
                                  }
                                  alt={
                                    selectedProduct.name
                                  }
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-charcoal text-[10px] text-stone">
                                NO IMAGE
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="text-sm text-bone">
                                {
                                  selectedProduct.name
                                }
                              </p>

                              <p className="mt-1 truncate text-[11px] text-stone">
                                /product/
                                {
                                  selectedProduct.slug
                                }
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 grid gap-4">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-stone">
                              Product Title
                            </span>

                            <input
                              value={
                                slide.productTitle
                              }
                              onChange={(e) =>
                                updateHeroSlide(
                                  index,
                                  {
                                    productTitle:
                                      e.target
                                        .value,
                                  }
                                )
                              }
                              className={inputClass}
                              placeholder="Product title"
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-stone">
                              Product Image
                            </span>

                            <input
                              value={
                                slide.productImage
                              }
                              onChange={(e) =>
                                updateHeroSlide(
                                  index,
                                  {
                                    productImage:
                                      e.target
                                        .value,
                                  }
                                )
                              }
                              className={inputClass}
                              placeholder="Product image URL"
                            />
                          </label>

                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-stone">
                              Product Destination
                            </span>

                            <input
                              value={
                                slide.productLink
                              }
                              onChange={(e) =>
                                updateHeroSlide(
                                  index,
                                  {
                                    productLink:
                                      e.target
                                        .value,
                                  }
                                )
                              }
                              className={inputClass}
                              placeholder="/product/product-slug"
                            />

                            <span className="text-[11px] text-stone-dark">
                              Automatically populated
                              from the selected product.
                              You can override it if
                              required.
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                );
              }
            )}

            {settings.hero.slides.length === 0 && (
              <div className="border border-dashed border-line-strong px-5 py-10 text-center">
                <p className="text-xs text-stone">
                  No Hero slides configured.
                </p>

                <button
                  type="button"
                  onClick={addHeroSlide}
                  className="mt-4 border border-line-strong px-5 py-3 text-xs font-medium tracking-[0.18em] text-bone transition-colors hover:border-bone hover:text-mango"
                >
                  + ADD FIRST SLIDE
                </button>
              </div>
            )}
          </div>
        </fieldset>
        )}

        {/* ================================================= */}
        {/* ON THE RAIL */}
        {/* ================================================= */}

        {selectedSection === "rail" && (
        <fieldset className="flex flex-col gap-6">
          <div>
            <legend className="label-technical mb-2">
              ON THE RAIL
            </legend>
            <p className="text-xs leading-relaxed text-stone">
              The clothes rail shown right after the hero. Customers hover
              (or tap) a garment to turn it to the front, then click it to
              see the front / back view, choose colour and size, and add it
              to the bag.
            </p>
          </div>

          <div className="flex flex-col gap-4 border border-line-strong bg-charcoal/30 p-5">
            <label className="flex items-center gap-2 text-sm text-bone-dim">
              <input
                type="checkbox"
                checked={settings.rail.enabled}
                onChange={(e) => updateRail({ enabled: e.target.checked })}
                className="h-4 w-4 accent-[color:var(--color-mango)]"
              />
              Show ON THE RAIL section
            </label>

            <label className="flex items-start gap-2 text-sm text-bone-dim">
              <input
                type="checkbox"
                checked={settings.rail.showOnMobile}
                onChange={(e) => updateRail({ showOnMobile: e.target.checked })}
                disabled={!settings.rail.enabled}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-mango)] disabled:opacity-40"
              />
              <span>
                Show on phones
                <span className="mt-0.5 block text-[11px] text-stone">
                  On = the rail shows on every device (the Hero carousel follows
                  its own on/off setting). Off = phones (screens under 768px)
                  show the Hero carousel instead of the rail — even if the Hero
                  carousel is switched off — while tablets, laptops and desktops
                  show only the rail, without the Hero carousel.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm text-bone-dim">
              <input
                type="checkbox"
                checked={settings.rail.showHangers}
                onChange={(e) => updateRail({ showHangers: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-mango)]"
              />
              <span>
                Draw hanger hooks above garments
                <span className="mt-0.5 block text-[11px] text-stone">
                  Turn off if your images already include a hanger.
                </span>
              </span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-stone">Section Label</span>
                <input
                  value={settings.rail.label}
                  onChange={(e) => updateRail({ label: e.target.value })}
                  className={inputClass}
                  placeholder="02 — ON THE RAIL"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-stone">Secondary Label</span>
                <input
                  value={settings.rail.secondaryLabel}
                  onChange={(e) => updateRail({ secondaryLabel: e.target.value })}
                  className={inputClass}
                  placeholder="MANGOSTA / FW26"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-stone">Button Text</span>
                <input
                  value={settings.rail.buttonText}
                  onChange={(e) => updateRail({ buttonText: e.target.value })}
                  className={inputClass}
                  placeholder="EXPLORE MANGOSTA (leave empty to hide)"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-stone">Button URL</span>
                <input
                  value={settings.rail.buttonUrl}
                  onChange={(e) => updateRail({ buttonUrl: e.target.value })}
                  className={inputClass}
                  placeholder="/shop"
                />
              </label>
            </div>
          </div>

          <div className="border border-line-strong bg-charcoal/30 p-4 text-[11px] leading-relaxed text-stone">
            <p>
              <span className="text-bone">Garments:</span>{" "}
              {settings.rail.items.some((item) => item.enabled && item.productId)
                ? `${settings.rail.items.filter((item) => item.enabled && item.productId).length} chosen garment(s) hang on the rail, in this order.`
                : "None chosen — the rail automatically shows every product that has an image (up to 20)."}
            </p>
            <p className="mt-2">
              <span className="text-bone">Images:</span> Front = the product&apos;s 1st image, Back = its 2nd image.
              Upload a hanger image below only if you want different artwork on the rail.
              Transparent PNGs (garment only, no background) look best.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {settings.rail.items.map((item, index) => {
              const selectedProduct = products.find(
                (product) => product.id === item.productId
              );
              // Hide products already chosen in another rail row,
              // but always keep this row's own product in its list.
              const availableProducts = products.filter(
                (product) =>
                  product.id === item.productId ||
                  !railUsedProductIds.has(product.id)
              );
              const frontPreview =
                item.frontImage || selectedProduct?.images?.[0] || "";
              const backPreview =
                item.backImage || selectedProduct?.images?.[1] || "";

              const imageFields = [
                {
                  field: "frontImage" as const,
                  label: "Front",
                  value: item.frontImage,
                  preview: frontPreview,
                  source: item.frontImage
                    ? "Custom hanger image"
                    : selectedProduct?.images?.[0]
                      ? "Product image 1"
                      : "No image — upload one or add a product image",
                },
                {
                  field: "backImage" as const,
                  label: "Back",
                  value: item.backImage,
                  preview: backPreview,
                  source: item.backImage
                    ? "Custom hanger image"
                    : selectedProduct?.images?.[1]
                      ? "Product image 2"
                      : "No back view — the FRONT / BACK switch is hidden",
                },
              ];

              return (
                <div
                  key={`rail-${index}`}
                  className="border border-line-strong bg-charcoal/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-strong px-5 py-4">
                    <div>
                      <p className="label-technical">
                        RAIL {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="mt-1 text-xs text-stone">
                        {selectedProduct ? selectedProduct.name : "Choose a product"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-bone-dim">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) =>
                            updateRailItem(index, { enabled: e.target.checked })
                          }
                          className="h-4 w-4 accent-[color:var(--color-mango)]"
                        />
                        Enabled
                      </label>

                      <button
                        type="button"
                        onClick={() => moveRailItem(index, "up")}
                        disabled={index === 0 || isUploading}
                        aria-label={`Move rail ${index + 1} up`}
                        className="border border-line-strong px-3 py-2 text-xs text-bone transition-colors hover:border-mango hover:text-mango disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        onClick={() => moveRailItem(index, "down")}
                        disabled={index === settings.rail.items.length - 1 || isUploading}
                        aria-label={`Move rail ${index + 1} down`}
                        className="border border-line-strong px-3 py-2 text-xs text-bone transition-colors hover:border-mango hover:text-mango disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        onClick={() => removeRailItem(index)}
                        disabled={isUploading}
                        className="border border-line-strong px-3 py-2 text-xs text-bone transition-colors hover:border-mango hover:text-mango disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 p-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-stone">Product</span>
                        <select
                          value={item.productId}
                          onChange={(e) =>
                            updateRailItem(index, { productId: e.target.value })
                          }
                          className={selectClass}
                        >
                          <option value="">
                            {productsLoading
                              ? "Loading products…"
                              : availableProducts.length === 0
                                ? "All products are already on the rail"
                                : "Select a product"}
                          </option>
                          {availableProducts.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-stone">Display Title (optional)</span>
                        <input
                          value={item.title}
                          onChange={(e) => updateRailItem(index, { title: e.target.value })}
                          className={inputClass}
                          placeholder={selectedProduct?.name || "Uses the product name"}
                        />
                      </label>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      {imageFields.map((image) => {
                        const uploading =
                          isUploading && railUploadKey === `${index}-${image.field}`;

                        return (
                          <div key={image.field} className="flex flex-col gap-2">
                            <span className="text-xs text-stone">
                              {image.label} hanger image (optional)
                            </span>

                            <div className="flex gap-3 border border-line-strong p-3">
                              <span
                                aria-hidden="true"
                                className="h-24 w-20 shrink-0 bg-void bg-contain bg-center bg-no-repeat"
                                style={
                                  image.preview
                                    ? { backgroundImage: `url("${image.preview}")` }
                                    : undefined
                                }
                              />
                              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                                <p className="text-[11px] leading-relaxed text-stone">
                                  {image.source}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <label
                                    className={`cursor-pointer border border-line-strong px-3 py-2 text-[10px] font-medium tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango ${
                                      isUploading ? "pointer-events-none opacity-40" : ""
                                    }`}
                                  >
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp,image/gif"
                                      className="hidden"
                                      disabled={isUploading}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        void handleRailImageUpload(index, image.field, file);
                                      }}
                                    />
                                    {uploading ? "UPLOADING…" : image.value ? "REPLACE" : "UPLOAD"}
                                  </label>

                                  {image.value && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateRailItem(index, { [image.field]: "" })
                                      }
                                      disabled={isUploading}
                                      className="border border-line-strong px-3 py-2 text-[10px] font-medium tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango disabled:opacity-40"
                                    >
                                      USE PRODUCT IMAGE
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <input
                              value={image.value}
                              onChange={(e) =>
                                updateRailItem(index, { [image.field]: e.target.value })
                              }
                              className={inputClass}
                              placeholder="…or paste an image URL"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addRailItem}
            disabled={
              settings.rail.items.length >= RAIL_MAX_ITEMS ||
              railNoProductsLeft
            }
            className="border border-line-strong px-5 py-3 text-xs font-medium tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango disabled:cursor-not-allowed disabled:opacity-40"
          >
            {settings.rail.items.length >= RAIL_MAX_ITEMS
              ? `MAXIMUM ${RAIL_MAX_ITEMS} GARMENTS`
              : railNoProductsLeft
                ? "ALL PRODUCTS ADDED"
                : "+ ADD GARMENT"}
          </button>
        </fieldset>
        )}

        {/* ================================================= */}
        {/* ANNOUNCEMENT BAR */}
        {/* ================================================= */}

        {selectedSection === "announcement" && (
        <fieldset className="flex flex-col gap-4">
          <legend className="label-technical mb-2">
            ANNOUNCEMENT BAR
          </legend>

          <label className="flex items-center gap-2 text-sm text-bone-dim">
            <input
              type="checkbox"
              checked={
                settings.announcementEnabled
              }
              onChange={(e) =>
                updateSetting(
                  "announcementEnabled",
                  e.target.checked
                )
              }
              className="h-4 w-4 accent-[color:var(--color-mango)]"
            />

            Show announcement bar
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-stone">
              Message
            </span>

            <input
              value={settings.announcementBar}
              onChange={(e) =>
                updateSetting(
                  "announcementBar",
                  e.target.value
                )
              }
              className={inputClass}
              placeholder="FREE SHIPPING ON ORDERS OVER $150"
            />
          </label>
        </fieldset>
        )}

        {/* ================================================= */}
        {/* DROP */}
        {/* ================================================= */}

        {selectedSection === "drop" && (
        <fieldset className="flex flex-col gap-6 border-t border-line pt-8">
          <div>
            <legend className="label-technical mb-2">
              THE DROP
            </legend>
            <p className="text-xs leading-relaxed text-stone">
              Manage the products displayed in the <span className="text-bone">03 — THE DROP</span> section independently from other homepage sections.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-bone-dim">
            <input
              type="checkbox"
              checked={settings.drop.enabled}
              onChange={(e) => updateDrop({ enabled: e.target.checked })}
              className="h-4 w-4 accent-[color:var(--color-mango)]"
            />
            Show THE DROP section
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-stone">Section Label</span>
            <input
              value={settings.drop.label}
              onChange={(e) => updateDrop({ label: e.target.value })}
              className={inputClass}
              placeholder="03 — THE DROP"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-stone">Section Title</span>
            <input
              value={settings.drop.title}
              onChange={(e) => updateDrop({ title: e.target.value })}
              className={inputClass}
              placeholder="THE DROP"
            />
          </label>

          <div className="flex flex-col gap-4">
            {settings.drop.products.map((item, index) => {
              const selectedProduct = products.find(
                (product) => product.id === item.productId
              );

              return (
                <div
                  key={`drop-${item.productId}-${index}`}
                  className="border border-line-strong bg-charcoal/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-strong px-5 py-4">
                    <div>
                      <p className="label-technical">
                        DROP {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="mt-1 text-xs text-stone">Product display card</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-bone-dim">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) =>
                            updateDropProduct(index, { enabled: e.target.checked })
                          }
                          className="h-4 w-4 accent-[color:var(--color-mango)]"
                        />
                        Enabled
                      </label>

                      <button
                        type="button"
                        onClick={() => moveDropProduct(index, "up")}
                        disabled={index === 0}
                        className="border border-line-strong px-3 py-2 text-xs text-bone transition-colors hover:border-mango hover:text-mango disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        onClick={() => moveDropProduct(index, "down")}
                        disabled={index === settings.drop.products.length - 1}
                        className="border border-line-strong px-3 py-2 text-xs text-bone transition-colors hover:border-mango hover:text-mango disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        onClick={() => removeDropProduct(index)}
                        className="border border-line-strong px-3 py-2 text-xs text-bone transition-colors hover:border-mango hover:text-mango"
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 p-5">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">Product</span>
                      <select
                        value={item.productId}
                        onChange={(e) => handleDropProductChange(index, e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select a product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedProduct && (
                      <div className="flex items-center gap-4 border border-line-strong p-3">
                        {selectedProduct.images?.[0] ? (
                          <img
                            src={selectedProduct.images[0]}
                            alt={selectedProduct.name}
                            className="h-16 w-16 object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 bg-charcoal" />
                        )}
                        <div>
                          <p className="text-xs font-medium text-bone">{selectedProduct.name}</p>
                          <p className="mt-1 text-[11px] text-stone">/product/{selectedProduct.slug}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-stone">Display Title</span>
                        <input
                          value={item.title}
                          onChange={(e) => updateDropProduct(index, { title: e.target.value })}
                          className={inputClass}
                          placeholder="Product title"
                        />
                      </label>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs text-stone">Title Font</span>
                        <select
                          value={item.titleStyle}
                          onChange={(e) =>
                            updateDropProduct(index, {
                              titleStyle: e.target.value as MangostaCodeStyle,
                            })
                          }
                          className={selectClass}
                        >
                          {STYLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">Product Destination</span>
                      <input
                        value={item.link}
                        onChange={(e) => updateDropProduct(index, { link: e.target.value })}
                        className={inputClass}
                        placeholder="/product/product-slug"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addDropProduct}
            className="border border-line-strong px-5 py-3 text-xs font-medium tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango"
          >
            + ADD DROP PRODUCT
          </button>
        </fieldset>
        )}

        {error && (
          <p
            role="alert"
            className="text-sm text-mango"
          >
            {error}
          </p>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={
              isSaving || isUploading
            }
            className="bg-bone px-6 py-3 text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "SAVING…"
              : "SAVE SETTINGS"}
          </button>

          {saved && (
            <span className="text-xs text-mango">
              Saved.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none";

const selectClass =
  "w-full border border-line-strong bg-void px-3.5 py-2.5 text-sm text-bone focus:border-bone focus:outline-none";