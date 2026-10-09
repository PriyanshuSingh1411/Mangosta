import "server-only";

import type { ClientSession, Filter } from "mongodb";
import { getStoreDb, shortId } from "@/app/lib/db";
import {
  getCustomerOrder,
  getOrdersByIds,
  getProduct,
  InsufficientInventoryError,
  OrderInProgressError,
  accountLockId,
  restockLines,
  runExclusive,
  takeStockForExchange,
} from "@/app/lib/dataStore";
import type { Order } from "@/app/lib/dataStore";
import { getStoreConfig } from "@/app/lib/storeConfig";
import { returnDaysLeft } from "@/app/data/storeTypes";
import { calculateOrderRefunds } from "@/app/data/refunds";
import {
  getProductSizes,
  getVariantStock,
  hasVariantStock,
  PUBLIC_STOCK_CAP,
  variantKey,
} from "@/app/data/productTypes";
import type {
  ReturnRequest,
  ReturnRequestItem,
  ReturnRequestStatus,
  ReturnRequestType,
} from "@/app/data/storeTypes";

// Return / exchange requests ("returnRequests" collection).
//   customer:  requested
//   admin:     approved | rejected → received (optionally restock) → completed
//
// Exchanges and stock:
//   - request:  the wanted size / colour must exist and be in stock
//   - approved: the replacement unit(s) are taken out of stock, in the same
//               all-or-nothing step as the status change (exchangeStockTaken)
//   - rejected after approval: the replacement unit(s) go back into stock
//   - an exchange approved before this existed (no exchangeStockTaken) takes
//     its replacement when it is marked sent ("completed")
// Every status change is a conditional update on the current status, so
// two admins clicking at once can't apply a stock change twice.
//
// Refunds (returns only): worked out from what the customer actually paid
// (app/data/refunds.ts) and added to each request when it is loaded; the
// amount is saved as refundedAmount when the admin marks it refunded.

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

/**
 * Adds `refund` to return requests (not exchanges, not rejected ones),
 * using each order and ALL of its requests, so partial returns of the
 * same order share its payment correctly.
 */
async function withRefunds(requests: ReturnRequest[]): Promise<ReturnRequest[]> {
  const orderIds = [
    ...new Set(requests.filter((request) => request.type === "return").map((request) => request.orderId)),
  ];
  if (orderIds.length === 0) return requests;

  const [orders, related] = await Promise.all([
    getOrdersByIds(orderIds),
    returnsCollection().then((collection) =>
      collection.find({ orderId: { $in: orderIds } }).toArray()
    ),
  ]);

  const refunds = new Map<string, NonNullable<ReturnRequest["refund"]>>();
  for (const order of orders) {
    const forOrder = calculateOrderRefunds(
      order,
      related.filter((request) => request.orderId === order.id).map(strip)
    );
    for (const [id, refund] of forOrder) refunds.set(id, refund);
  }

  return requests.map((request) => {
    const refund = refunds.get(request.id);
    return refund ? { ...request, refund } : request;
  });
}

export async function getReturnsForEmail(email: string): Promise<ReturnRequest[]> {
  const collection = await returnsCollection();
  const documents = await collection
    .find({ customerEmail: email.trim().toLowerCase() })
    .sort({ createdAt: -1 })
    .toArray();
  return withRefunds(documents.map(strip));
}

export async function getAllReturns(): Promise<ReturnRequest[]> {
  const collection = await returnsCollection();
  const documents = await collection.find({}).sort({ createdAt: -1 }).toArray();
  return withRefunds(documents.map(strip));
}

export async function countOpenReturns(): Promise<number> {
  const collection = await returnsCollection();
  return collection.countDocuments({ status: { $in: ["requested", "approved", "received"] } });
}

