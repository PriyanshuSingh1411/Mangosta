import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getProduct } from "@/app/lib/dataStore";
import {
  createWishlistFolder,
  createWishlistShare,
  deleteWishlistFolder,
  getWishlist,
  getWishlistFolders,
  getWishlistItems,
  moveWishlistItem,
  setWishlistItem,
} from "@/app/lib/wishlist";
import { PUBLIC_STOCK_CAP } from "@/app/data/productTypes";

export const dynamic = "force-dynamic";

/** Saved items as sent to the browser: stock at save time capped like everywhere else. */
function publicItems<T extends { inventoryAtSave: number }>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    inventoryAtSave: Math.min(PUBLIC_STOCK_CAP, item.inventoryAtSave),
  }));
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  return NextResponse.json({
    productIds: await getWishlist(user.id),
    items: publicItems(await getWishlistItems(user.id)),
    folders: await getWishlistFolders(user.id),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = String(body?.action || "save");

  if (action === "save") {
    const productId = typeof body?.productId === "string" ? body.productId : "";
    const saved = body?.saved !== false;
    if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });
    if (saved && !(await getProduct(productId))) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ productIds: await setWishlistItem(user.id, productId, saved) });
  }

  if (action === "folder") {
    const productId = String(body?.productId || "");
    const folder = String(body?.folder || "");
    if (!productId || !folder) return NextResponse.json({ error: "Product and folder are required." }, { status: 400 });
    return NextResponse.json({ items: publicItems(await moveWishlistItem(user.id, productId, folder)) });
  }

  if (action === "create-folder") {
    return NextResponse.json({ folders: await createWishlistFolder(user.id, String(body?.folder || "")) });
  }

  if (action === "delete-folder") {
    return NextResponse.json({ folders: await deleteWishlistFolder(user.id, String(body?.folder || "")) });
  }

  if (action === "share") {
    const token = await createWishlistShare(user.id);
    return NextResponse.json({ token, url: `/wishlist/share/${token}` });
  }

  return NextResponse.json({ error: "Unknown wishlist action." }, { status: 400 });
}
