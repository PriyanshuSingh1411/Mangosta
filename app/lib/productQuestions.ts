import "server-only";
import { getStoreDb, shortId } from "@/app/lib/db";
import type { AuthUser } from "@/app/lib/auth/session";

export type ProductQuestion = {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  question: string;
  answer?: string;
  answeredAt?: string;
  createdAt: string;
};

type QuestionDocument = ProductQuestion & { _id: string };

async function questions() {
  const db = await getStoreDb();
  return db.collection<QuestionDocument>("productQuestions");
}

function authorName(user: AuthUser) {
  const first = user.firstName.trim() || "Customer";
  const initial = user.lastName.trim().charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

export async function getProductQuestions(productId: string) {
  const collection = await questions();
  return collection.find({ productId }).sort({ answeredAt: -1, createdAt: -1 }).toArray();
}

export async function getAllProductQuestions() {
  const collection = await questions();
  return collection.find({}).sort({ createdAt: -1 }).toArray();
}

export async function createProductQuestion(user: AuthUser, productId: string, question: string) {
  const now = new Date().toISOString();
  const id = shortId("Q");
  const document: QuestionDocument = {
    _id: id,
    id,
    productId,
    userId: user.id,
    authorName: authorName(user),
    question: question.trim().slice(0, 800),
    createdAt: now,
  };
  await (await questions()).insertOne(document);
  return document;
}

export async function answerProductQuestion(id: string, answer: string) {
  const answeredAt = new Date().toISOString();
  await (await questions()).updateOne({ _id: id }, { $set: { answer: answer.trim().slice(0, 1200), answeredAt } });
  return (await questions()).findOne({ _id: id });
}
