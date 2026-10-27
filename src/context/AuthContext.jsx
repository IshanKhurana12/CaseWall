import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { app } from "../firebase";

// Firebase Auth is loaded on demand after the page is idle rather than in the
// main bundle. initializeAuth (not getAuth) is used without a popup resolver,
// so the hidden Google iframe + apis.google.com scripts only load when the
// customer actually clicks "Sign in" — not on every page view.
let authModulePromise;
let loadedAuth = null; // set once the module has arrived
function loadAuth() {
  if (!authModulePromise) {
    authModulePromise = import("firebase/auth").then((m) => {
      loadedAuth = {
        m,
        auth: m.initializeAuth(app, {
          persistence: [m.indexedDBLocalPersistence, m.browserLocalPersistence],
        }),
      };
      return loadedAuth;
    });
  }
  return authModulePromise;
}

const AuthContext = createContext(null);

function friendlyAuthError(err) {
  const code = err?.code || "";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(ua)) {
    return "Google sign-in doesn't work inside the Instagram/Facebook browser. Tap ⋯ (top right) → “Open in browser”, then sign in.";
  }
  if (code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow pop-ups for casewall.in and try again.";
  if (code === "auth/network-request-failed") return "Network error — check your connection and try again.";
  if (code === "auth/unauthorized-domain" || code === "auth/operation-not-allowed") {
    return "Google sign-in isn't available right now. You can still check out as a guest.";
  }
  return "Couldn't sign you in. Please try again.";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // true once the saved session has been checked

  useEffect(() => {
    let unsub = () => {};
    let cancelled = false;
    const start = () =>
      loadAuth()
        .then(({ m, auth }) => {
          if (cancelled) return;
          unsub = m.onAuthStateChanged(auth, (u) => {
            setUser(u);
            setReady(true);
          });
        })
        .catch((err) => {
          console.error("Auth failed to load:", err);
          setReady(true);
        });
    // Don't compete with the page's own loading.
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
    const handle = idle(start, { timeout: 2000 });
    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof handle === "number") window.cancelIdleCallback(handle);
      unsub();
    };
  }, []);

  // Resolves to the signed-in user, or throws an Error with a user-facing message.
  const signIn = useCallback(async () => {
    // Safari only allows a popup opened directly from the click, so skip the
    // await when the module is already loaded (the usual case).
    const { m, auth } = loadedAuth || (await loadAuth());
    const provider = new m.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const cred = await m.signInWithPopup(auth, provider, m.browserPopupRedirectResolver);
      return cred.user;
    } catch (err) {
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") return null;
      console.error("Sign-in failed:", err);
      throw new Error(friendlyAuthError(err));
    }
  }, []);

  const signOut = useCallback(async () => {
    const { m, auth } = await loadAuth();
    await m.signOut(auth);
  }, []);

  // fetch() wrapper for /api routes that adds the user's ID token.
  const authFetch = useCallback(
    async (url, options = {}) => {
      const headers = { ...(options.headers || {}) };
      if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
      if (options.body && typeof options.body !== "string") {
        headers["Content-Type"] = "application/json";
        options = { ...options, body: JSON.stringify(options.body) };
      }
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      return data;
    },
    [user]
  );

  const value = useMemo(() => ({ user, ready, signIn, signOut, authFetch }), [user, ready, signIn, signOut, authFetch]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
