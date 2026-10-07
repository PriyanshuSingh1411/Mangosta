# Mangosta — Product Q&A + Returns Policy Update

## Changes

- Removed Product Q&A from the bottom of the Reviews section.
- Added Product Q&A as a collapsible `QUESTIONS` accordion beside `DETAILS & CARE` on every product page.
- Added a collapsible `RETURNS & EXCHANGES` accordion beside `DETAILS & CARE` on every product page.
- Product pages now read the shared `returnsPolicy` store configuration, so one admin-managed policy is shown across all products.
- Existing Admin → Returns policy editor remains the source of truth for:
  - Enable/disable policy
  - Return window in days
  - Returns availability
  - Exchange availability
  - Customer-selectable return reasons
  - Policy text
- Added a storefront preview to the admin Return Policy editor.

## Files changed

- `app/product/[slug]/page.tsx`
- `app/product/[slug]/ProductDetail.tsx`
- `app/product/[slug]/ProductReviews.tsx`
- `app/product/[slug]/ProductQuestions.tsx`
- `app/admin/(protected)/returns/page.tsx`

## Admin workflow

Go to:

`/admin/returns`

Edit the Return Policy section and click **SAVE POLICY**. The saved policy is then displayed in the Returns & Exchanges accordion on every product page.
