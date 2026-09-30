import clientPromise from "@/app/lib/mongodb";

export interface NewsletterSubscriber {
  email: string;
  joinedAt: string;
  status: "active";
  source: "website";
}

const DB_NAME = "mangosta";
const COLLECTION_NAME = "newsletterSubscribers";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getCollection() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const collection = db.collection<NewsletterSubscriber>(
    COLLECTION_NAME
  );

  // Make sure the same email cannot be subscribed twice.
  await collection.createIndex(
    { email: 1 },
    { unique: true }
  );

  return collection;
}

export async function addSubscriber(email: string) {
  const normalizedEmail = normalizeEmail(email);

  const collection = await getCollection();

  const existingSubscriber = await collection.findOne({
    email: normalizedEmail,
  });

  if (existingSubscriber) {
    return {
      subscriber: existingSubscriber,
      isNew: false,
    };
  }

  const subscriber: NewsletterSubscriber = {
    email: normalizedEmail,
    joinedAt: new Date().toISOString(),
    status: "active",
    source: "website",
  };

  try {
    await collection.insertOne(subscriber);

    return {
      subscriber,
      isNew: true,
    };
  } catch (error: unknown) {
    // Handles a race condition where the same email
    // gets submitted twice at almost the same time.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      const existing = await collection.findOne({
        email: normalizedEmail,
      });

      if (existing) {
        return {
          subscriber: existing,
          isNew: false,
        };
      }
    }

    throw error;
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
        },
      }
    )
    .sort({ joinedAt: -1 })
    .toArray();
}