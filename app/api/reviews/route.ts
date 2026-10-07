import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getProduct } from "@/app/lib/dataStore";
import {
  createReview,
  getPublicReviews,
  getReviewEligibility,
} from "@/app/lib/reviews";
import { summarizeReviews } from "@/app/data/storeTypes";

export const dynamic = "force-dynamic";

/** GET /api/reviews?productId=p-001 → reviews, rating summary, can I review? */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId") ?? "";
  if (!productId) {
    return NextResponse.json({ error: "productId is required." }, { status: 400 });
  }

  const user = await getCurrentUser().catch(() => null);
  const reviews = await getPublicReviews(productId, user?.id ?? null);

  return NextResponse.json(
    {
      reviews,
      summary: summarizeReviews(reviews),
      eligibility: await getReviewEligibility(user, productId),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** POST /api/reviews { productId, rating, title, body, photos[] } */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to write a review." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const productId = String(body?.productId ?? "");
  const rating = Number(body?.rating);
  const title = String(body?.title ?? "").trim();
  const text = String(body?.body ?? "").trim();
  const photos: string[] = (Array.isArray(body?.photos) ? body.photos : [])
    .map((url: unknown) => String(url ?? ""))
    .filter((url: string) => url.startsWith("https://res.cloudinary.com/"))
    .slice(0, 3);

  if (!(await getProduct(productId))) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Please choose a rating from 1 to 5 stars." }, { status: 400 });
  }
  if (text.length < 10) {
    return NextResponse.json({ error: "Please write at least a few words (10+ characters)." }, { status: 400 });
  }

  const eligibility = await getReviewEligibility(user, productId);
  if (!eligibility.canReview) {
    const message =
      eligibility.reason === "already_reviewed"
        ? "You have already reviewed this product."
        : "Only customers who received this product can review it.";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const review = await createReview({
    user,
    productId,
    rating,
    title,
    body: text,
    photos,
    color: eligibility.color,
    size: eligibility.size,
  });

  return NextResponse.json({ review }, { status: 201 });
}
