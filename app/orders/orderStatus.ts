// Labels and colours for order statuses on the customer's order pages.

import type {
  ReturnRequest,
  ReturnRequestStatus,
  ReturnRequestType,
} from "@/app/data/storeTypes";

export type StatusStyle = { label: string; className: string };

export const ORDER_STATUS_STYLE: Record<
  "pending" | "shipped" | "delivered" | "cancelled",
  StatusStyle
> = {
  pending: { label: "PROCESSING", className: "text-blue-400" },
  shipped: { label: "SHIPPED", className: "text-mango" },
  delivered: { label: "DELIVERED", className: "text-orange-400" },
  cancelled: { label: "CANCELLED", className: "text-red-500" },
};

// ============================================================
// RETURNS & EXCHANGES
//
// A delivered order whose every item is in a return / exchange
// request shows that request's step instead of DELIVERED:
//
//   RETURN REQUESTED → RETURN APPROVED → RETURN RECEIVED → REFUND COMPLETED
//   EXCHANGE REQUESTED → … → EXCHANGE COMPLETED
//
// When only some items are returned / exchanged, the order stays
// DELIVERED and only those product rows show their own step.
// ============================================================

/** The request fields the order pages need (from GET /api/returns). */
export type OrderReturnRequest = Pick<
  ReturnRequest,
  "id" | "orderId" | "type" | "status" | "items" | "createdAt"
>;

type StatusOrder = {
  id: string;
  status: string;
  lines: { lineId: string; quantity: number }[];
};

const RETURN_STEP_LABELS: Record<
  ReturnRequestType,
  Record<ReturnRequestStatus, string>
> = {
  return: {
    requested: "RETURN REQUESTED",
    approved: "RETURN APPROVED",
    received: "RETURN RECEIVED",
    completed: "REFUND COMPLETED",
    rejected: "RETURN REJECTED",
  },
  exchange: {
    requested: "EXCHANGE REQUESTED",
    approved: "EXCHANGE APPROVED",
    received: "EXCHANGE RECEIVED",
    completed: "EXCHANGE COMPLETED",
    rejected: "EXCHANGE REJECTED",
  },
};

// Same colours as the request list in "Returns & Exchanges".
const RETURN_STEP_CLASS: Record<ReturnRequestStatus, string> = {
  requested: "text-mango",
  approved: "text-mango",
  received: "text-mango",
  completed: "text-orange-400",
  rejected: "text-red-500",
};

/** How far along a request is (rejected requests are never compared). */
const STEP_ORDER: Record<ReturnRequestStatus, number> = {
  requested: 0,
  approved: 1,
  received: 2,
  completed: 3,
  rejected: -1,
};

export function returnStepStyle(
  type: ReturnRequestType,
  status: ReturnRequestStatus
): StatusStyle {
  return {
    label: RETURN_STEP_LABELS[type]?.[status] ?? "RETURN REQUESTED",
    className: RETURN_STEP_CLASS[status] ?? "text-mango",
  };
}

/** This order's requests, oldest first. */
function requestsFor(
  orderId: string,
  requests: OrderReturnRequest[]
): OrderReturnRequest[] {
  return requests
    .filter((request) => request.orderId === orderId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * The order-level return / exchange step, or null when the order should
 * keep its normal status (not delivered, no request, or only some items
 * returned / exchanged). Rejected requests never change the order status.
 */
export function orderReturnStatus(
  order: StatusOrder,
  requests: OrderReturnRequest[]
): StatusStyle | null {
  if (order.status !== "delivered" || order.lines.length === 0) return null;

  const active = requestsFor(order.id, requests).filter(
    (request) => request.status !== "rejected"
  );
  if (active.length === 0) return null;

  const covered = new Map<string, number>();
  for (const request of active) {
    for (const item of request.items) {
      covered.set(item.lineId, (covered.get(item.lineId) ?? 0) + item.quantity);
    }
  }

  const everyItem = order.lines.every(
    (line) => (covered.get(line.lineId) ?? 0) >= line.quantity
  );
  if (!everyItem) return null;

  // The order is only as far along as its slowest request.
  const slowest = active.reduce<ReturnRequestStatus>(
    (min, request) =>
      STEP_ORDER[request.status] < STEP_ORDER[min] ? request.status : min,
    "completed"
  );

  const types = new Set(active.map((request) => request.type));
  if (types.size === 1) {
    return returnStepStyle(active[0].type, slowest);
  }

  return {
    label:
      slowest === "completed"
        ? "RETURN & EXCHANGE COMPLETED"
        : "RETURN & EXCHANGE IN PROGRESS",
    className: RETURN_STEP_CLASS[slowest],
  };
}

/** The status shown in an order's STATUS field. */
export function orderStatusStyle(
  order: StatusOrder,
  requests: OrderReturnRequest[]
): StatusStyle {
  return (
    orderReturnStatus(order, requests) ??
    ORDER_STATUS_STYLE[order.status as keyof typeof ORDER_STATUS_STYLE] ??
    ORDER_STATUS_STYLE.pending
  );
}

export type LineReturnBadge = StatusStyle & {
  key: string;
  /** Units of this product in the request. */
  quantity: number;
  /** Units of this product in the order. */
  ofQuantity: number;
};

/** Every return / exchange step for one product row (no hiding). */
function stepsForLine(
  order: StatusOrder,
  line: { lineId: string; quantity: number },
  requests: OrderReturnRequest[]
): LineReturnBadge[] {
  const touching = requestsFor(order.id, requests).filter((request) =>
    request.items.some((item) => item.lineId === line.lineId)
  );
  const active = touching.filter((request) => request.status !== "rejected");
  // A rejected request is shown only while no newer request is active.
  const shown = active.length > 0 ? active : touching.slice(-1);

  return shown.map((request) => ({
    key: request.id,
    ...returnStepStyle(request.type, request.status),
    quantity: request.items
      .filter((item) => item.lineId === line.lineId)
      .reduce((sum, item) => sum + item.quantity, 0),
    ofQuantity: line.quantity,
  }));
}

/**
 * Return / exchange steps for one product row. Empty when the row has no
 * request, or when the order STATUS already says exactly the same thing
 * for every product (e.g. a one-product order that was fully refunded).
 * When products are at different steps, each product shows its own.
 */
export function lineReturnBadges(
  order: StatusOrder,
  line: { lineId: string; quantity: number },
  requests: OrderReturnRequest[]
): LineReturnBadge[] {
  const orderLevel = orderReturnStatus(order, requests);

  if (orderLevel) {
    const sameEverywhere = order.lines.every((orderLine) =>
      stepsForLine(order, orderLine, requests).every(
        (badge) =>
          badge.label === orderLevel.label &&
          badge.quantity >= badge.ofQuantity
      )
    );
    if (sameEverywhere) return [];
  }

  return stepsForLine(order, line, requests);
}

/** "REFUND COMPLETED" or "REFUND COMPLETED · 1 OF 3". */
export function lineBadgeText(badge: LineReturnBadge): string {
  return badge.quantity < badge.ofQuantity
    ? `${badge.label} · ${badge.quantity} OF ${badge.ofQuantity}`
    : badge.label;
}
