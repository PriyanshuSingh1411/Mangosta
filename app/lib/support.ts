import "server-only";
import { getStoreDb, shortId } from "@/app/lib/db";
import type { AuthUser } from "@/app/lib/auth/session";

export type SupportCategory = "order" | "delivery" | "return" | "product" | "size" | "other";
export type SupportStatus = "open" | "in_progress" | "resolved";
export type SupportMessage = { id: string; sender: "customer" | "admin"; text: string; createdAt: string };
export type SupportTicket = {
  id: string;
  userId: string;
  email: string;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  messages: SupportMessage[];
  createdAt: string;
  updatedAt: string;
};

type TicketDocument = SupportTicket & { _id: string };

async function tickets() {
  const db = await getStoreDb();
  return db.collection<TicketDocument>("supportTickets");
}

export async function getCustomerTickets(userId: string) {
  const collection = await tickets();
  return collection.find({ userId }).sort({ updatedAt: -1 }).toArray();
}

export async function getAllTickets() {
  const collection = await tickets();
  return collection.find({}).sort({ updatedAt: -1 }).toArray();
}

export async function createTicket(user: AuthUser, input: { category: SupportCategory; subject: string; message: string }) {
  const now = new Date().toISOString();
  const id = shortId("MG");
  const ticket: TicketDocument = {
    _id: id,
    id,
    userId: user.id,
    email: user.email,
    category: input.category,
    subject: input.subject.trim().slice(0, 120),
    status: "open",
    messages: [{ id: shortId("MSG"), sender: "customer", text: input.message.trim().slice(0, 2000), createdAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  await (await tickets()).insertOne(ticket);
  return ticket;
}

export async function addTicketReply(id: string, sender: "customer" | "admin", text: string) {
  const collection = await tickets();
  const message: SupportMessage = { id: shortId("MSG"), sender, text: text.trim().slice(0, 2000), createdAt: new Date().toISOString() };
  await collection.updateOne(
    { _id: id },
    { $push: { messages: message }, $set: { updatedAt: message.createdAt, ...(sender === "customer" ? { status: "open" } : { status: "in_progress" }) } }
  );
  return collection.findOne({ _id: id });
}

export async function updateTicketStatus(id: string, status: SupportStatus) {
  const collection = await tickets();
  const updatedAt = new Date().toISOString();
  await collection.updateOne({ _id: id }, { $set: { status, updatedAt } });
  return collection.findOne({ _id: id });
}
