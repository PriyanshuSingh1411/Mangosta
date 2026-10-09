# Mangosta

Mangosta is a modern fashion/e-commerce storefront with a protected
admin panel for managing products, orders, customers, coupons, returns,
reviews, delivery rules, notifications, and user engagement.

The project is built with **Next.js 16, React 19, TypeScript, MongoDB,
Tailwind CSS, and Vercel**.

------------------------------------------------------------------------

## Features

### Storefront

-   Home page and editorial/about pages
-   Product catalogue and product detail pages
-   Shop filters for size, colour, price, and stock
-   Product sale pricing and discount badges
-   Product colour-specific photos
-   Size guide with cm/inches support
-   Cart / bag
-   Wishlist
-   Wishlist sharing
-   Checkout and payment flow
-   Coupon support
-   Delivery PIN-code availability and ETA checks
-   Order history and order detail pages
-   Order cancellation while an order is still processing
-   Shipping and tracking information
-   Buy Again for delivered orders
-   Returns and exchanges
-   Product reviews with photo uploads
-   Helpful votes on reviews
-   Mangosta replies to reviews
-   Product questions
-   Back-in-stock alerts
-   Newsletter signup (confirmed by email link)
-   Customer support
-   WhatsApp order support
-   Customer account/profile and saved addresses
-   Customer size profile
-   Notifications
-   Abandoned-bag reminder emails (only with marketing consent)
-   Account deletion (with an emailed confirmation code)
-   Privacy Policy, Terms & Conditions and FAQ pages

### Admin Panel

The admin panel is protected by a signed session cookie and a shared
admin password.

Available sections include:

-   Dashboard
-   Products
-   Product creation/editing
-   Bulk product import
-   Orders
-   Checkout configuration
-   Coupons
-   Delivery rules
-   Email configuration
-   Reminders
-   Returns
-   Reviews
-   Product questions
-   Size guide
-   Support
-   Store settings (including Business & legal details for the policy pages)
-   User engagement
    -   Customer Profiles
    -   Customer Segments
    -   Feature Usage
    -   LTV
    -   Product Discovery
    -   Retention
    -   Search

The admin dashboard also provides revenue charts, best sellers,
low-stock information, open returns, and order CSV export.

------------------------------------------------------------------------

## Tech Stack

  Technology                     Purpose
  ------------------------------ ------------------------------------
  Next.js 16.3.8                 Full-stack React framework
  React 19.2.8                   UI
  TypeScript                     Application language
  Tailwind CSS 4                 Styling
  MongoDB                        Application data and sessions
  MongoDB Node Driver            Database access
  Cloudinary                     Product/review image uploads
  Nodemailer                     Email / OTP / transactional emails
  Zustand                        Client-side cart/state management
  Framer Motion                  UI animation
  GSAP                           Advanced animations
  Lenis                          Smooth scrolling
  Vercel                         Deployment

------------------------------------------------------------------------

## Project Structure

``` text
Mangosta/
├── app/
│   ├── about/
│   ├── account/
│   ├── admin/
│   │   ├── login/
│   │   └── (protected)/
│   │       ├── checkout/
│   │       ├── coupons/
│   │       ├── delivery/
│   │       ├── email/
│   │       ├── orders/
│   │       ├── products/
│   │       ├── questions/
│   │       ├── reminders/
│   │       ├── returns/
│   │       ├── reviews/
│   │       ├── settings/
│   │       ├── size-guide/
│   │       ├── support/
│   │       └── user-engagement/
│   ├── api/
│   │   ├── account/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── cron/
│   │   ├── delivery/
│   │   ├── engagement/
│   │   ├── newsletter/
│   │   ├── notifications/
│   │   ├── orders/
│   │   ├── products/
│   │   ├── returns/
│   │   ├── reviews/
│   │   ├── settings/
│   │   ├── size-guide/
│   │   ├── stock-alerts/
│   │   └── support/
│   ├── bag/
│   ├── checkout/
│   ├── components/
│   │   └── legal/          (shared layout for Privacy, Terms, FAQ)
│   ├── data/               (types + pure helpers shared by browser and server)
│   ├── faq/
│   ├── lib/
│   │   └── store/          (data layer by area: products, inventory, orders,
│   │                        checkout, coupons, settings; re-exported by
│   │                        lib/dataStore.ts)
│   ├── newsletter/         (confirm / old "join again" links)
│   ├── notifications/
│   ├── notify/             (back-in-stock alert confirm link)
│   ├── orders/
│   ├── privacy/
│   ├── product/
│   ├── shop/
│   ├── support/
│   ├── terms/
│   ├── unsubscribe/
│   └── wishlist/
├── data/
│   ├── checkout.json
│   ├── coupons.json
│   ├── orders.json
│   ├── products.json
│   └── settings.json
├── public/
├── .gitignore
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tsconfig.json
└── vercel.json
```

