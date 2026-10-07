import "server-only";

import { getStoreDb, shortId } from "@/app/lib/db";
import { getProduct } from "@/app/lib/dataStore";
import { getProductSalePrice } from "@/app/data/productTypes";
import { trackServerEngagement } from "@/app/lib/userEngagementServer";

export type WishlistItem = {
  productId: string;
  folder: string;
  addedAt: string;
  priceAtSave: number;
  inventoryAtSave: number;
};

type WishlistDocument = {
  _id: string;
  productIds?: string[];
  items?: WishlistItem[];
  folders?: string[];
  updatedAt: string;
};

type WishlistShareDocument = {
  _id: string;
  userId: string;
  token: string;
  createdAt: string;
};

const MAX_ITEMS = 100;
const DEFAULT_FOLDER = "All saved";

async function wishlists() {
  const db = await getStoreDb();
  return db.collection<WishlistDocument>("wishlists");
}

async function shares() {
  const db = await getStoreDb();
  return db.collection<WishlistShareDocument>("wishlistShares");
}

function normalizeItems(document?: WishlistDocument | null): WishlistItem[] {
  if (Array.isArray(document?.items)) {
    return document.items.map((item) => ({
      productId: String(item.productId),
      folder: String(item.folder || DEFAULT_FOLDER),
      addedAt: String(item.addedAt || new Date().toISOString()),
      priceAtSave: Number(item.priceAtSave) || 0,
      inventoryAtSave: Math.max(0, Number(item.inventoryAtSave) || 0),
    }));
  }

  return (document?.productIds ?? []).map((productId) => ({
    productId,
    folder: DEFAULT_FOLDER,
    addedAt: new Date().toISOString(),
    priceAtSave: 0,
    inventoryAtSave: 0,
  }));
}

async function readDocument(userId: string): Promise<WishlistDocument | null> {
  const collection = await wishlists();
  return collection.findOne({ _id: userId });
}

