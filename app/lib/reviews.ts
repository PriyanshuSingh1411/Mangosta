import "server-only";

import { getStoreDb, shortId } from "@/app/lib/db";
import { getOrders } from "@/app/lib/dataStore";
import type { AuthUser } from "@/app/lib/auth/session";
import { summarizeReviews } from "@/app/data/storeTypes";
import type { PublicReview, Review, ReviewSummary } from "@/app/data/storeTypes";

// Reviews: only customers with a DELIVERED order containing the product
// can review it (once). Reviews show immediately; the admin can hide or
// delete them.

type ReviewDocument = Review & { _id: string };

async function reviewsCollection() {
  const db = await getStoreDb();
  return db.collection<ReviewDocument>("reviews");
}

function strip(document: ReviewDocument): Review {
  const review: Partial<ReviewDocument> = { ...document };
  delete review._id;
  return review as Review;
}

/** Published reviews as shown in the shop, flagged for the signed-in viewer. */
export async function getPublicReviews(
  productId: string,
  viewerId: string | null
): Promise<PublicReview[]> {
  const reviews = await getPublishedReviews(productId);
  const voted = viewerId
    ? await getVotedReviewIds(viewerId, reviews.map((review) => review.id))
    : new Set<string>();

  return reviews.map(({ userId, ...review }) => ({
    ...review,
    helpful: Math.max(0, Number(review.helpful) || 0),
    mine: Boolean(viewerId) && userId === viewerId,
    voted: voted.has(review.id),
  }));
}

/** Products this customer has already reviewed (published or hidden). */
export async function getReviewedProductIds(userId: string): Promise<string[]> {
  const collection = await reviewsCollection();
  const documents = await collection
    .find({ userId }, { projection: { productId: 1 } })
    .toArray();
  return [...new Set(documents.map((review) => review.productId))];
}

// ------------------------------------------------------------------
// "Helpful" votes — signed-in customers, one vote each (tap again to undo)
// ------------------------------------------------------------------

type VoteDocument = { _id: string; reviewId: string; userId: string; createdAt: string };

async function votesCollection() {
  const db = await getStoreDb();
  return db.collection<VoteDocument>("reviewVotes");
}

async function getVotedReviewIds(userId: string, reviewIds: string[]): Promise<Set<string>> {
  if (reviewIds.length === 0) return new Set();
  const votes = await votesCollection();
  const documents = await votes
    .find({ userId, reviewId: { $in: reviewIds } }, { projection: { reviewId: 1 } })
    .toArray();
  return new Set(documents.map((vote) => vote.reviewId));
}

export class ReviewVoteError extends Error {}

/**
 * Adds or removes this customer's "helpful" vote. The vote's id is
 * review + customer, so the same customer can never count twice.
 * Returns null when the review doesn't exist (or is hidden).
 */
export async function toggleHelpfulVote(
  reviewId: string,
  userId: string
): Promise<{ helpful: number; voted: boolean } | null> {
  const reviews = await reviewsCollection();
  const review = await reviews.findOne({ _id: reviewId, status: "published" });
  if (!review) return null;
  if (review.userId === userId) {
    throw new ReviewVoteError("You can't vote on your own review.");
  }

  const votes = await votesCollection();
  const key = `${reviewId}:${userId}`;
  let voted: boolean;

  const removed = await votes.deleteOne({ _id: key });
  if (removed.deletedCount === 1) {
    await reviews.updateOne({ _id: reviewId }, { $inc: { helpful: -1 } });
    voted = false;
  } else {
    try {
      await votes.insertOne({ _id: key, reviewId, userId, createdAt: new Date().toISOString() });
      await reviews.updateOne({ _id: reviewId }, { $inc: { helpful: 1 } });
    } catch (error) {
      // Same vote arrived twice at once: it already counts.
      if ((error as { code?: number })?.code !== 11000) throw error;
    }
    voted = true;
  }

  const updated = await reviews.findOne({ _id: reviewId }, { projection: { helpful: 1 } });
  return { helpful: Math.max(0, Number(updated?.helpful) || 0), voted };
}

