// Lazily loads the Razorpay Checkout script exactly once and resolves to
// window.Razorpay. Loading it from Razorpay's own CDN (over https, with the
// official URL) is required — Razorpay does not allow self-hosting this file.
let loadingPromise = null;

export function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay script loaded but window.Razorpay is missing"));
    };
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script"));
    document.body.appendChild(script);
  });

  return loadingPromise;
}
