import "server-only";

import { getStoreDb, shortId } from "@/app/lib/db";
import { getOrders, restockLines } from "@/app/lib/dataStore";
import type { Order } from "@/app/lib/dataStore";
import { getStoreConfig } from "@/app/lib/storeConfig";
import { returnDaysLeft } from "@/app/data/storeTypes";
import type {
  ReturnRequest,
  ReturnRequestItem,
  ReturnRequestStatus,
  ReturnRequestType,
} from "@/app/data/storeTypes";

// Return / exchange requests ("returnRequests" collection).
//   customer:  requested
//   admin:     approved | rejected → received (optionally restock) → completed

type ReturnDocument = ReturnRequest & { _id: string };

const OPEN_OR_DONE: ReturnRequestStatus[] = [
  "requested",
  "approved",
  "received",
  "completed",
];

async function returnsCollection() {
  const db = await getStoreDb();
  return db.collection<ReturnDocument>("returnRequests");
}

function strip(document: ReturnDocument): ReturnRequest {
  const request: Partial<ReturnDocument> = { ...document };
  delete request._id;
  return request as ReturnRequest;
}

export class ReturnRequestError extends Error {}

export async function getReturnsForEmail(email: string): Promise<ReturnRequest[]> {
  const collection = await returnsCollection();
  const documents = await collection
    .find({ customerEmail: email.trim().toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  return documents.map(strip);
}

export async function getAllReturns(): Promise<ReturnRequest[]> {
  const collection = await returnsCollection();
  const documents = await collection.find({}).sort({ createdAt: -1 }).toArray();
  return documents.map(strip);
}

export async function countOpenReturns(): Promise<number> {
  const collection = await returnsCollection();
  return collection.countDocuments({ status: { $in: ["requested", "approved", "received"] } });
}

/** Units of each order line already in a return/exchange request. */
async function requestedQuantities(orderId: string): Promise<Map<string, number>> {
  const collection = await returnsCollection();
  const existing = await collection
    .find({ orderId, status: { $in: OPEN_OR_DONE } })
    .toArray();

  const used = new Map<string, number>();
  for (const request of existing) {
    for (const item of request.items) {
      used.set(item.lineId, (used.get(item.lineId) ?? 0) + item.quantity);
    }
  }
  return used;
}

export async function createReturnRequest(input: {
  email: string;
  orderId: string;
  type: ReturnRequestType;
  reason: string;
  note: string;
  items: { lineId: string; quantity: number; exchangeSize?: string; exchangeColor?: string }[];
}): Promise<ReturnRequest> {
  const email = input.email.trim().toLowerCase();
  const policy = await getStoreConfig("returnsPolicy");

  if (!policy.enabled) {
    throw new ReturnRequestError("Returns and exchanges are not available right now.");
  }
  if (input.type === "return" && !policy.allowReturns) {
    throw new ReturnRequestError("Returns are not available — you can request an exchange instead.");
  }
  if (input.type === "exchange" && !policy.allowExchanges) {
    throw new ReturnRequestError("Exchanges are not available — you can request a return instead.");
  }

  const orders = await getOrders();
  const order: Order | undefined = orders.find(
    (candidate) =>
      candidate.id === input.orderId &&
      candidate.customer.email.trim().toLowerCase() === email
  );

  if (!order) throw new ReturnRequestError("Order not found.");

  if (returnDaysLeft(order, policy) === null) {
    throw new ReturnRequestError(
      order.status === "delivered"
        ? `The ${policy.windowDays}-day return window for this order has closed.`
        : "Returns can be requested once your order has been delivered."
    );
  }

  const reason = input.reason.trim().slice(0, 120);
  if (!reason) throw new ReturnRequestError("Please choose a reason.");

  const alreadyRequested = await requestedQuantities(order.id);
  const items: ReturnRequestItem[] = [];

  for (const requested of input.items) {
    const quantity = Math.floor(Number(requested.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) continue;

    const line = order.lines.find((candidate) => candidate.lineId === requested.lineId);
    if (!line) throw new ReturnRequestError("One of the selected items is not in this order.");

    const remaining = line.quantity - (alreadyRequested.get(line.lineId) ?? 0);
    if (quantity > remaining) {
      throw new ReturnRequestError(
        remaining > 0
          ? `Only ${remaining} unit(s) of ${line.productName} can still be returned.`
          : `${line.productName} already has a return or exchange request.`
      );
    }

    const item: ReturnRequestItem = {
      lineId: line.lineId,
      productId: line.productId,
      productName: line.productName,
      color: line.color,
      size: line.size,
      quantity,
      image: line.image,
    };

    if (input.type === "exchange") {
      item.exchangeSize = String(requested.exchangeSize || line.size).slice(0, 20);
      item.exchangeColor = String(requested.exchangeColor || line.color).slice(0, 40);
    }

    items.push(item);
  }

  if (items.length === 0) {
    throw new ReturnRequestError("Select at least one item.");
  }

  const now = new Date().toISOString();
  const request: ReturnDocument = {
    _id: "",
    id: shortId("RT"),
    orderId: order.id,
    customerEmail: email,
    customerName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
    type: input.type,
    items,
    reason,
    note: input.note.trim().slice(0, 1000),
    status: "requested",
    adminNote: "",
    restocked: false,
    createdAt: now,
    updatedAt: now,
  };
  request._id = request.id;

  const collection = await returnsCollection();
  await collection.insertOne(request);

  return strip(request);
}

const NEXT_STATUSES: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["completed"],
  rejected: [],
  completed: [],
};

export function allowedNextStatuses(status: ReturnRequestStatus): ReturnRequestStatus[] {
  return NEXT_STATUSES[status];
}

/**
 * Admin update. When moving to "received" with restock=true the returned
 * units are added back to stock (once). Returns the restocked product ids
 * so the caller can send back-in-stock emails.
 */
export async function updateReturnRequest(input: {
  id: string;
  status?: ReturnRequestStatus;
  adminNote?: string;
  restock?: boolean;
}): Promise<{ request: ReturnRequest; restockedProductIds: string[] }> {
  const collection = await returnsCollection();
  const current = await collection.findOne({ _id: input.id });
  if (!current) throw new ReturnRequestError("Request not found.");

  const $set: Partial<ReturnDocument> = { updatedAt: new Date().toISOString() };
  let restockedProductIds: string[] = [];

  if (typeof input.adminNote === "string") {
    $set.adminNote = input.adminNote.slice(0, 1000);
  }

  if (input.status && input.status !== current.status) {
    if (!NEXT_STATUSES[current.status].includes(input.status)) {
      throw new ReturnRequestError(
        `A ${current.status} request can't be moved to ${input.status}.`
      );
    }
    $set.status = input.status;

    if (input.status === "received" && input.restock && !current.restocked) {
      restockedProductIds = await restockLines(current.items);
      $set.restocked = true;
    }
  }

  await collection.updateOne({ _id: input.id }, { $set });
  const updated = await collection.findOne({ _id: input.id });

  return { request: strip(updated!), restockedProductIds };
}
