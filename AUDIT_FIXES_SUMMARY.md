# Mangosta Audit Fixes - Summary of Changes

**Latest Revision:** October 2, 2026 - Final Audit Corrections  
**Status:** All 15 Points Addressed ✅

---

## Issues Fixed in This Revision

### Issue #1: SearchOverlay Price Display ✅
**Fixed:** SearchOverlay now uses `getProductSalePrice()` instead of `product.price`
- Shows strikethrough price + sale price
- Displays discount badges  
- Mobile-responsive layout
- File: `app/components/SearchOverlay.tsx`

### Issue #2: Historical Order Pricing Snapshot ✅
**Fixed:** Orders now capture complete discount information
- Added fields to `OrderLine` interface:
  - `originalPrice` - base price at time of order
  - `discountPercent` - discount % applied
  - `compareAtPrice` - compare-at price if available
- Checkout API saves all fields when creating orders
- Files: `app/lib/dataStore.ts`, `app/api/checkout/route.ts`

### Issue #3: Discount + compareAtPrice Finalized ✅
**Fixed:** The discount ALWAYS applies to `price`. `compareAtPrice` is display-only (strikethrough) and never changes what the customer pays.
```
Customer pays (getProductSalePrice):
  price × (1 − discountPercent / 100)      (just price if no discount)

Strikethrough shown (getProductStrikethroughPrice) — one rule, used by every page:
  discountPercent > 0 + compareAtPrice   → strike compareAtPrice
  discountPercent > 0, no compareAtPrice → strike price
  discountPercent = 0                    → no strikethrough, normal price only
                                           (compareAtPrice alone has no effect)
```
- Every strikethrough on the site (product card, product page, quick add, drop, trending, search, cart drawer, bag, checkout, payment, admin "Sale price preview") is shown only when `getProductStrikethroughPrice()` returns a value, and shows that value
- Updated `getProductStrikethroughPrice()`
- Updated `getProductSalePrice()`
- File: `app/data/productTypes.ts`

### Issue #4: Coupon + Product Discount Breakdown ✅
**Fixed:** Explicit separate line for product discounts
- Added `productDiscount` calculation in checkout
- Shows "Product Discounts" line separate from coupon
- Coupon discount shown with code + type
- Mobile-friendly layout
- File: `app/checkout/page.tsx`

### Issue #5: Inventory Concurrency Handling ✅
**Fixed:** Stock is reserved and the order is saved in ONE MongoDB transaction
- `placeOrder()` (in `app/lib/dataStore.ts`) is the only stock-decrease path
- Per product: conditional atomic update `{ id, inventory: { $gte: qty } }` + `{ $inc: { inventory: -qty } }`
- Any product short → whole transaction rolled back, no order, HTTP 409
- Order insert fails → whole transaction rolled back, stock restored
- `createOrder()` no longer touches inventory (old read-modify-`saveProducts()` code removed — it caused a double decrement)
- Standalone local `mongod` (no transactions) → same steps with compensating rollback
- Files: `app/lib/dataStore.ts`, `app/api/checkout/route.ts`

### Issue #6: Duplicate order IDs ✅
**Fixed:** IDs are `MG-<time base36>-<6 random hex>` (was `MG-<time>` only, which clashed for orders in the same millisecond)
- `placeOrder()` retries with a new ID if a clash ever happens (the failed attempt is already rolled back)
- File: `app/lib/dataStore.ts`

### Issue #8: Coupon usage inside the order transaction ✅
**Fixed:** Coupon use is recorded in the same MongoDB transaction as the stock reservation and the order
- `placeOrder()`: reserve stock → `redeemCoupon()` → save order → COMMIT (any failure → full rollback: no order, no stock taken, no coupon use)
- `redeemCoupon()` re-applies every coupon rule at commit time (enabled, dates, usage limit, minimum order), checks the discount still matches the priced order, then increments usage with a conditional atomic update (`usageCount < usageLimit`)
- Coupon no longer usable → HTTP 409, nothing changed. The old post-order `consumeCoupon()` (which kept the order even when the limit was exceeded) is removed
- Admin coupon saves no longer overwrite usage recorded while the page was open; only "Reset usage" sets it to 0
- **Security:** `/api/admin/coupons` GET/PUT were missing `await` on `isAuthenticated()`, so they never required login — fixed
- Files: `app/lib/dataStore.ts`, `app/api/checkout/route.ts`, `app/api/admin/coupons/route.ts`, `app/admin/(protected)/coupons/page.tsx`

### Issue #7: Admin product edit overwrote sales ✅
**Fixed:** `PUT /api/admin/products/[id]` uses `updateProduct()` (in-place `$set`, never `replaceOne`)
- Stock is written only if the admin changed it, and only if it still equals the value the form loaded (compare-and-set); otherwise 409 with the current stock
- `ProductForm` sends `inventoryOnLoad` and adopts the current stock after a 409
- Blank compare-at price removes it; products whose blank fields MongoDB stored as `null` can be edited again
- Files: `app/lib/dataStore.ts`, `app/api/admin/products/[id]/route.ts`, `app/admin/(protected)/products/ProductForm.tsx`, `app/lib/priceValidation.ts`

---

## Complete File Changes