/** Units of each order line already in a return/exchange request. */
async function requestedQuantities(
  orderId: string,
  session?: ClientSession
): Promise<Map<string, number>> {
  const collection = await returnsCollection();
  const existing = await collection
    .find({ orderId, status: { $in: OPEN_OR_DONE } }, { session })
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
  /** The signed-in account (orders placed by it count as theirs too). */
  userId?: string;
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

  const order: Order | null = await getCustomerOrder(
    { userId: input.userId, email },
    input.orderId
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

  // Checking how many units are still returnable and saving the request
  // happen as one step per account (the same lock as placing orders and
  // deleting the account), so two requests sent at the same moment can't
  // both claim the same units, and none can slip in while the account is
  // being deleted.
  const saveRequest = async (session?: ClientSession): Promise<ReturnDocument> => {
    if (input.userId) {
      const db = await getStoreDb();
      const account = await db
        .collection("users")
        .findOne({ id: input.userId }, { projection: { _id: 1 }, session });
      if (!account) {
        throw new ReturnRequestError("Your account is no longer available. Please sign in again.");
      }
    }

    const alreadyRequested = await requestedQuantities(order.id, session);
    const items: ReturnRequestItem[] = [];
    // Exchanges: units wanted per product / size & colour, to check stock.
    const wanted = new Map<string, { productId: string; label: string; color: string; size: string; quantity: number }>();

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
        const exchangeSize = String(requested.exchangeSize || line.size).slice(0, 20);
        const exchangeColor = String(requested.exchangeColor || line.color).slice(0, 40);

        if (exchangeSize === line.size && exchangeColor === line.color) {
          throw new ReturnRequestError(
            `For an exchange of ${line.productName}, choose a different size or colour.`
          );
        }

        // The wanted size / colour must be a real option of the product.
        const product = await getProduct(line.productId);
        const label = [exchangeColor, exchangeSize].filter(Boolean).join(" / ");

        if (!product) {
          throw new ReturnRequestError(
            `${line.productName} is no longer sold, so it can't be exchanged. You can request a return instead.`
          );
        }

        const colorExists =
          product.colors.length === 0
            ? exchangeColor === line.color
            : product.colors.some((option) => option.name === exchangeColor);

        if (!colorExists || !getProductSizes(product).includes(exchangeSize)) {
          throw new ReturnRequestError(
            `${line.productName} isn't available in ${label}. Please choose another size or colour.`
          );
        }

        const key = hasVariantStock(product)
          ? `${product.id}::${variantKey(exchangeColor, exchangeSize)}`
          : product.id;
        const entry = wanted.get(key) ?? {
          productId: product.id,
          label: hasVariantStock(product) ? `${line.productName} in ${label}` : line.productName,
          color: exchangeColor,
          size: exchangeSize,
          quantity: 0,
        };
        entry.quantity += quantity;
        wanted.set(key, entry);

        item.exchangeSize = exchangeSize;
        item.exchangeColor = exchangeColor;
      }

      items.push(item);
    }

    if (items.length === 0) {
      throw new ReturnRequestError("Select at least one item.");
    }

    // Exchanges: enough stock right now for every replacement (it is taken
    // out of stock when the request is approved).
    for (const entry of wanted.values()) {
      const product = await getProduct(entry.productId);
      const available = product
        ? Math.min(
            getVariantStock(product, entry.color, entry.size),
            Math.max(0, Math.floor(Number(product.inventory) || 0))
          )
        : 0;

      if (available < entry.quantity) {
        // Exact numbers only below PUBLIC_STOCK_CAP, like the storefront.
        throw new ReturnRequestError(
          available <= 0
            ? `${entry.label} is out of stock right now. Please choose another size or colour.`
            : available < PUBLIC_STOCK_CAP
              ? `Only ${available} of ${entry.label} ${available === 1 ? "is" : "are"} in stock. Please lower the quantity or choose another size or colour.`
              : `There isn't enough stock of ${entry.label} for ${entry.quantity}. Please lower the quantity or choose another size or colour.`
        );
      }
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
    await collection.insertOne(request, { session });
    return request;
  };

  let request: ReturnDocument;
  try {
    request = await runExclusive(accountLockId(input.userId, email), saveRequest);
  } catch (error) {
    if (error instanceof OrderInProgressError) {
      throw new ReturnRequestError(
        "Another request on your account is being saved right now. Please try again in a moment."
      );
    }
    throw error;
  }

  const [withRefund] = await withRefunds([strip(request)]);
  return withRefund;
}

const NEXT_STATUSES: Record<ReturnRequestStatus, ReturnRequestStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["completed"],
  rejected: [],
  completed: [],
};

/** The replacement items of an exchange, as stock lines. */
function replacementLines(request: ReturnRequest) {
  return request.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    color: item.exchangeColor ?? item.color,
    size: item.exchangeSize ?? item.size,
    quantity: item.quantity,
  }));
}

function describeShortItems(error: InsufficientInventoryError): string {
  return error.products
    .map((product) =>
      [product.productName, [product.color, product.size].filter(Boolean).join(" / ")]
        .filter(Boolean)
        .join(" in ")
    )
    .join(", ");
}

/** What happened to stock during an update (shown to the admin). */
export type ReturnStockChange =
  | "replacement-taken"
  | "replacement-returned"
  | "items-restocked"
  | null;

const CHANGED_ELSEWHERE =
  "This request was just changed (maybe in another tab). Refresh the page and try again.";