------------------------------------------------------------------------

## Authentication

### Customer authentication

Customers authenticate using an OTP flow.

Customer sessions are stored in MongoDB and use the `mangosta_session`
HTTP-only cookie.

The current session lifetime is 30 days.

### Admin authentication

The admin panel uses a simple single-operator authentication model:

1.  Admin opens `/admin/login`
2.  Admin enters the password configured in `ADMIN_PASSWORD`
3.  A signed HTTP-only admin session cookie is created
4.  The session expires after 12 hours

The admin session uses:

``` text
mangosta_admin_session
```

For production, always set a strong `ADMIN_SESSION_SECRET` and
`ADMIN_PASSWORD`.

------------------------------------------------------------------------

## Database

Mangosta uses MongoDB with the database name:

``` text
mangosta
```

The application creates/uses collections for features such as:

-   users
-   sessions
-   orders
-   products
-   coupons
-   wishlists
-   reviews
-   reviewVotes
-   returnRequests
-   stockAlerts
-   carts
-   jobRuns
-   storeConfig
-   and other feature-specific data

MongoDB transactions are used for critical checkout operations when the
MongoDB deployment supports transactions.

### Checkout inventory protection

The checkout flow protects stock from concurrent purchases.

The order placement flow handles:

1.  Stock reservation
2.  Coupon validation/redemption
3.  Order creation
4.  Transaction commit

If a critical operation fails, the transaction is rolled back.

For local standalone MongoDB deployments without transaction support,
the application has a compensating rollback path.

------------------------------------------------------------------------

## Environment Variables

Create a `.env.local` file in the project root.

Example:

``` env
MONGODB_URI="mongodb+srv://USERNAME:PASSWORD@CLUSTER/mangosta"

OTP_SECRET="replace-with-a-long-random-secret"

ADMIN_PASSWORD="replace-with-a-strong-admin-password"
ADMIN_SESSION_SECRET="replace-with-a-long-random-session-secret"

SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASSWORD="your-smtp-password"
SMTP_SECURE="false"

CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

NEXT_PUBLIC_SITE_URL="https://your-production-domain.com"

CRON_SECRET="replace-with-a-long-random-cron-secret"
```

### Environment variable reference

  Variable                  Required for    Description
  ------------------------- --------------- ---------------------------------------
  `MONGODB_URI`             Database        MongoDB connection string
  `OTP_SECRET`              Customer auth   Secret used for OTP/session hashing
  `ADMIN_PASSWORD`          Admin           Admin login password
  `ADMIN_SESSION_SECRET`    Admin           Secret used to sign admin sessions
  `SMTP_HOST`               Email           SMTP server hostname
  `SMTP_PORT`               Email           SMTP server port
  `SMTP_USER`               Email           SMTP account
  `SMTP_PASSWORD`           Email           SMTP password
  `SMTP_SECURE`             Email           SMTP TLS/secure setting
  `CLOUDINARY_CLOUD_NAME`   Uploads         Cloudinary cloud name
  `CLOUDINARY_API_KEY`      Uploads         Cloudinary API key
  `CLOUDINARY_API_SECRET`   Uploads         Cloudinary API secret
  `NEXT_PUBLIC_SITE_URL`    Emails/links    Public website URL
  `CRON_SECRET`             Cron            Secret used to protect scheduled jobs

Do not commit `.env.local` or production secrets to GitHub.

------------------------------------------------------------------------

## Getting Started

### 1. Clone the repository

``` bash
git clone <your-github-repository-url>
cd Mangosta
```

### 2. Install dependencies

``` bash
npm install
```

### 3. Configure environment variables

Create:

``` text
.env.local
```

and add the required variables described above.

### 4. Start the development server

``` bash
npm run dev
```

Open:

``` text
http://localhost:3000
```

Admin login:

