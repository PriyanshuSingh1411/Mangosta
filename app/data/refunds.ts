// Refund amounts for returns: what the customer actually paid for the
// returned units. All money is worked out in paise (whole numbers), so the
// amounts add up exactly.
//
//   1. Each order line's share of the order discount (coupon / reward) is
//      in proportion to the line's total; the paise are shared out with the
//      largest-remainder method, so the shares add up to the discount
//      exactly. A line's "paid" = its total minus its discount share.
//   2. Refunds already paid out (completed requests) stay exactly as saved
//      (refundSnapshot) and come off what is left to refund.
//   3. Other open requests, in the order they were made: returned units get
//      paid × units / quantity of what is left; the request that returns a
//      line's LAST unit gets exactly what remains of that line, so all
//      refunds of a line add up to what was paid for it.
//   4. Shipping is refunded once, only when the whole order is back: it is
//      added to the latest open request that, together with the requests
//      already received or refunded, covers every unit of the order. (So a
//      request that is later rejected can't have earned someone shipping.)
// Rejected requests and exchanges are not refunds. If an order has two
// lines with the same id, only the first is used (as returns do).

import type { ReturnRefund, ReturnRequest } from "./storeTypes";

export interface RefundOrder {
  id: string;
  lines: { lineId: string; productName: string; price: number; quantity: number }[];
  subtotal: number;
  discount?: number;
  shipping: number;
}

type RefundRequest = Pick<ReturnRequest, "id" | "type" | "status" | "createdAt" | "items"> & {
  /** Saved when the request was marked refunded. */
  refundSnapshot?: ReturnRefund;
};

const toPaise = (rupees: unknown) => Math.round((Number(rupees) || 0) * 100);
const toRupees = (paise: number) => paise / 100;

/** Paise actually paid for each line id (first line per id). */
export function linePaidPaise(order: RefundOrder): Map<string, number> {
  const totals = order.lines.map((line) => toPaise(line.price) * Math.max(0, Math.floor(line.quantity)));
  const sum = totals.reduce((a, b) => a + b, 0);
  const discount = Math.min(Math.max(0, toPaise(order.discount)), sum);

  const shares = totals.map(() => 0);
  if (sum > 0 && discount > 0) {
    const exact = totals.map((total) => (total * discount) / sum);
    exact.forEach((value, index) => (shares[index] = Math.floor(value)));
    let left = discount - shares.reduce((a, b) => a + b, 0);
    const byRemainder = exact
      .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (const { index } of byRemainder) {
      if (left <= 0) break;
      shares[index] += 1;
      left -= 1;
    }
  }

  const paid = new Map<string, number>();
  order.lines.forEach((line, index) => {
    if (!paid.has(line.lineId)) paid.set(line.lineId, totals[index] - shares[index]);
  });
  return paid;
}

/** Refund for every refundable return request of one order, by request id. */
export function calculateOrderRefunds(
  order: RefundOrder,
  requests: RefundRequest[]
): Map<string, ReturnRefund> {
  const paid = linePaidPaise(order);
  const quantityOf = new Map<string, number>();
  for (const line of order.lines) {
    if (!quantityOf.has(line.lineId)) {
      quantityOf.set(line.lineId, Math.max(0, Math.floor(line.quantity)));
    }
  }
  const totalUnits = [...quantityOf.values()].reduce((a, b) => a + b, 0);
  const shippingPaise = Math.max(0, toPaise(order.shipping));

  const unitsDone = new Map<string, number>();
  const paidDone = new Map<string, number>();
  let shippingRefunded = false;
  const result = new Map<string, ReturnRefund>();

  const refundable = requests
    .filter((request) => request.type === "return" && request.status !== "rejected")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  /** Item refunds for a request from what is still left (updates the running totals). */
  const refundItems = (request: RefundRequest) => {
    const items: ReturnRefund["items"] = [];
    let itemsPaise = 0;
    for (const item of request.items) {
      const lineQuantity = quantityOf.get(item.lineId) ?? 0;
      const linePaid = paid.get(item.lineId) ?? 0;
      const before = unitsDone.get(item.lineId) ?? 0;
      const quantity = Math.max(0, Math.min(Math.floor(item.quantity), lineQuantity - before));
      const remaining = Math.max(0, linePaid - (paidDone.get(item.lineId) ?? 0));

      let amount = 0;
      if (quantity > 0 && lineQuantity > 0) {
        amount =
          before + quantity === lineQuantity
            ? remaining
            : Math.min(remaining, Math.round((linePaid * quantity) / lineQuantity));
      }

      unitsDone.set(item.lineId, before + quantity);
      paidDone.set(item.lineId, (paidDone.get(item.lineId) ?? 0) + amount);
      itemsPaise += amount;
      items.push({ lineId: item.lineId, productName: item.productName, quantity, amount: toRupees(amount) });
    }
    return { items, itemsPaise };
  };

  // 1. Already refunded: exactly as saved (older ones without a saved
  //    breakdown are worked out, so they still come off what is left).
  const completed = refundable.filter((request) => request.status === "completed");
  for (const request of completed) {
    const snapshot = request.refundSnapshot;
    if (snapshot) {
      for (const item of snapshot.items) {
        unitsDone.set(item.lineId, (unitsDone.get(item.lineId) ?? 0) + item.quantity);
        paidDone.set(item.lineId, (paidDone.get(item.lineId) ?? 0) + toPaise(item.amount));
      }
      if (snapshot.shipping > 0) shippingRefunded = true;
      result.set(request.id, snapshot);
    } else {
      const { items, itemsPaise } = refundItems(request);
      result.set(request.id, { items, itemsTotal: toRupees(itemsPaise), shipping: 0, total: toRupees(itemsPaise) });
    }
  }

  // 2. Open requests, oldest first.
  const open = refundable.filter((request) => request.status !== "completed");
  const openItems = new Map<string, { items: ReturnRefund["items"]; itemsPaise: number }>();
  for (const request of open) openItems.set(request.id, refundItems(request));

  // 3. Shipping: the latest open request that completes the whole order
  //    together with the requests whose items are already back.
  let shippingTo: string | null = null;
  if (!shippingRefunded && shippingPaise > 0 && totalUnits > 0) {
    const back = refundable.filter((request) => request.status === "completed" || request.status === "received");
    for (const candidate of [...open].reverse()) {
      const covered = new Map<string, number>();
      for (const request of [...back.filter((b) => b.id !== candidate.id), candidate]) {
        for (const item of request.items) {
          covered.set(item.lineId, (covered.get(item.lineId) ?? 0) + Math.max(0, Math.floor(item.quantity)));
        }
      }
      const coveredUnits = [...quantityOf.entries()].reduce(
        (sum, [lineId, quantity]) => sum + Math.min(quantity, covered.get(lineId) ?? 0),
        0
      );
      if (coveredUnits >= totalUnits) {
        shippingTo = candidate.id;
        break;
      }
    }
  }

  for (const request of open) {
    const { items, itemsPaise } = openItems.get(request.id)!;
    const shipping = request.id === shippingTo ? shippingPaise : 0;
    result.set(request.id, {
      items,
      itemsTotal: toRupees(itemsPaise),
      shipping: toRupees(shipping),
      total: toRupees(itemsPaise + shipping),
    });
  }

  return result;
}
