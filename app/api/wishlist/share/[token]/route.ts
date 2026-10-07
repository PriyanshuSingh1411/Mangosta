import { NextResponse } from "next/server";
import { getWishlistFolders, getWishlistItems, getWishlistOwnerByToken } from "@/app/lib/wishlist";
import { getProduct } from "@/app/lib/dataStore";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await getWishlistOwnerByToken(token);
  if (!userId) return NextResponse.json({ error: "Wishlist not found." }, { status: 404 });

  const items = await getWishlistItems(userId);
  const products = (await Promise.all(items.map((item) => getProduct(item.productId)))).filter(Boolean);
  return NextResponse.json({ items, products, folders: await getWishlistFolders(userId) });
}
