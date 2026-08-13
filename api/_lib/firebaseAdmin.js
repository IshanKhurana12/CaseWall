// Server-side only. Uses a Firebase service account so these functions can
// write to Firestore even though the security rules block writes from the
// browser (see ../../firestore.rules). Never import this file from
// anything that ships to the client.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getServiceAccount() {
  // Preferred: a single JSON blob in FIREBASE_SERVICE_ACCOUNT (paste the
  // whole downloaded service-account key file as one env var value).
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  // Fallback: three separate env vars.
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel env vars can't contain literal newlines, so private keys are
      // stored with "\n" escape sequences and unescaped here.
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }
  throw new Error(
    "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY) in your server environment."
  );
}

let app;
export function getAdminApp() {
  if (!app) {
    const existing = getApps();
    app = existing.length ? existing[0] : initializeApp({ credential: cert(getServiceAccount()) });
  }
  return app;
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
