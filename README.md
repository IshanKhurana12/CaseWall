# CASEWALL — Phone Cover Store

A simple storefront: you add products in the Firebase console, customers browse them here
and tap "Ask on WhatsApp" to message you directly about a cover. No cart, no checkout —
just a catalog that turns into a WhatsApp chat.

## 1. Set up Firebase

1. Go to https://console.firebase.google.com and create a project (or use an existing one).
2. Click the **Web** icon (`</>`) to register a web app, and copy the config it shows you.
3. In the left sidebar, go to **Build → Firestore Database → Create database**. Start in
   **test mode** for now (see the security rules note below before you go live).

## 2. Connect this app to your project

Copy `.env.example` to `.env` and fill in the values from step 1:

```
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

Then open `src/config.js` and set your WhatsApp number (digits only, country code first,
no `+`, no spaces):

```js
export const WHATSAPP_NUMBER = "919876543210";
```

## 3. Add products in Firestore

In the Firebase console, open **Firestore Database** and create a collection called
`products`. Add one document per phone cover. Each document uses these fields:

| Field         | Type    | Required | Notes                                            |
|---------------|---------|----------|---------------------------------------------------|
| `name`        | string  | yes      | e.g. "Marble Grip Case"                            |
| `price`       | number  | no       | e.g. 499 — shown formatted as ₹499                 |
| `currency`    | string  | no       | ISO code, defaults to INR if omitted               |
| `model`       | string  | no       | e.g. "iPhone 15" — used for the filter chips       |
| `description` | string  | no       | one short line                                     |
| `imageUrl`    | string  | no       | a public image URL (see below)                     |
| `inStock`     | boolean | no       | set to `false` to show "Sold out" and grey it out  |

**Getting an `imageUrl`:** the easiest options are Firebase Storage (upload the photo, then
copy its "download URL"), or any public image link (e.g. from Imgur or your phone's cloud
photos shared link). Paste that URL into the `imageUrl` field.

You don't need to touch any code to add, edit, or remove products — just edit documents in
the Firestore console and refresh the site.

## 4. Run it locally

```
npm install
npm run dev
```

## 5. Deploy it

Any static host works since this is a plain Vite build. Firebase Hosting is a natural fit
since you're already using Firebase:

```
npm install -g firebase-tools
firebase login
firebase init hosting     # choose "dist" as the public directory, configure as a single-page app: yes
npm run build
firebase deploy
```

Other options: Vercel or Netlify both deploy a Vite app with zero config — just point them
at this repo.

## 6. Lock down Firestore before going live

Test mode allows anyone to read *and write* your database, which is fine for setup but not
for production. Since only you add products (through the console, not the app), tighten the
rules to read-only from the app:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow write: if false; // only you, via the Firebase console, can write
    }
  }
}
```

Paste that into **Firestore Database → Rules** and publish.

## Project structure

```
src/
  firebase.js           Firebase app + Firestore init
  config.js              Your WhatsApp number and store name/tagline
  App.jsx / App.css       Page layout, filtering, search
  components/
    ProductGrid.jsx
    ProductCard.jsx       Product card + the WhatsApp deep link
```
