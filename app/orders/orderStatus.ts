// Labels and colours for order statuses on the customer's order pages.

export const ORDER_STATUS_STYLE: Record<
  "pending" | "shipped" | "delivered" | "cancelled",
  { label: string; className: string }
> = {
  pending: { label: "PROCESSING", className: "text-blue-400" },
  shipped: { label: "SHIPPED", className: "text-mango" },
  delivered: { label: "DELIVERED", className: "text-orange-400" },
  cancelled: { label: "CANCELLED", className: "text-red-500" },
};
