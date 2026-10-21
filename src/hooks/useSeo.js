import { useEffect } from "react";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_URL } from "../lib/seo";

function setMeta(selector, attr, key, value) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

// Keeps <head> in sync with the current route on client-side navigation.
// The prerendered HTML (scripts/prerender.mjs) already ships the same tags
// for crawlers that don't run JavaScript; this covers in-app navigation and
// Google's JS renderer. Page-level JSON-LD lives in a single tagged <script>
// that is replaced on every route change.
export default function useSeo({ title, description, path, image, noindex = false, jsonLd } = {}) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const t = title || DEFAULT_TITLE;
    const d = description || DEFAULT_DESCRIPTION;
    const url = `${SITE_URL}${path ?? window.location.pathname}`;

    document.title = t;
    setMeta('meta[name="description"]', "name", "description", d);
    setMeta('meta[name="robots"]', "name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large");
    setMeta('meta[property="og:title"]', "property", "og:title", t);
    setMeta('meta[property="og:description"]', "property", "og:description", d);
    setMeta('meta[property="og:url"]', "property", "og:url", url);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", t);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", d);
    if (image) {
      setMeta('meta[property="og:image"]', "property", "og:image", image);
      setMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
    }
    setCanonical(url);

    document.head.querySelectorAll("script[data-page-jsonld]").forEach((el) => el.remove());
    if (jsonLdKey) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.setAttribute("data-page-jsonld", "");
      s.textContent = jsonLdKey;
      document.head.appendChild(s);
    }
  }, [title, description, path, image, noindex, jsonLdKey]);
}