``` text
http://localhost:3000/admin/login
```

### 5. Production build

``` bash
npm run build
```

### 6. Start production server

``` bash
npm start
```

### 7. Lint

``` bash
npm run lint
```

------------------------------------------------------------------------

## Main Storefront Routes

``` text
/
 /about
 /shop
 /product/[slug]

 /bag
 /checkout
 /checkout/payment

 /account
 /account/reviews

 /orders
 /orders/[id]

 /wishlist
 /wishlist/share/[token]

 /notifications
 /support
 /contact
 /faq
 /privacy
 /terms

 /newsletter/confirm
 /notify/confirm
 /unsubscribe
```

------------------------------------------------------------------------

## Main Admin Routes

``` text
/admin/login

/admin
/admin/orders
/admin/products
/admin/products/new
/admin/products/[id]
/admin/products/import

/admin/coupons
/admin/checkout
/admin/delivery
/admin/email
/admin/reminders
/admin/returns
/admin/reviews
/admin/questions
/admin/settings
/admin/size-guide
/admin/support

/admin/user-engagement
/admin/user-engagement/customer-profiles
/admin/user-engagement/customer-segments
/admin/user-engagement/feature-usage
/admin/user-engagement/ltv
/admin/user-engagement/product-discovery
/admin/user-engagement/retention
/admin/user-engagement/search
```

------------------------------------------------------------------------

## API

The application currently contains API routes for:

-   Customer account/profile
-   Addresses
-   Size profiles
-   Authentication and OTP
-   Sessions/logout
-   Products
-   Cart
-   Checkout
-   Coupons
-   Orders
-   Order cancellation
-   Returns
-   Reviews
-   Review helpful votes
-   Review uploads
-   Product questions
-   Newsletter
-   Notifications
-   Delivery/PIN checks
-   Stock alerts
-   Support tickets
-   Admin products
-   Admin orders
-   Admin coupons
-   Admin reviews
-   Admin returns
-   Admin settings
-   Admin uploads
-   Admin user engagement
-   Abandoned-bag cron jobs

API routes are implemented inside:

``` text
app/api/
```

------------------------------------------------------------------------

## Product Pricing

Mangosta uses a consistent pricing model.

### Customer sale price

When a product has a discount:

``` text
sale price = price × (1 - discountPercent / 100)
```

### Compare-at price

`compareAtPrice` is used for the visual strikethrough price.

It does not independently change the amount the customer pays.

The application validates product pricing when products are created or
edited.

------------------------------------------------------------------------

## Inventory

Products can optionally track stock per:

-   Size
-   Colour

The admin can enable:

``` text
Track stock for each size & colour
```

The storefront:

-   Never shows more than 10 in stock (exact stock stays private) and
    allows up to 10 of each size per order
-   Prevents purchasing unavailable variants
-   Displays sold-out sizes
-   Displays low-stock information
-   Prevents the cart from exceeding available stock
-   Reserves inventory during checkout

------------------------------------------------------------------------

## Orders

The order lifecycle supports:

``` text
Processing
    ↓
Shipped
    ↓
Delivered
```

Orders only move forward. A processing order can be cancelled (stock
and coupon are given back); a shipped order that comes back undelivered
can be cancelled as "Cancelled (RTO)". Returns and exchanges of
delivered orders are handled in Admin → Returns.

Shipping information can include:

-   Courier
-   AWB
-   Tracking URL

Customers can view shipment information from their order page.

------------------------------------------------------------------------

## Returns & Exchanges

Customers can request a return/exchange within the configured return
window.

Admins can:

1.  Approve the request
2.  Mark items as received
3.  Optionally add returned stock back
4.  Mark the order refunded
5.  Mark an exchange as sent

Return policy settings are configurable from the admin panel.

Each return shows its refund amount: what the customer actually paid for
the items (price minus their share of the order's coupon or reward
discount). Shipping is refunded once, only when the whole order comes
back. A completed refund is saved and never changes afterwards.

------------------------------------------------------------------------

## Reviews

Customers can review products after eligible delivered orders.

Supported review features:

-   Star rating
-   Review text
-   Up to 3 photos
-   Sort by newest
-   Sort by most helpful
-   Sort by highest rating
-   Sort by lowest rating
-   Photo-only filtering
-   Helpful votes
-   Mangosta admin replies

Admins can hide, show, delete, reply to, and manage reviews.

