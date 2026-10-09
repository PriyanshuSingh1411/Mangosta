import clientPromise from "@/app/lib/mongodb";

/**
 * pending      → signed up, waiting for the confirm link (gets no emails)
 * active       → confirmed (or signed-in customer's own verified email)
 * unsubscribed → used an unsubscribe link / unticked the account box
 */
export type NewsletterStatus = "pending" | "active" | "unsubscribed";

export interface NewsletterSubscriber {
  email: string;
  joinedAt: string;
  status: NewsletterStatus;
  source: "website";
  confirmedAt?: string;
  unsubscribedAt?: string;
}

const DB_NAME = "mangosta";
const COLLECTION_NAME = "newsletterSubscribers";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

let indexReady: Promise<unknown> | null = null;

async function getCollection() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const collection = db.collection<NewsletterSubscriber>(
    COLLECTION_NAME
  );

  // Make sure the same email cannot be subscribed twice.
  if (!indexReady) {
    indexReady = collection
      .createIndex({ email: 1 }, { unique: true })
      .catch((error) => {
        indexReady = null;
        throw error;
      });
  }
  await indexReady;

  return collection;
}

/**
 * A sign-up from the form. Creates a "pending" record when the address is
 * new; never changes an existing one (only the confirm link activates).
 * Returns the address's status.
 */
export async function requestSubscription(
  email: string
): Promise<{ status: NewsletterStatus; created: boolean }> {
  const normalizedEmail = normalizeEmail(email);
  const collection = await getCollection();

  const existing = await collection.findOne({ email: normalizedEmail });
  if (existing) {
    return { status: existing.status, created: false };
  }

  try {
    await collection.insertOne({
      email: normalizedEmail,
      joinedAt: new Date().toISOString(),
      status: "pending",
      source: "website",
    });
    return { status: "pending", created: true };
  } catch (error) {
    // The same email submitted twice at the same moment.
    if (!isDuplicateKeyError(error)) throw error;
    const current = await collection.findOne({ email: normalizedEmail });
    return { status: current?.status ?? "pending", created: false };
  }
}

/**
 * The owner confirmed (signed link), or a signed-in customer joined with
 * their own verified email: the address is active. Returns true when it
 * wasn't active before (so the welcome email should go out now).
 */
export async function activateSubscriber(email: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  const collection = await getCollection();
  const now = new Date().toISOString();

  const before = await collection.findOneAndUpdate(
    { email: normalizedEmail, status: { $ne: "active" } },
    { $set: { status: "active", confirmedAt: now }, $unset: { unsubscribedAt: "" } },
    { returnDocument: "before" }
  );
  if (before) return true;

  if (await collection.findOne({ email: normalizedEmail })) {
    return false; // already active
  }

  try {
    await collection.insertOne({
      email: normalizedEmail,
      joinedAt: now,
      confirmedAt: now,
      status: "active",
      source: "website",
    });
    return true;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    return false;
  }
}

export async function getSubscribers() {
  const collection = await getCollection();

  return collection
    .find(
      {},
      {
        projection: {
          _id: 0,
          email: 1,
          joinedAt: 1,
          status: 1,
          source: 1,
          confirmedAt: 1,
          unsubscribedAt: 1,
        },
      }
    )
    .sort({ joinedAt: -1 })
    .toArray();
}
