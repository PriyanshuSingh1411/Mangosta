# Mangosta — Share + Smart Checkout Rewards Update

Base: latest Mangosta project with the three product accordions and dramatic logout modal.

## Added
- Product share button using native Web Share API with clipboard fallback.
- Saved address auto-fill on checkout for signed-in customers.
- Saved-address selector when multiple addresses exist.
- Checkout reward progress bar with three configurable milestones.
- Admin-controlled thresholds, discount percentages and generated reward coupon codes.
- Reward coupons are stored with checkout settings, separate from the normal Coupons admin section.
- Highest unlocked reward is automatically applied at checkout.
- Next-level messaging such as "₹500 away from 15% OFF".
- Server-side validation for reward coupons during checkout/order creation.

## Admin
Go to Admin → Checkout → Checkout Rewards.
Configure up to three levels (default: ₹1,000 / ₹1,500 / ₹2,000) and generate each reward code.

## Changed files
- app/lib/dataStore.ts
- app/api/admin/checkout/route.ts
- app/api/checkout/route.ts
- app/api/checkout/coupon/route.ts
- app/admin/(protected)/checkout/page.tsx
- app/checkout/page.tsx
- app/product/[slug]/ProductDetail.tsx
