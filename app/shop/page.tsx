import type { Metadata } from "next";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import ShopGrid from "./ShopGrid";
import { getAllProducts, type ProductCategory } from "@/app/data/products";
import { getReviewSummaries } from "@/app/lib/reviews";

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

  const [products, ratings] = await Promise.all([
    getAllProducts(),
    getReviewSummaries().catch(() => ({})),
  ]);

  return (
    <>
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-[1600px]">
          <p className="label-technical mb-5">SHOP</p>
          <h1 className="mb-10 type-title text-bone sm:mb-14">
            ALL PRODUCTS
          </h1>
          <ShopGrid products={products} initialCategory={initialCategory} ratings={ratings} />
        </div>
      </main>
      <Footer />
    </>
  );
}
