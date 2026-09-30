import type { Metadata } from "next";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import ShopGrid from "./ShopGrid";
import { getAllProducts, type ProductCategory } from "@/app/data/products";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop the full Mangosta collection — hoodies, tees, cargos, and outerwear.",
};

// Product data can change at any time via the admin panel, so this page
// should never be statically cached - always read the current JSON store.
export const dynamic = "force-dynamic";

const VALID_CATEGORIES: (ProductCategory | "all")[] = [
  "all",
  "t-shirts",
  "hoodies",
  "pants",
  "jackets",
  "accessories",
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const requested = params.category as ProductCategory | undefined;
  const initialCategory: ProductCategory | "all" = VALID_CATEGORIES.includes(
    requested as ProductCategory
  )
    ? (requested as ProductCategory)
    : "all";

  const products = await getAllProducts();

  return (
    <>
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void px-5 pb-28 pt-32 sm:px-8 sm:pt-40">
        <div className="mx-auto max-w-[1600px]">
          <p className="label-technical mb-5">SHOP</p>
          <h1 className="mb-14 font-display text-[11vw] leading-[0.85] tracking-tight text-bone sm:text-6xl md:text-7xl">
            ALL PRODUCTS
          </h1>
          <ShopGrid products={products} initialCategory={initialCategory} />
        </div>
      </main>
      <Footer />
    </>
  );
}
