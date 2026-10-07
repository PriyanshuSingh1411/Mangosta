# Mangosta — new features (Oct 2026)

Everything below is managed from the admin panel. No new npm packages were added.

## What was added

| # | Feature | Customer side | Admin side |
|---|---------|---------------|------------|
| 1 | Stock per size & colour | Sold-out sizes are crossed out; "Only N left" note; the bag can't go over the stock | Products → edit → tick **Track stock for each size & colour** → fill the grid. Total stock is added up automatically |
| 4 | Shipping & tracking | Your Orders shows a timeline (Placed → Shipped → Delivered), the courier, the AWB and a **TRACK PACKAGE** link | Orders → open an order → **Shipped** → enter courier, AWB and tracking link → **MARK AS SHIPPED**, then **Delivered** |
| 5 | Returns & exchanges | Your Orders → order → **REQUEST RETURN / EXCHANGE** (within 7 days of delivery) | **Returns**: Approve → Mark items received (optionally adds stock back) → Mark refunded / exchange sent. Set the policy (days, reasons, text) at the bottom of the page |
| 6 | Size guide | **Size guide** link on product pages and in the rail view; cm / inches switch | **Size Guide**: one chart per category |
| 7 | Shop filters | Shop → **FILTERS**: size (in stock), colour, price range, in stock only | — |
| 8 | Wishlist | Heart on cards, product page and rail view; **WISHLIST** page in the menu (sign-in needed) | — |
| 9 | Back-in-stock alerts | Picking a sold-out size shows **Notify me** (email) | Customers are emailed automatically when you add stock for that size. Toggle and subject are in **Reminders** |
| 10 | Colour photos | Picking a colour changes the photos | Products → edit → the **+ (colour) photos** box under each colour (1st photo = front, 2nd = back) |
| 11 | PIN code check | Product page: delivery estimate and COD availability; checkout blocks PINs you don't deliver to; COD is hidden where it isn't allowed | **Delivery**: default days, rules by PIN prefix (e.g. `400` Mumbai 1–2 days, COD yes/no), and a test box |
| 12 | Reviews | Stars on cards and product pages; customers with a delivered order can review (with up to 3 photos) | **Reviews**: hide / show again / delete |
| 13 | Dashboard | — | **Dashboard**: revenue chart (7 / 30 / 90 days), best sellers, low stock by size, open returns, CSV export of orders |
| 14 | Abandoned-bag email | Signed-in customers who leave items in their bag get one reminder email after 24 h | **Reminders**: email text, delay, **SEND REMINDERS NOW** |
| 15 | Complete the look | "Complete the look" row on product pages (in-stock items only) | Products → edit → **COMPLETE THE LOOK**: pick items. If none are picked, matching items are suggested automatically |

## Orders & reviews update

| Feature | Customer side | Admin side |
|---------|---------------|------------|
| Order emails | Emails for: order confirmed, shipped (with tracking button), tracking updated, delivered (with **REVIEW YOUR ITEMS** button and the exchange window) and cancelled | Every new order and every customer cancellation is emailed to your SMTP address (`SMTP_USER`). Changing an order's status in **Orders** sends the matching email to the customer |
| Cancel order | Order page → **Cancel order** while it's still Processing (reason optional). Stock and the coupon use go back automatically | Shows "Cancelled by the customer · reason". A cancelled order whose stock went back can't be reopened. Cancelling a Processing order from admin also puts the stock back |
| Buy again | **BUY AGAIN** on delivered orders adds the same items to the bag. Sold-out items are skipped with a note | — |
| Review your items | Orders list shows **★ REVIEW YOUR ITEMS** on delivered orders not reviewed yet; the order page has a **Review your items** section | — |
| Better reviews | Sort by newest, most helpful, highest, lowest, with photos. **Helpful?** button (signed-in customers, one vote each, tap again to undo). Mangosta's reply shows under the review | **Reviews** → **Reply as Mangosta**, edit or remove; helpful counts shown |
| WhatsApp help | Order page → **CHAT ON WHATSAPP** (+91 96650 76567) with the order number already typed | Change the number in `app/data/storeTypes.ts` (`SUPPORT_WHATSAPP_NUMBER`) |

## Set these on Vercel (Project → Settings → Environment Variables)

| Variable | Needed for | Notes |
|----------|-----------|-------|
| `CRON_SECRET` | Daily abandoned-bag emails | Any long random text. Vercel sends it to the cron route automatically |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (`SMTP_SECURE` optional) | All emails (OTP, back-in-stock, reminders) | Probably set already for the login OTP |
| `NEXT_PUBLIC_SITE_URL` | Links inside emails | e.g. `https://mangosta.vercel.app`. If missing, the Vercel production URL is used |
| `MONGODB_URI`, `OTP_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `CLOUDINARY_*` | Existing features | Unchanged |

`vercel.json` runs `/api/cron/abandoned-bags` once a day at 04:30 UTC (10:00 AM IST). This works on the free Hobby plan. Redeploy after adding `CRON_SECRET`.

## Existing data

- Products keep working as before. Per-size stock is optional and switched on per product.
- Old orders marked "fulfilled" now show as **Delivered**.
- New MongoDB collections are created automatically: `wishlists`, `reviews`, `reviewVotes`, `returnRequests`, `stockAlerts`, `carts`, `jobRuns`, `storeConfig`.
- Stock is reduced safely at checkout, per size and colour, so two people can't buy the last piece.