async function persistItems(userId: string, items: WishlistItem[], folders: string[]) {
  const collection = await wishlists();
  await collection.updateOne(
    { _id: userId },
    {
      $set: {
        items,
        productIds: items.map((item) => item.productId),
        folders: [...new Set([DEFAULT_FOLDER, ...folders.filter(Boolean)])],
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  );
}

export async function getWishlist(userId: string): Promise<string[]> {
  const document = await readDocument(userId);
  return normalizeItems(document).map((item) => item.productId);
}

export async function getWishlistItems(userId: string): Promise<WishlistItem[]> {
  const document = await readDocument(userId);
  const items = normalizeItems(document);

  // Migrate legacy productIds into richer wishlist items and capture the
  // current price/stock so future notifications can compare against it.
  if (items.some((item) => item.priceAtSave === 0 && item.inventoryAtSave === 0)) {
    const enriched = await Promise.all(
      items.map(async (item) => {
        if (item.priceAtSave > 0 || item.inventoryAtSave > 0) return item;
        const product = await getProduct(item.productId);
        return product
          ? {
              ...item,
              priceAtSave: getProductSalePrice(product),
              inventoryAtSave: Math.max(0, Number(product.inventory) || 0),
            }
          : item;
      })
    );
    await persistItems(userId, enriched, document?.folders ?? []);
    return enriched;
  }

  return items;
}

export async function getWishlistFolders(userId: string): Promise<string[]> {
  const document = await readDocument(userId);
  const items = normalizeItems(document);
  return [...new Set([DEFAULT_FOLDER, ...(document?.folders ?? []), ...items.map((item) => item.folder)])];
}

export async function setWishlistItem(
  userId: string,
  productId: string,
  saved: boolean
): Promise<string[]> {
  const document = await readDocument(userId);
  const current = normalizeItems(document);
  const folders = document?.folders ?? [];

if (!saved) {
  const existing = current.find(
    (item) => item.productId === productId
  );

  const next = current.filter(
    (item) => item.productId !== productId
  );

  await persistItems(userId, next, folders);

  if (existing) {
    await trackServerEngagement({
      event: "wishlist_remove",
      userId,
      productId,
      metadata: {
        folder: existing.folder,
        priceAtSave: existing.priceAtSave,
        inventoryAtSave: existing.inventoryAtSave,
      },
    });
  }

  return next.map((item) => item.productId);
}

  const product = await getProduct(productId);
  if (!product) return current.map((item) => item.productId);

  const existing = current.find((item) => item.productId === productId);
  const nextItem: WishlistItem = {
    productId,
    folder: existing?.folder || DEFAULT_FOLDER,
    addedAt: existing?.addedAt || new Date().toISOString(),
    priceAtSave: getProductSalePrice(product),
    inventoryAtSave: Math.max(0, Number(product.inventory) || 0),
  };
  const wasAlreadySaved = current.some(
  (item) => item.productId === productId
);

const next = [
  nextItem,
  ...current.filter((item) => item.productId !== productId),
].slice(0, MAX_ITEMS);

await persistItems(userId, next, folders);

if (!wasAlreadySaved) {
  await trackServerEngagement({
    event: "wishlist_add",
    userId,
    productId,
    metadata: {
      productName: product.name,
      category: product.category,
      folder: nextItem.folder,
      priceAtSave: nextItem.priceAtSave,
      inventoryAtSave: nextItem.inventoryAtSave,
    },
  });
}

return next.map((item) => item.productId);
}


export async function updateWishlistInventorySnapshot(userId: string, productId: string, inventory: number): Promise<void> {
  const collection = await wishlists();
  await collection.updateOne(
    { _id: userId, "items.productId": productId },
    { $set: { "items.$.inventoryAtSave": Math.max(0, Math.floor(Number(inventory) || 0)), updatedAt: new Date().toISOString() } }
  );
}

export async function moveWishlistItem(
  userId: string,
  productId: string,
  folder: string
): Promise<WishlistItem[]> {
  const cleanFolder = folder.trim().slice(0, 40) || DEFAULT_FOLDER;
  const document = await readDocument(userId);
  const current = normalizeItems(document);
  const folders = [...new Set([...(document?.folders ?? []), cleanFolder])];
  const next = current.map((item) =>
    item.productId === productId ? { ...item, folder: cleanFolder } : item
  );
  await persistItems(userId, next, folders);
  return next;
}

export async function createWishlistFolder(userId: string, folder: string): Promise<string[]> {
  const clean = folder.trim().slice(0, 40);
  if (!clean) return getWishlistFolders(userId);
  const document = await readDocument(userId);
  const folders = [...new Set([DEFAULT_FOLDER, ...(document?.folders ?? []), clean])];
  await persistItems(userId, normalizeItems(document), folders);
  return folders;
}

export async function deleteWishlistFolder(userId: string, folder: string): Promise<string[]> {
  if (!folder || folder === DEFAULT_FOLDER) return getWishlistFolders(userId);
  const document = await readDocument(userId);
  const current = normalizeItems(document);
  const next = current.map((item) =>
    item.folder === folder ? { ...item, folder: DEFAULT_FOLDER } : item
  );
  const folders = (document?.folders ?? []).filter((item) => item !== folder);
  await persistItems(userId, next, folders);
  return getWishlistFolders(userId);
}

export async function createWishlistShare(userId: string): Promise<string> {
  const collection = await shares();
  const existing = await collection.findOne({ userId });
  if (existing) return existing.token;

  const token = shortId("WL").replace(/-/g, "").toLowerCase();
  await collection.insertOne({
    _id: token,
    userId,
    token,
    createdAt: new Date().toISOString(),
  });
  return token;
}

export async function getWishlistOwnerByToken(token: string): Promise<string | null> {
  const collection = await shares();
  const document = await collection.findOne({ token: token.trim().toLowerCase() });
  return document?.userId ?? null;
}