/**
 * Admin update. Each status change is ONE conditional update on the
 * current status, so a change (and its stock effect) happens only once:
 *   - exchange → approved: replacement taken out of stock (all-or-nothing;
 *     not enough stock → error, nothing changes)
 *   - approved exchange → rejected: replacement put back into stock
 *   - → received with restock=true: returned items added back to stock
 *   - older exchange (approved before replacements were reserved) →
 *     completed: replacement taken out of stock then
 * Returns the restocked product ids so the caller can send back-in-stock
 * emails.
 */
export async function updateReturnRequest(input: {
  id: string;
  status?: ReturnRequestStatus;
  adminNote?: string;
  restock?: boolean;
}): Promise<{
  request: ReturnRequest;
  restockedProductIds: string[];
  stockChange: ReturnStockChange;
}> {
  const collection = await returnsCollection();
  const current = await collection.findOne({ _id: input.id });
  if (!current) throw new ReturnRequestError("Request not found.");

  const now = new Date().toISOString();
  const noteSet: Partial<ReturnDocument> =
    typeof input.adminNote === "string"
      ? { adminNote: input.adminNote.slice(0, 1000) }
      : {};

  let restockedProductIds: string[] = [];
  let stockChange: ReturnStockChange = null;

  if (!input.status || input.status === current.status) {
    // Note only.
    await collection.updateOne(
      { _id: current._id },
      { $set: { ...noteSet, updatedAt: now } }
    );
  } else {
    const from = current.status;
    const to = input.status;

    if (!NEXT_STATUSES[from].includes(to)) {
      throw new ReturnRequestError(`A ${from} request can't be moved to ${to}.`);
    }

    const isExchange = current.type === "exchange";
    const takeReplacement =
      isExchange &&
      !current.exchangeStockTaken &&
      (to === "approved" ||
        // older exchanges approved before replacements were reserved
        (to === "completed" && from === "received"));

    if (takeReplacement) {
      let committed: boolean;

      try {
        committed = await takeStockForExchange(
          replacementLines(current),
          async (session) => {
            const result = await collection.updateOne(
              {
                _id: current._id,
                status: from,
                exchangeStockTaken: { $ne: true },
              },
              {
                $set: {
                  ...noteSet,
                  status: to,
                  exchangeStockTaken: true,
                  updatedAt: now,
                },
              },
              { session }
            );
            return result.modifiedCount === 1;
          }
        );
      } catch (error) {
        if (error instanceof InsufficientInventoryError) {
          throw new ReturnRequestError(
            to === "approved"
              ? `Can't approve this exchange: ${describeShortItems(error)} is out of stock. Add stock first, or reject the request and let the customer know.`
              : `Can't mark this exchange sent: ${describeShortItems(error)} is out of stock. Add stock for it first, then mark the exchange sent.`
          );
        }
        throw error;
      }

      if (!committed) throw new ReturnRequestError(CHANGED_ELSEWHERE);
      stockChange = "replacement-taken";
    } else {
      const giveBackReplacement =
        isExchange && to === "rejected" && current.exchangeStockTaken === true;
      const restockReturned =
        to === "received" && Boolean(input.restock) && !current.restocked;

      const filter: Filter<ReturnDocument> = { _id: current._id, status: from };
      const $set: Partial<ReturnDocument> = { ...noteSet, status: to, updatedAt: now };

      // Marked refunded: save the amount and its breakdown (what the
      // customer actually paid for these items, plus shipping if this brings
      // the whole order back). Saved refunds never change afterwards.
      if (to === "completed" && current.type === "return") {
        const [withRefund] = await withRefunds([strip(current)]);
        if (withRefund.refund) {
          $set.refundedAmount = withRefund.refund.total;
          $set.refundSnapshot = withRefund.refund;
        }
      }

      if (giveBackReplacement) {
        filter.exchangeStockTaken = true;
        $set.exchangeStockTaken = false;
      }
      if (restockReturned) {
        filter.restocked = { $ne: true };
        $set.restocked = true;
      }

      const result = await collection.updateOne(filter, { $set });
      if (result.modifiedCount !== 1) throw new ReturnRequestError(CHANGED_ELSEWHERE);

      // Stock goes back only after the status change was claimed, so it
      // happens exactly once.
      if (giveBackReplacement) {
        restockedProductIds = await restockLines(replacementLines(current));
        stockChange = "replacement-returned";
      }
      if (restockReturned) {
        restockedProductIds = [
          ...restockedProductIds,
          ...(await restockLines(current.items)),
        ];
        stockChange = "items-restocked";
      }
    }
  }

  const updated = await collection.findOne({ _id: input.id });
  const [request] = await withRefunds([strip(updated!)]);

  return {
    request,
    restockedProductIds: [...new Set(restockedProductIds)],
    stockChange,
  };
}