| File | Changes |
|------|---------|
| `app/data/productTypes.ts` | Pricing helpers; single strikethrough rule (no strikethrough without a discount) |
| `app/checkout/payment/page.tsx` | Strikethrough uses `getProductStrikethroughPrice()` (was `product.price`) |
| `app/components/CartDrawer.tsx` | Strikethrough shown only when the helper returns a value |
| `app/components/ProductCard.tsx` | Uses strikethrough price helper, discount badges |
| `app/components/SearchOverlay.tsx` | **FIXED:** Now uses getProductSalePrice() |
| `app/checkout/page.tsx` | **FIXED:** Added explicit product discount breakdown; strikethrough via helper only; loads settings from `GET /api/checkout` (no subtotal sent) |
| `app/admin/(protected)/products/page.tsx` | Discount column with visual badges |
| `app/store/useCartStore.ts` | Inventory validation on add |
| `app/api/products/route.ts` | Cache headers + data validation |
| `app/api/checkout/route.ts` | **IMPROVED:** Saves discount snapshot fields; places orders via `placeOrder()` (409 on insufficient stock or unusable coupon); GET returns settings only |
| `app/lib/dataStore.ts` | **IMPROVED:** OrderLine interface; transactional `placeOrder()` (stock + coupon + order); inventory-free `createOrder()`; `saveProducts()` and `consumeCoupon()` removed; collision-proof order IDs; `updateProduct()`; `saveCoupons()` keeps usage |
| `app/lib/priceValidation.ts` | Admin product validation (`validateProductPricing`, `validateInventoryValue`); unused `validateOrderPrices()` removed |
| `app/api/admin/products/[id]/route.ts` | Edit never overwrites sales (compare-and-set stock); null-safe optional fields |
| `app/admin/(protected)/products/ProductForm.tsx` | Sends `inventoryOnLoad`; handles 409 stock change; sale preview uses the storefront price helpers |
| `app/api/admin/coupons/route.ts` | Login actually enforced (`await isAuthenticated()`); usage preserved unless reset |
| `app/admin/(protected)/coupons/page.tsx` | "Reset usage" sends `resetUsage: true` |

---

## 15-Point Audit Status

| # | Point | Status | Notes |
|---|-------|--------|-------|
| 1 | Price display audit | ✅ | SearchOverlay fixed + all components consistent |
| 2 | Cart data refresh | ✅ | syncProducts() called on checkout |
| 3 | Server-auth pricing | ✅ | Checkout recalculates all prices |
| 4 | Order pricing history | ✅ | Now captures discount snapshot |
| 5 | Inventory protection | ✅ | Transactional reserve + order; single decrement path |
| 6 | Price validation | ✅ | Admin create/edit reject invalid values with 400 (`validateProductPricing()`) |
| 7 | Discount + compareAtPrice | ✅ | Discount on price; compareAtPrice only shown (struck) when a discount is set |
| 8 | Admin discount preview | ✅ | ProductForm shows sale price |
| 9 | Admin discount column | ✅ | Added to product list with badges |
| 10 | Discount badges | ✅ | All components show badges |
| 11 | Coupon breakdown | ✅ | EXPLICIT product discount line |
| 12 | Search prices | ✅ | SearchOverlay uses sale prices |
| 13 | Sale-price sorting | ✅ | ShopGrid sorts by getProductSalePrice() |
| 14 | Cache consistency | ✅ | no-store headers on price endpoints |
| 15 | Mobile layout | ✅ | Responsive throughout |

---

## Testing Recommendations

**Critical Tests:**
- [ ] Add product with compareAtPrice > price and no discount (shows normal price only)
- [ ] Add product with discountPercent only
- [ ] Add product with both compareAtPrice and discountPercent
- [ ] Verify checkout shows both product + coupon discounts separately
- [ ] Search results show correct prices + discounts
- [ ] Admin product list shows discount badges
- [ ] Mobile: verify discount display wraps properly
- [ ] Check order history for discount fields

**Edge Cases:**
- [ ] Product with 0% discount (no badge)
- [ ] compareAtPrice < sale price (should reject)
- [ ] Cart sync on checkout page load
- [ ] Concurrent orders with same product
- [ ] Coupon with usage limit 1 used by two customers at once (only one order gets it)
- [ ] Edit a product / coupon in admin while orders are placed (stock and coupon usage not reset)

---

## Deployment Checklist

- [ ] Run tests (especially checkout + pricing)
- [ ] Clear client cache (localStorage: `mangosta-cart`)
- [ ] Verify search results on production
- [ ] Monitor admin orders for discount fields
- [ ] Confirm `MONGODB_URI` points to Atlas / a replica set (enables transactions; a standalone server logs an `[INVENTORY]` warning)
- [ ] A/B test on 10% traffic first

---

## Known Limitations

1. **Checkout Atomicity**: Resolved. Data is in MongoDB; `placeOrder()` reserves stock, records the coupon use and saves the order in one MongoDB transaction (Atlas / replica set). On a standalone local `mongod` it falls back to compensating rollback, which never oversells stock or coupons but is not crash-proof mid-order.

2. **Mobile Testing**: Responsive classes added but needs visual QA on actual devices

3. **Discount Validation**: Resolved. `validateProductPricing()` runs on admin product create and edit and rejects (HTTP 400) a compareAtPrice lower than the sale price, a discount outside 0–100, and a negative or non-integer stock.

---

## Summary

All 15 audit points are now addressed:
- ✅ SearchOverlay price consistency fixed
- ✅ Historical pricing snapshots captured
- ✅ Discount rules finalized with clear hierarchy
- ✅ Coupon + product discounts explicit in breakdown
- ✅ Inventory and coupon usage reserved atomically with the order (transaction, 409 on insufficient stock / unusable coupon)
- ✅ All components show consistent pricing
- ✅ Mobile layouts responsive
- ✅ Cache headers optimized
