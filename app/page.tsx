import Navigation from "./components/Navigation";
import LoadingScreen from "./components/LoadingScreen";
import Hero from "./components/Hero";
import BrandStatement from "./components/BrandStatement";
import DropShowcase from "./components/DropShowcase";
import HorizontalGallery from "./components/HorizontalGallery";
import CollectionSection from "./components/CollectionSection";
import IdentitySection from "./components/IdentitySection";
import AboutSection from "./components/AboutSection";
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

        {/* 04 — MANGOSTA STUDIOS: completely independent configuration */}
        <HorizontalGallery
          enabled={settings.mangostaStudiosEnabled}
          label={settings.mangostaStudiosLabel}
          studios={settings.mangostaStudios}
        />

        <CollectionSection />
        <IdentitySection />
        <AboutSection />
      </main>

      <Footer />
    </>
  );
}
