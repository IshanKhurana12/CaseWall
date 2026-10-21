// Shared SEO helpers. Plain JS with no Vite/browser-only APIs, so the same
// code runs in the React app (useSeo) and in scripts/prerender.mjs at build
// time — titles, descriptions and structured data stay identical in both.

export const SITE_URL = "https://casewall.in";
export const BRAND = "CASEWALL";
export const INSTAGRAM_URL = "https://www.instagram.com/thecasewall";
export const SUPPORT_PHONE = "+91-9871335748";
export const WHATSAPP_URL = "https://wa.me/919871335748";

export const DEFAULT_TITLE = "Phone Cases & Covers Online in India | CASEWALL";
export const DEFAULT_DESCRIPTION =
  "Shop stylish mobile back covers and phone cases for iPhone and Samsung Galaxy at CASEWALL. Cash on delivery, free shipping over ₹500, dispatch in 24–48 hrs, delivered across India.";

// Normalizes casing/whitespace so "Iphone 15 Pro" and "iPhone 15 Pro"
// are treated as the same model everywhere (filters, URLs, structured data).
// Also expands Samsung shorthand ("S24 Ultra" -> "Samsung Galaxy S24 Ultra")
// because that's the phrase people actually search for.
const WORD_CASE = { pro: "Pro", plus: "Plus", max: "Max", ultra: "Ultra", air: "Air", mini: "mini", fe: "FE", "5g": "5G" };

export function canonicalModelName(raw) {
  if (!raw) return null;
  let name = String(raw).trim().replace(/\s+/g, " ");
  if (!name) return null;
  name = name.replace(/^iphone/i, "iPhone");
  name = name.replace(/^(?:samsung\s+)?(?:galaxy\s+)?([samz]\d)/i, (_, code) => `Samsung Galaxy ${code.toUpperCase()}`);
  return name.replace(/\b(pro|plus|max|ultra|air|mini|fe|5g)\b/gi, (w) => WORD_CASE[w.toLowerCase()]);
}

// A product's list of models: the denormalized `models` array for variant
// products, or the legacy single `model` field for old flat products.
export function modelsForProduct(p) {
  const raw =
    Array.isArray(p.models) && p.models.length > 0 ? p.models : p.model ? [p.model] : [];
  return [...new Set(raw.map(canonicalModelName).filter(Boolean))];
}