export async function getPublishedReviews(productId: string): Promise<Review[]> {
  const collection = await reviewsCollection();
  const documents = await collection
    .find({ productId, status: "published" })
    .sort({ createdAt: -1 })
    .toArray();

  return documents.map(strip);
}

/** Rating summaries for every product that has published reviews. */
export async function getReviewSummaries(): Promise<Record<string, ReviewSummary>> {
  const collection = await reviewsCollection();
  const documents = await collection
    .find({ status: "published" }, { projection: { productId: 1, rating: 1 } })
    .toArray();

  const byProduct = new Map<string, { rating: number }[]>();
  for (const review of documents) {
    const list = byProduct.get(review.productId) ?? [];
    list.push({ rating: review.rating });
    byProduct.set(review.productId, list);
  }

  const summaries: Record<string, ReviewSummary> = {};
  for (const [productId, list] of byProduct) {
    summaries[productId] = summarizeReviews(list);
  }

  return summaries;
}

export type ReviewEligibility =
  | { canReview: true; color: string; size: string }
  | { canReview: false; reason: "signed_out" | "not_purchased" | "already_reviewed" };

export async function getReviewEligibility(
  user: AuthUser | null,
  productId: string
): Promise<ReviewEligibility> {
  if (!user) return { canReview: false, reason: "signed_out" };

  const collection = await reviewsCollection();
  const existing = await collection.findOne({ productId, userId: user.id });
  if (existing) return { canReview: false, reason: "already_reviewed" };

  const email = user.email.trim().toLowerCase();
  const orders = await getOrders();

  for (const order of orders) {
    if (order.status !== "delivered") continue;
    if (order.customer.email.trim().toLowerCase() !== email) continue;

    const line = order.lines.find((item) => item.productId === productId);
    if (line) {
      return { canReview: true, color: line.color, size: line.size };
    }
  }

  return { canReview: false, reason: "not_purchased" };
}

export function authorNameFor(user: AuthUser): string {
  const first = user.firstName.trim() || "Customer";
  const lastInitial = user.lastName.trim().charAt(0);
  return lastInitial ? `${first} ${lastInitial.toUpperCase()}.` : first;
}

export async function createReview(input: {
  user: AuthUser;
  productId: string;
  rating: number;
  title: string;
  body: string;
  photos: string[];
  color: string;
  size: string;
}): Promise<Review> {
  const collection = await reviewsCollection();
  const review: ReviewDocument = {
    _id: "",
    id: shortId("RV"),
    productId: input.productId,
    userId: input.user.id,
    authorName: authorNameFor(input.user),
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    title: input.title.trim().slice(0, 120),
    body: input.body.trim().slice(0, 2000),
    photos: input.photos.slice(0, 3),
    color: input.color,
    size: input.size,
    verified: true,
    status: "published",
    createdAt: new Date().toISOString(),
  };
  review._id = review.id;

  await collection.insertOne(review);
  return strip(review);
}

// ------------------------------------------------------------------
// admin
// ------------------------------------------------------------------

export async function getAllReviews(): Promise<Review[]> {
  const collection = await reviewsCollection();
  const documents = await collection.find({}).sort({ createdAt: -1 }).toArray();
  return documents.map(strip);
}

export async function setReviewStatus(
  id: string,
  status: Review["status"]
): Promise<boolean> {
  const collection = await reviewsCollection();
  const result = await collection.updateOne({ _id: id }, { $set: { status } });
  return result.matchedCount === 1;
}

/** Sets Mangosta's public reply; an empty text removes it. */
export async function setReviewReply(id: string, text: string): Promise<boolean> {
  const collection = await reviewsCollection();
  const clean = text.trim().slice(0, 1000);
  const result = clean
    ? await collection.updateOne(
        { _id: id },
        { $set: { reply: { text: clean, at: new Date().toISOString() } } }
      )
    : await collection.updateOne({ _id: id }, { $unset: { reply: "" } });
  return result.matchedCount === 1;
}

export async function deleteReview(id: string): Promise<boolean> {
  const collection = await reviewsCollection();
  const result = await collection.deleteOne({ _id: id });
  if (result.deletedCount === 1) {
    const votes = await votesCollection();
    await votes.deleteMany({ reviewId: id });
  }
  return result.deletedCount === 1;
}
