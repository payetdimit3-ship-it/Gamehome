# LIFEISGAMETZ V14 Update Notes

## What was improved
- Applied a new visual polish layer (`lifegametz-modern.css`) across the HTML pages.
- Preserved the existing ZonePlay/LIFEISGAMETZ sidebar, topbar and responsive shell.
- Added the supplied New Folde screenshots under `design-reference/` as reference material.
- Upgraded Admin product management with product image upload, SKU, stock, Featured and Published fields.
- Added protected image upload endpoint: `POST /api/admin/upload-image`.
- Added an admin-only full product endpoint: `GET /api/admin/products`.
- Public `GET /api/products` now hides account username/password fields and unpublished products.
- Checkout now calculates prices server-side from product IDs and quantities.
- Added `POST /api/checkout/quote` for authoritative checkout totals.
- Coupon checking no longer consumes a coupon use; usage is consumed only after confirmed payment/order approval.
- Added payment request rate limiting.
- Improved ClickPesa payment order references and server-side validation.
- Improved ClickPesa webhook handling with idempotency, currency validation and amount validation.
- Added `GET /api/admin/payment-status` for safe gateway configuration checks.
- Manual payments now use server-calculated totals too.
- Added `.env.example` documenting the current AI and ClickPesa variable names.

## AI preservation
The existing AI provider implementation in `server.js` was intentionally not redesigned or replaced. The existing provider selection/fallback system remains in place.

## Payment note
The current source code uses ClickPesa for automatic USSD-Push payments. The checkout flow also keeps manual payment as a fallback. Configure the real ClickPesa credentials in Render before production use.

## Design reference note
The images in `design-reference/` are supplied UI screenshots. They are visual references only and are not inserted as page backgrounds.