// "iPhone 15 Pro Max" -> "iphone-15-pro-max"
export function modelSlug(model) {
  return String(model || "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function modelPath(model) {
  return `/cases/${modelSlug(model)}`;
}

export function productImages(p) {
  if (Array.isArray(p.imageUrls) && p.imageUrls.length > 0) return p.imageUrls.filter(Boolean);
  return p.imageUrl ? [p.imageUrl] : [];
}

export function productPrice(p) {
  const n = Number(p.priceFrom ?? p.price);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function truncate(text, max) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

export function productTitle(p) {
  const models = modelsForProduct(p);
  const name = p.name || "Phone Cover";
  const saysCase = /\b(case|cover)s?\b/i.test(name);
  let kind = "";
  if (!p.isJewellery) {
    if (models.length === 1) kind = saysCase ? ` for ${models[0]}` : ` – ${models[0]} Case`;
    else if (!saysCase) kind = " Phone Case";
  }
  return `${name}${kind} | ${BRAND}`;
}

export function productDescription(p) {
  const models = modelsForProduct(p);
  const price = productPrice(p);
  const parts = [];
  if (p.description) parts.push(String(p.description).trim().replace(/\s+/g, " "));
  else if (p.isJewellery) parts.push(`${p.name} by ${BRAND}.`);
  else {
    const forModels =
      models.length === 0
        ? ""
        : models.length <= 3
        ? ` for ${models.join(", ")}`
        : ` for ${models.slice(0, 3).join(", ")} and ${models.length - 3} more models`;
    parts.push(`Buy the ${p.name} phone case${forModels} online.`);
  }
  if (price) parts.push(`₹${price}.`);
  parts.push("COD available, ships across India.");
  return truncate(parts.join(" "), 160);
}

export function modelTitle(model) {
  return `${model} Cases & Covers – Buy Online in India | ${BRAND}`;
}

export function modelDescription(model, count, minPrice) {
  const from = minPrice ? ` from ₹${minPrice}` : "";
  return truncate(
    `Shop ${count} ${model} back covers and cases${from} at ${BRAND}. Cash on delivery, free shipping over ₹500, dispatch in 24–48 hrs across India.`,
    160
  );
}

// ---------- JSON-LD builders ----------

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/favicon.svg`,
    description: DEFAULT_DESCRIPTION,
    areaServed: { "@type": "Country", name: "India" },
    sameAs: [INSTAGRAM_URL],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: SUPPORT_PHONE,
      areaServed: "IN",
      availableLanguage: ["English", "Hindi"],
    },
    hasMerchantReturnPolicy: merchantReturnPolicy(),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: BRAND,
    url: `${SITE_URL}/`,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en-IN",
  };
}

// Mirrors the policy on /returnPolicy: 2-day window, ₹100 processing fee.
function merchantReturnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "IN",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 2,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    merchantReturnLink: `${SITE_URL}/returnPolicy`,
  };
}

function shippingDetails(price) {
  return {
    "@type": "OfferShippingDetails",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
    shippingRate: {
      "@type": "MonetaryAmount",
      value: price !== null && price >= 500 ? 0 : 80,
      currency: "INR",
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 7, unitCode: "DAY" },
    },
  };
}

// `variants` is optional: pass the active variant docs to get an accurate
// price range and stock status; otherwise the product doc's own fields are used.
export function productJsonLd(p, variants = []) {
  const url = `${SITE_URL}/product/${p.id}`;
  const models = modelsForProduct(p);
  const priced = variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0);
  const low = priced.length ? Math.min(...priced) : productPrice(p);
  const high = priced.length ? Math.max(...priced) : low;
  const inStock = variants.length
    ? variants.some((v) => v.inStock !== false)
    : p.inStock !== false;

  const offer = {
    "@type": "Offer",
    url,
    priceCurrency: p.currency || "INR",
    price: low,
    availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@id": `${SITE_URL}/#organization` },
    shippingDetails: shippingDetails(low),
    hasMerchantReturnPolicy: merchantReturnPolicy(),
  };

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name,
    url,
    image: productImages(p),
    description: productDescription(p),
    brand: { "@type": "Brand", name: BRAND },
    sku: p.id,
    category: p.isJewellery ? "Jewellery" : "Mobile Phone Cases",
    countryOfOrigin: "CN",
    offers:
      low !== null && high !== null && high > low
        ? {
            "@type": "AggregateOffer",
            priceCurrency: offer.priceCurrency,
            lowPrice: low,
            highPrice: high,
            offerCount: priced.length,
            availability: offer.availability,
            offers: [offer],
          }
        : offer,
  };
  if (models.length) {
    data.isAccessoryOrSparePartFor = models.map((m) => ({ "@type": "Product", name: m }));
  }

  // Only real, verified reviews that carry a star rating go into rich results.
  const rated = (Array.isArray(p.reviews) ? p.reviews : []).filter(
    (r) => r && typeof r === "object" && r.verified && Number(r.rating) >= 1
  );
  if (rated.length) {
    const avg = rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length;
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(avg.toFixed(1)),
      reviewCount: rated.length,
      bestRating: 5,
    };
    data.review = rated.slice(0, 10).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.name || "Verified buyer" },
      reviewBody: r.text || "",
      reviewRating: { "@type": "Rating", ratingValue: Number(r.rating), bestRating: 5 },
    }));
  }
  if (low === null) delete data.offers;
  return data;
}

export function breadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

export function itemListJsonLd(products) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: products.slice(0, 50).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/product/${p.id}`,
      name: p.name,
    })),
  };
}

export function faqJsonLd(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
