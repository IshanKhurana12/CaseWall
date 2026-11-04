// Lazily loads the Cashfree JS SDK exactly once and resolves to
// window.Cashfree. It must be loaded from Cashfree's own CDN — they don't
// allow self-hosting this file.
let loadingPromise = null;

export function loadCashfreeScript() {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) resolve(window.Cashfree);
      else reject(new Error("Cashfree script loaded but window.Cashfree is missing"));
    };
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error("Failed to load Cashfree checkout script"));
    };
    document.body.appendChild(script);
  });

  return loadingPromise;
}
