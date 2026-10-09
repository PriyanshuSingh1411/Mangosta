import { NextResponse } from "next/server";
import { getWishlistFolders, getWishlistItems, getWishlistOwnerByToken } from "@/app/lib/wishlist";
import { getProduct } from "@/app/lib/dataStore";
import { PUBLIC_STOCK_CAP, toPublicProduct, type Product } from "@/app/data/productTypes";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const userId = await getWishlistOwnerByToken(token);
  if (!userId) return NextResponse.json({ error: "Wishlist not found." }, { status: 404 });

  // Stock numbers are capped like everywhere else on the storefront.
  const items = (await getWishlistItems(userId)).map((item) => ({
    ...item,
    inventoryAtSave: Math.min(PUBLIC_STOCK_CAP, item.inventoryAtSave),
  }));
  const products = (await Promise.all(items.map((item) => getProduct(item.productId))))
    .filter((product): product is Product => Boolean(product))
    .map(toPublicProduct);
  return NextResponse.json({ items, products, folders: await getWishlistFolders(userId) });
}
