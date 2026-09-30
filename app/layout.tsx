import type { Metadata, Viewport } from "next";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/archivo/900.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import SmoothScrollProvider from "./components/SmoothScrollProvider";
import MotionPreferenceListener from "./components/MotionPreferenceListener";
import CustomCursor from "./components/CustomCursor";
import CartDrawer from "./components/CartDrawer";
import SearchOverlay from "./components/SearchOverlay";
import AuthProvider from "./components/AuthProvider";

const SITE_URL = "https://mangosta.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MANGOSTA — Premium Streetwear for the Next Generation",
    template: "%s — MANGOSTA",
  },
  description:
    "Mangosta is a premium contemporary fashion brand built for the generation that refuses to blend in.",
  keywords: ["Mangosta", "streetwear", "premium fashion", "Gen Z clothing", "urban apparel"],
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "MANGOSTA — Premium Streetwear for the Next Generation",
    description:
      "Mangosta is a premium contemporary fashion brand built for the generation that refuses to blend in.",
    url: SITE_URL,
    siteName: "MANGOSTA",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Mangosta" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MANGOSTA — Premium Streetwear for the Next Generation",
    description:
      "Mangosta is a premium contemporary fashion brand built for the generation that refuses to blend in.",
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MotionPreferenceListener />
        <CustomCursor />
        <div className="grain-overlay" aria-hidden="true" />
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[10000] -translate-y-24 bg-bone px-4 py-2 text-xs font-medium tracking-wide text-void transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <AuthProvider>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
          <CartDrawer />
          <SearchOverlay />
        </AuthProvider>
      </body>
    </html>
  );
}
