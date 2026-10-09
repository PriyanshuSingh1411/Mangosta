import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import ProductCard from "@/app/components/ProductCard";
import EngagementTracker from "@/app/components/EngagementTracker";
import ProductDetail from "./ProductDetail";
import { getAllProducts, getProductBySlug } from "@/app/data/products";
import { getCompleteTheLook, getProductSalePrice } from "@/app/data/productTypes";
import { getPublishedReviews } from "@/app/lib/reviews";
import { summarizeReviews } from "@/app/data/storeTypes";
import { getStoreConfig } from "@/app/lib/storeConfig";
import { jsonLdString } from "@/app/lib/jsonLd";

// Products can be added/edited/deleted via the admin panel at any time, so:
// - generateStaticParams seeds the known slugs at build time for speed, but
// - dynamicParams stays true (the default) so a brand-new product created
//   after the last build still resolves correctly (rendered on demand
//   instead of 404ing), and
// - revalidate keeps already-built product pages from serving stale data
//   indefinitely after an admin edit.
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: `${product.name} — MANGOSTA`,
      description: product.description,
      images: [{ url: "/icon-512.png", width: 512, height: 512, alt: product.name }],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const allProducts = await getAllProducts();
  const look = getCompleteTheLook(product, allProducts);
  const lookIds = new Set(look.map((p) => p.id));
  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id && !lookIds.has(p.id))
    .slice(0, 4);

  const reviewSummary = summarizeReviews(
    await getPublishedReviews(product.id).catch(() => [])
  );
  const returnsPolicy = await getStoreConfig("returnsPolicy");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: "MANGOSTA" },
    offers: {
      "@type": "Offer",
      price: getProductSalePrice(product),
      priceCurrency: product.currency,
      availability:
        product.inventory > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(reviewSummary.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewSummary.average,
            reviewCount: reviewSummary.count,
          },
        }
      : {}),
  };

return (
  <>
    <EngagementTracker
      event="product_view"
      productId={product.id}
      path={`/product/${product.slug}`}
      metadata={{
        productName: product.name,
        category: product.category,
      }}
    />

    {/* Search-engine data; jsonLdString escapes "<" so text can't end the tag. */}
    <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-[1600px]">
          <nav aria-label="Breadcrumb" className="mb-10 flex items-center gap-2 text-xs text-stone">
            <Link href="/" className="hover:text-bone">
              Home
            </Link>
            <span>/</span>
            <Link href="/shop" className="hover:text-bone">
              Shop
            </Link>
            <span>/</span>
            <span className="text-bone-dim">{product.name}</span>
          </nav>

          <ProductDetail product={product} reviewSummary={reviewSummary} returnsPolicy={returnsPolicy} />

          {look.length > 0 && (
            <section className="mt-28">
              <p className="label-technical mb-2">COMPLETE THE LOOK</p>
              <p className="mb-8 text-sm text-stone">Pieces that go with the {product.name}.</p>
              <div className="-mx-5 grid grid-cols-2 gap-x-1 gap-y-8 sm:mx-0 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
                {look.map((p) => (
  <ProductCard key={p.id} product={p} />
))}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section className="mt-32">
              <p className="label-technical mb-8">YOU MAY ALSO LIKE</p>
              <div className="-mx-5 grid grid-cols-2 gap-x-1 gap-y-8 sm:mx-0 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
             {related.map((p) => (
  <ProductCard key={p.id} product={p} />
))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
