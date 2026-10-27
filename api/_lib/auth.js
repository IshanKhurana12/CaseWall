// Verifies the Firebase ID token the browser sends as
// "Authorization: Bearer <token>" after Google sign-in. Server-side only.
//
// Deliberately NOT firebase-admin/auth: it pulls in jwks-rsa, which require()s
// the ESM-only `jose` package, and Vercel's function loader crashes on that
// (ERR_REQUIRE_ESM) — taking down create-order. This follows Firebase's
// documented manual check instead: RS256 signature against Google's public
// keys, audience = project id, issuer = securetoken.google.com/<project id>,
// not expired, non-empty subject.
import { createRemoteJWKSet, jwtVerify } from "jose";

const GOOGLE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

function projectId() {
  const id = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (id) return id;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id;
  throw new Error("FIREBASE_PROJECT_ID is not set");
}

export class InvalidTokenError extends Error {}

// Returns { uid, email, emailVerified, name } for a valid token, null when no
// token was sent (guest). Throws InvalidTokenError for a bad/expired token;
// anything else (e.g. Google's key endpoint unreachable) propagates normally.
export async function getUserFromRequest(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  if (!match) return null;
  const pid = projectId();
  let decoded;
  try {
    ({ payload: decoded } = await jwtVerify(match[1], GOOGLE_KEYS, {
      algorithms: ["RS256"],
      audience: pid,
      issuer: `https://securetoken.google.com/${pid}`,
      clockTolerance: 5,
    }));
  } catch (err) {
    // jose's verification failures all carry ERR_J* / ERR_JW* codes.
    if (/^ERR_J/.test(String(err?.code || ""))) throw new InvalidTokenError(err.code);
    throw err;
  }
  if (typeof decoded.sub !== "string" || !decoded.sub || decoded.sub.length > 128) {
    throw new InvalidTokenError("invalid-subject");
  }
  if (typeof decoded.auth_time === "number" && decoded.auth_time > Date.now() / 1000 + 5) {
    throw new InvalidTokenError("auth-time-in-future");
  }
  decoded = { ...decoded, uid: decoded.sub };
  return {
    uid: decoded.uid,
    email: decoded.email ? String(decoded.email).toLowerCase() : null,
    emailVerified: decoded.email_verified === true,
    name: decoded.name || null,
  };
}

// Same validation rules as checkout; returns a cleaned address or throws.
export function cleanAddress(raw = {}) {
  const s = (v, max) => String(v ?? "").trim().slice(0, max);
  const address = {
    label: s(raw.label, 30) || "Home",
    name: s(raw.name, 120),
    phone: s(raw.phone, 10),
    line1: s(raw.line1, 300),
    line2: s(raw.line2, 300),
    city: s(raw.city, 100),
    state: s(raw.state, 100),
    pincode: s(raw.pincode, 6),
  };
  if (!address.name) throw new Error("Please enter the recipient's name.");
  if (!/^\d{10}$/.test(address.phone)) throw new Error("Please enter a valid 10-digit phone number.");
  if (!address.line1 || !address.city || !address.state) throw new Error("Please complete the address.");
  if (!/^\d{6}$/.test(address.pincode)) throw new Error("Please enter a valid 6-digit pincode.");
  return address;
}

export const MAX_ADDRESSES = 10;

// Adds an address unless an identical one (same line1 + pincode + phone)
// already exists. The first address saved becomes the default.
export async function upsertAddress(db, uid, address, { makeDefault = false } = {}) {
  const col = db.collection("users").doc(uid).collection("addresses");
  const existing = await col.get();
  const key = (a) => `${a.line1.toLowerCase()}|${a.pincode}|${a.phone}`;
  const dupe = existing.docs.find((d) => key(d.data()) === key(address));
  if (dupe) return dupe.id;
  if (existing.size >= MAX_ADDRESSES) throw new Error(`You can save up to ${MAX_ADDRESSES} addresses.`);
  const now = new Date().toISOString();
  const ref = col.doc();
  const isDefault = makeDefault || existing.empty;
  const batch = db.batch();
  if (isDefault) existing.docs.forEach((d) => d.data().isDefault && batch.update(d.ref, { isDefault: false }));
  batch.set(ref, { ...address, isDefault, createdAt: now, updatedAt: now });
  await batch.commit();
  return ref.id;
}