------------------------------------------------------------------------

## Email System

Nodemailer is used for email delivery.

The application supports emails for:

-   OTP/login
-   Order confirmation
-   Order cancellation
-   Shipment
-   Tracking updates
-   Delivery
-   Review reminders
-   Back-in-stock alerts
-   Abandoned bags
-   Newsletter-related flows

Make sure SMTP credentials are configured before testing email features.

------------------------------------------------------------------------

## Abandoned Bag Cron

Vercel is configured to run:

``` text
/api/cron/abandoned-bags
```

The current schedule is:

``` text
30 4 * * *
```

This runs daily at **04:30 UTC**, which is **10:00 AM IST**.

The cron job requires:

``` env
CRON_SECRET=...
```

The job is responsible for processing abandoned-bag reminders.

------------------------------------------------------------------------

## Vercel Deployment

The project is compatible with Vercel.

### Recommended deployment flow

1.  Push the repository to GitHub
2.  Import the repository into Vercel
3.  Add all production environment variables
4.  Deploy
5.  Verify MongoDB connectivity
6.  Test customer authentication
7.  Test admin authentication
8.  Test checkout
9.  Test email delivery
10. Test the abandoned-bag cron

The repository contains:

``` text
vercel.json
```

with the scheduled cron configuration.

------------------------------------------------------------------------

## Cloudinary

Cloudinary is used for image uploads.

Configure:

``` env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

The Next.js image configuration allows images hosted on:

``` text
res.cloudinary.com
```

------------------------------------------------------------------------

## Important Security Notes

Before production deployment:

-   Set a strong `ADMIN_PASSWORD`
-   Set a long random `ADMIN_SESSION_SECRET`
-   Set a long random `OTP_SECRET`
-   Set a strong `CRON_SECRET`
-   Never commit `.env.local`
-   Never expose `CLOUDINARY_API_SECRET`
-   Never expose SMTP passwords
-   Use a production MongoDB deployment with appropriate access controls
-   Restrict MongoDB network access where possible
-   Review admin access before sharing the production URL
-   Use HTTPS in production

The admin authentication is intentionally a simple single-admin model,
not a multi-user RBAC system.

------------------------------------------------------------------------

## Security & Reliability

-   Orders, stock and coupons are saved in one all-or-nothing step
-   Up to 5 unpaid orders per account; coupons are limited per customer
-   Rate limits on sign-in codes, newsletter, back-in-stock alerts,
    analytics and review photo uploads (15 per customer per day)
-   Admin login is locked after repeated wrong passwords, and admins can
    end all admin sessions
-   Sign-in replies never reveal whether an email has an account
-   Newsletter and guest back-in-stock alerts need an email confirmation
-   Marketing emails only with consent, with an unsubscribe link in each
-   Public product data hides exact stock; public settings expose only
    what the storefront needs
-   Review photos must come from this store's Cloudinary folder
-   Error messages never show internal details to visitors

------------------------------------------------------------------------

## Legal Pages

`/privacy`, `/terms` and `/faq` use the live store settings (return
window, delivery days, free-shipping threshold). Fill in **Admin →
Settings → Business & legal** (legal name, address, customer-care phone,
grievance officer, city for disputes) so they appear on these pages.

------------------------------------------------------------------------

## Useful Commands

``` bash
# Install dependencies
npm install

# Development
npm run dev

# Lint
npm run lint

# Production build
npm run build

# Start production server
npm start
```

------------------------------------------------------------------------

## Troubleshooting

### MongoDB connection error

Check:

``` env
MONGODB_URI
```

Make sure the MongoDB server/Atlas cluster is reachable from the
environment where Next.js is running.

### OTP not being sent

Check:

``` env
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
OTP_SECRET
```

Also verify that the SMTP provider allows the configured connection.

### Admin login not working

Check:

``` env
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
```

Then restart the development server after changing environment
variables.

### Images not loading

Check:

``` env
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Also verify that the image is hosted on an allowed Cloudinary domain.

### Cron not running

Verify:

-   The project is deployed on Vercel
-   `vercel.json` is present
-   `CRON_SECRET` is configured
-   The cron route is deployed successfully

------------------------------------------------------------------------

## Status

Mangosta is an actively developed e-commerce application with both
customer-facing storefront functionality and a full operational admin
panel.

This document is the project's main README.
