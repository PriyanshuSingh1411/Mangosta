import Navigation from "./components/Navigation";
import LoadingScreen from "./components/LoadingScreen";
import Hero from "./components/Hero";
import BrandStatement from "./components/BrandStatement";
import DropShowcase, { RailShowcase } from "./components/DropShowcase";
import TrendingSection from "./components/TrendingSection";
import Footer from "./components/Footer";
import PersonalizedHome from "./components/PersonalizedHome";
import { getProducts } from "./lib/dataStore";
import { getSettings } from "./lib/dataStore";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getProducts();
  const settings = await getSettings();

  // Admin → On the Rail → "Show on phones" OFF:
  //   phones (< 768px)       → Hero carousel only (shown even if the
  //                            Hero carousel itself is switched off)
  //   tablets and computers  → the rail only, no Hero carousel
  const railReplacesHero =
    settings.rail.enabled && !settings.rail.showOnMobile;

  // When the rail is the first section on a screen size (no Hero above
  // it), give it the same top space the Hero keeps for the fixed top bar.
  const railFirstOnPhones =
    settings.rail.enabled &&
    settings.rail.showOnMobile &&
    !settings.hero.enabled;
  const railFirstOnLarger =
    settings.rail.enabled &&
    (railReplacesHero || !settings.hero.enabled);
  const railTopSpace = railFirstOnPhones
    ? "pt-[76px] lg:pt-[50px]"
    : railFirstOnLarger
      ? "md:pt-[76px] lg:pt-[50px]"
      : "";

  return (
    <>
      <LoadingScreen />
      <Navigation />

      <main id="main-content">
        {railReplacesHero ? (
          <div className="md:hidden">
            <Hero settings={{ ...settings.hero, enabled: true }} />
          </div>
        ) : (
          <Hero settings={settings.hero} />
        )}

        {/* 02 — ON THE RAIL: clothes rail, managed from Admin Settings */}
        <div className={railTopSpace}>
          <RailShowcase
            settings={settings.rail}
            products={products}
          />
        </div>

        <BrandStatement />

        {/* 03 — THE DROP: independently managed from Admin Settings */}
        <DropShowcase
          settings={settings.drop}
          products={products}
        />

        {/* Trending products are always sourced from the current product catalog. */}
        <PersonalizedHome products={products} />
        <TrendingSection products={products} />
      </main>

      <Footer />
    </>
  );
}
