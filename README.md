# CASEWALL — Phone Cover Store

A full storefront: customers browse products, add them to a cart, and check out with
Razorpay. Paid orders are shipped via Delhivery, and the order-status page shows live,
server-verified payment status. Orders are non-refundable — only replacements for
damaged items, and only with an unboxing video (see the FAQ on the site for the exact
policy).

## How the checkout flow works (and why it's safe)

1. The cart (`localStorage`) only ever stores product ids and quantities for display —
   never the amount that gets charged.
2. `POST /api/create-order` re-reads each product's real price from Firestore, computes
   the total server-side, creates a Firestore `orders/{id}` doc (`status: "created"`),
   and creates a matching Razorpay order.
3. The browser opens Razorpay's checkout widget using the `key_id` (public) — the
   `key_secret` never leaves the server.
4. On success, `POST /api/verify-payment` recomputes the Razorpay HMAC signature with the
   secret key and only then marks the order `"paid"` in Firestore via the Firebase Admin
   SDK. A Razorpay **webhook** (`/api/razorpay-webhook`) does the same check
   independently, so payment confirmation doesn't rely on the browser staying open.
5. Once paid, the server books a Delhivery shipment and stores the AWB/tracking number
   on the order.
6. `/order/:orderId` listens to the Firestore order doc in real time (`onSnapshot`) and
   shows whatever the *server* has confirmed — the client can never write `"paid"`
   itself. `firestore.rules` denies all client writes to `orders` and `products`; every
   write in this app happens through the Admin SDK in `/api`, which bypasses rules
   entirely by design.

## 1. Set up Firebase

1. Go to https://console.firebase.google.com and create a project (or use an existing one).
2. Click the **Web** icon (`</>`) to register a web app, and copy the config it shows you.
3. In the left sidebar, go to **Build → Firestore Database → Create database**.
4. Go to **Project settings → Service accounts → Generate new private key** — you'll need
   this for the Admin SDK (server-side only, see step 4 below).

## 2. Connect this app to your project

Copy `.env.example` to `.env` and fill in the **client** values (the `VITE_...` ones):

```
cp .env.example .env
```

Then open `src/config.js` and set your WhatsApp number, and check the return-policy text.

## 3. Add products in Firestore

In the Firebase console, open **Firestore Database** and create a collection called
`products`. Add one document per phone cover. `price` must be a plain number (in rupees)
since it's used directly, server-side, to compute the Razorpay charge.

| Field         | Type    | Required | Notes                                            |
|---------------|---------|----------|---------------------------------------------------|
| `name`        | string  | yes      | e.g. "Marble Grip Case"                            |
| `price`       | number  | yes      | e.g. 499 — shown formatted as ₹499, and is the actual amount charged |
| `currency`    | string  | no       | ISO code, defaults to INR if omitted               |
| `model`       | string  | no       | e.g. "iPhone 15" — used for the filter chips       |
| `description` | string  | no       | one short line                                     |
| `imageUrl` / `imageUrls` | string / array | no | a public image URL, or an array for a gallery |
| `inStock`     | boolean | no       | set to `false` to show "Sold out" and grey it out  |

**Getting an image URL:** the easiest options are Firebase Storage (upload the photo, then
copy its "download URL"), or any public image link. Paste that URL into `imageUrl`
(or several into `imageUrls`).

You don't need to touch any code to add, edit, or remove products — just edit documents in
the Firestore console and refresh the site.

## 4. Configure server-side integrations (Razorpay, Delhivery, Firebase Admin)

These go in your **deployment platform's** environment variables (e.g. Vercel → Project →
Settings → Environment Variables) — never in `.env`/`VITE_...` vars, since those get
bundled into the browser. Full list and where to find each value is in `.env.example`:

- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Razorpay Dashboard → Settings → API Keys
- `RAZORPAY_WEBHOOK_SECRET` — create a webhook in Razorpay for the `payment.captured`
  event pointed at `https://yourdomain.com/api/razorpay-webhook`, then paste its secret
- `DELHIVERY_API_TOKEN`, `DELHIVERY_PICKUP_LOCATION` — from your Delhivery seller account
  (`DELHIVERY_PICKUP_LOCATION` is the pickup/warehouse name you registered with them)
- `FIREBASE_SERVICE_ACCOUNT` (or the three `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL`
  / `FIREBASE_PRIVATE_KEY` vars) — from the service account key you generated in step 1

Also set `VITE_RAZORPAY_KEY_ID` (same value as `RAZORPAY_KEY_ID` — it's not secret).

**Publish the Firestore rules** in `firestore.rules` (Firebase Console → Firestore
Database → Rules → paste and publish) — this is what stops anyone from writing directly
to `orders` or `products` from the browser. Everything in this repo writes through the
Admin SDK in `/api` instead, which bypasses rules by design.

## 5. Run it locally

```
npm install
npm run dev
```

The `/api` functions only run on Vercel (or via `vercel dev`) — plain `vite dev` serves
only the frontend, so checkout requires deploying to Vercel or running `vercel dev`
locally with the env vars from step 4 set.

## 6. Deploy it

This app depends on serverless functions (`/api`), so deploy it to **Vercel**:

```
npm install -g vercel
vercel
```

Set all the environment variables from step 4 in the Vercel dashboard before your first
real order. Point the Razorpay webhook at your live
`https://yourdomain.com/api/razorpay-webhook` URL once you have a domain.

## Project structure

```
src/
  firebase.js               Firebase client app + Firestore init
  config.js                 WhatsApp number, store name/tagline, return policy text
  App.jsx / App.css         Routes, layout, filtering, search
  context/
    CartContext.jsx         Cart state (localStorage-persisted)
  lib/
    loadRazorpay.js          Lazily loads the Razorpay checkout script
  components/
    ProductGrid.jsx / ProductCard.jsx   Catalog grid + card (Add to Cart / Buy Now / WhatsApp)
    ProductPage.jsx          Full product detail page (/product/:id)
    CartPage.jsx             Cart (/cart)
    CheckoutPage.jsx         Address form + Razorpay checkout (/checkout)
    OrderStatusPage.jsx      Live, read-only order status (/order/:orderId)
  FAQSection.jsx             Includes the refund/replacement policy Q&A

api/
  create-order.js            Creates Firestore order + Razorpay order (server-priced)
  verify-payment.js          Verifies Razorpay signature, marks order paid, books shipment
  razorpay-webhook.js        Server-to-server payment confirmation safety net
  delhivery-track.js         Server-side shipment tracking proxy
  _lib/
    firebaseAdmin.js         Firebase Admin SDK singleton (server only)
    razorpay.js               Razorpay Node SDK singleton (server only)
    delhivery.js              Delhivery shipment create/track helpers (server only)

firestore.rules              Denies all client writes to products/orders
.env.example                 Every required client + server environment variable
```
