import { initializeApp } from "firebase/app";
// Firestore Lite: one-shot reads only, a fraction of the full SDK's size.
// The order status page needs realtime updates and loads the full SDK itself.
import { getFirestore } from "firebase/firestore/lite";

// Paste your Firebase project config here (Firebase Console → Project settings → your web app).
// Better: put these in a .env file and read them via import.meta.env — see README.md.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
