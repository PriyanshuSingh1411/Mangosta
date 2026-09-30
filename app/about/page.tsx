import type { Metadata } from "next";
import Navigation from "@/app/components/Navigation";
import AboutSection from "@/app/components/AboutSection";
import Footer from "@/app/components/Footer";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about Mangosta and the ideas behind the brand.",
};

export default function AboutPage() {
  return (
    <>
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void pt-[76px] lg:pt-[50px]">
        <AboutSection />
      </main>
      <Footer />
    </>
  );
}
