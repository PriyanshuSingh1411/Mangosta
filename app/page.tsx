import Navigation from "./components/Navigation";
import LoadingScreen from "./components/LoadingScreen";
import Hero from "./components/Hero";
import BrandStatement from "./components/BrandStatement";
import DropShowcase from "./components/DropShowcase";
import TrendingSection from "./components/TrendingSection";
import Footer from "./components/Footer";
import { getProducts } from "./lib/dataStore";
import { getSettings } from "./lib/dataStore";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getProducts();
  const settings = await getSettings();

  return (
    <>
      <LoadingScreen />
      <Navigation />

      <main id="main-content">
        <Hero settings={settings.hero} />

        <BrandStatement />

        {/* 03 — THE DROP: independently managed from Admin Settings */}
        <DropShowcase
          settings={settings.drop}
          products={products}
        />

        {/* Trending products are always sourced from the current product catalog. */}
        <TrendingSection products={products} />
      </main>

      <Footer />
    </>
  );
}
