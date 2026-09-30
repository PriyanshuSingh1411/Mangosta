import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import ProductCard from "@/app/components/ProductCard";
import ProductDetail from "./ProductDetail";
import { getAllProducts, getProductBySlug, formatPrice } from "@/app/data/products";

// Products can be added/edited/deleted via the admin panel at any time, so:
// - generateStaticParams seeds the known slugs at build time for speed, but
// - dynamicParams stays true (the default) so a brand-new product created
//   after the last build still resolves correctly (rendered on demand
//   instead of 404ing), and
// - revalidate keeps already-built product pages from serving stale data
//   indefinitely after an admin edit.
export const revalidate = 10;

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
  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: "MANGOSTA" },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency,
      availability:
        product.inventory > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navigation />
      <main id="main-content"className="min-h-screen bg-void px-5 pb-28 pt-24 sm:px-8 sm:pt-28">
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

          <ProductDetail product={product} />

          {related.length > 0 && (
            <section className="mt-32">
              <p className="label-technical mb-8">YOU MAY ALSO LIKE</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
                {related.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
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
