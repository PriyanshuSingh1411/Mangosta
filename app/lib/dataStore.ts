import "server-only";

// The store's data layer, split by area in app/lib/store/:
//   core.ts       database handle, one-time JSON imports, transactions
//   products.ts   products            inventory.ts  stock changes
//   orders.ts     orders              checkout.ts   shipping + rewards
//   coupons.ts    coupons             settings.ts   site settings
// Everything is re-exported here, so imports from "@/app/lib/dataStore"
// keep working.

export { slugify } from "@/app/data/productTypes";
export {
  getProducts,
  getProduct,
  upsertProduct,
  updateProduct,
  deleteProduct,
  generateProductId,
} from "./store/products";
export type {
  ProductEditableFields,
  ProductStockUpdate,
  UpdateProductResult,
} from "./store/products";
export {
  InsufficientInventoryError,
  restockLines,
  takeStockForExchange,
} from "./store/inventory";
export type {
  UnavailableProduct,
} from "./store/inventory";
export {
  ORDER_STATUSES,
  getOrders,
  orderBelongsTo,
  getOrdersForCustomer,
  hasOrderSince,
  countOpenOrdersForCustomer,
  unlinkOrdersFromAccount,
  getCustomerOrder,
  getOrdersByIds,
  getOrderById,
  saveOrders,
  MAX_OPEN_UNPAID_ORDERS,
  UnpaidOrderLimitError,
  OrderInProgressError,
  runExclusive,
  accountLockId,
  AccountClosedError,
  placeOrder,
  OrderStatusError,
  cancelProcessingOrder,
  cancelReturnedOrder,
  updateOrderStatus,
} from "./store/orders";
export type {
  PaymentMethod,
  PaymentStatus,
  OrderLine,
  OrderStatus,
  OrderShipment,
  Order,
  OrderOwner,
  NewOrderInput,
  OrderShipmentInput,
} from "./store/orders";
export {
  DEFAULT_CHECKOUT_REWARDS,
  DEFAULT_CHECKOUT_SETTINGS,
  getCheckoutSettings,
  saveCheckoutSettings,
  calculateShipping,
  calculateCheckoutRewardDiscount,
} from "./store/checkout";
export type {
  ShippingRule,
  CheckoutReward,
  CheckoutSettings,
} from "./store/checkout";
export {
  validateCheckoutReward,
  DEFAULT_COUPON,
  getCoupons,
  saveCoupons,
  calculateCouponDiscount,
  getCouponCustomerHistory,
  couponCustomerProblem,
  CouponError,
  validateCoupon,
  CouponUnavailableError,
} from "./store/coupons";
export type {
  CouponDiscountType,
  Coupon,
  CouponValidationResult,
  CouponCustomer,
  CouponCustomerHistory,
} from "./store/coupons";
export {
  HERO_IMAGE_POSITIONS,
  normalizeHeroImagePosition,
  RAIL_MAX_ITEMS,
  DEFAULT_SETTINGS,
  normalizeRail,
  getSettings,
  saveSettings,
} from "./store/settings";
export type {
  HeroFontStyle,
  HeroTransition,
  HeroImagePosition,
  HeroSlide,
  HeroSettings,
  MangostaCodeStyle,
  MangostaCodeBox,
  DropProduct,
  DropSettings,
  MangostaStudio,
  RailItem,
  RailSettings,
  SiteSettings,
} from "./store/settings";
