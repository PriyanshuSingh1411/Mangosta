import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import SharedWishlist from "@/app/components/SharedWishlist";

export default async function SharedWishlistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void px-5 pb-28 pt-32 sm:px-8 sm:pt-40">
        <SharedWishlist token={token} />
      </main>
      <Footer />
    </>
  );
}
