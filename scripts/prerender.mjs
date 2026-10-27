// Runs after `vite build`. The storefront is a client-rendered SPA that loads
// products from Firestore, so without this, crawlers that don't execute
// JavaScript (Bing, most AI answer engines, social previews) see an empty
// <div id="root">. This script reads the catalog and writes a real HTML file
// for every public URL — with its own title, meta tags, JSON-LD and visible
// content — plus sitemap.xml and llms.txt. React replaces the static markup
// when the app boots, so users see the normal SPA.
//
// If Firestore can't be reached the build still succeeds: only the homepage
// head tags and static files are written.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, query, terminate, where } from "firebase/firestore";
import {
  BRAND,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  INSTAGRAM_URL,
  SITE_URL,
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
  modelDescription,
  modelPath,
  modelTitle,
  modelsForProduct,
  organizationJsonLd,
  productDescription,
  productImages,
  productJsonLd,
  productPrice,
  productTitle,
  websiteJsonLd,
} from "../src/lib/seo.js";
import { cloudinaryUrl, responsiveImg } from "../src/lib/images.js";
import { FAQS } from "../src/faqs.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const env = loadEnv("production", root, "");
const today = new Date().toISOString().slice(0, 10);

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// JSON inside <script> must not contain "</script>".
// Social previews (WhatsApp, Instagram, X) choke on multi-MB PNGs: send a
// 1200px JPEG instead.
const ogImage = (url) =>
  url && url.includes("res.cloudinary.com") ? cloudinaryUrl(url, 1200).replace("f_auto", "f_jpg") : url;

const jsonScript = (data, page = true) =>
  `<script type="application/ld+json"${page ? " data-page-jsonld" : ""}>${JSON.stringify(data).replace(
    /</g,
    "\\u003c"
  )}</script>`;

async function loadCatalog() {
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("VITE_FIREBASE_PROJECT_ID is not set");
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);
  try {
    const snap = await getDocs(collection(db, "products"));
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const variantsById = {};
    const withVariants = products.filter((p) => p.hasVariants);
    for (let i = 0; i < withVariants.length; i += 10) {
      await Promise.all(
        withVariants.slice(i, i + 10).map(async (p) => {
          const vs = await getDocs(collection(db, "products", p.id, "variants"));
          variantsById[p.id] = vs.docs.map((d) => d.data()).filter((v) => v.active !== false);
        })
      );
    }
    // Published customer reviews -> merged into product.reviews so the
    // static Product JSON-LD carries the same star rating as the live page.
    try {
      const reviewSnap = await getDocs(query(collection(db, "reviews"), where("status", "==", "published")));
      const byProduct = {};
      for (const d of reviewSnap.docs) {
        const r = d.data();
        (byProduct[r.productId] ||= []).push({ name: r.name, text: r.text, rating: r.rating, verified: true });
      }
      for (const p of products) {
        if (byProduct[p.id]) p.reviews = [...byProduct[p.id], ...(Array.isArray(p.reviews) ? p.reviews : [])];
      }
    } catch (err) {
      console.warn(`[prerender] could not load reviews: ${err.message}`);
    }
    return { products, variantsById };
  } finally {
    await terminate(db);
  }
}

function renderPage(template, { title, description, urlPath, image, jsonLd = [], body, preload = [] }) {
  const url = `${SITE_URL}${urlPath}`;
  let html = template;
  const swap = (re, value) => {
    html = html.replace(re, value);
  };
  swap(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  swap(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`);
  swap(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  swap(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`);
  swap(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`);
  swap(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);
  swap(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(title)}$2`);
  swap(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${esc(description)}$2`);

  const extraHead = [
    image ? `<meta property="og:image" content="${esc(ogImage(image))}" />` : "",
    image ? `<meta name="twitter:image" content="${esc(ogImage(image))}" />` : "",
    ...preload,
    ...jsonLd.map((d) => jsonScript(d)),
  ]
    .filter(Boolean)
    .join("\n    ");
  swap("</head>", `    ${extraHead}\n  </head>`);
  // Wrapped in .seo-fallback (hidden on screen by a style in index.html) so
  // visitors never see this unstyled copy flash before React renders.
  swap('<div id="root"></div>', `<div id="root"><div class="seo-fallback">${body}</div></div>`);
  return html;
}

async function writeRoute(urlPath, html) {
  // vercel.json has cleanUrls: /product/abc is served from product/abc.html
  const file = urlPath === "/" ? "index.html" : `${urlPath.slice(1)}.html`;
  const out = path.join(dist, file);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, html);
}

// ---------- static body fragments (seen by non-JS crawlers) ----------

const nav = `<header><a href="/">${BRAND}</a> · <a href="/about">About &amp; contact</a> · <a href="/orderstatus">Track order</a></header>`;

const trustFacts = `<ul>
<li>Cash on delivery available across India</li>
<li>Free shipping on orders above ₹500 (₹80 otherwise)</li>
<li>Orders dispatch within 24–48 hours; delivered in 3–7 business days</li>
<li>Secure online payments via Razorpay (UPI, cards, net banking)</li>
<li>2-day return/exchange window — <a href="/returnPolicy">see return policy</a></li>
<li>Support on WhatsApp and phone: +91 98713 35748</li>
</ul>`;

const footer = `<footer><nav>
<a href="/about">About &amp; contact</a> · <a href="/shipping-policy">Shipping policy</a> ·
<a href="/returnPolicy">Return &amp; refund policy</a> · <a href="/privacy-policy">Privacy policy</a> ·
<a href="${INSTAGRAM_URL}">Instagram</a></nav><p>© ${new Date().getFullYear()} ${BRAND}, India</p></footer>`;

function productListHtml(products) {
  return `<ul>${products
    .map((p) => {
      const price = productPrice(p);
      return `<li><a href="/product/${esc(p.id)}">${esc(p.name)}</a>${price ? ` – ₹${price}` : ""}</li>`;
    })
    .join("")}</ul>`;
}

function modelLinksHtml(models) {
  if (!models.length) return "";
  return `<section><h2>Shop cases by phone model</h2><ul>${models
    .map((m) => `<li><a href="${modelPath(m)}">${esc(m)} cases &amp; covers</a></li>`)
    .join("")}</ul></section>`;
}

const faqHtml = `<section><h2>Frequently asked questions</h2>${FAQS.map(
  (f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`
).join("")}</section>`;

// ---------- main ----------

async function main() {
  const template = await readFile(path.join(dist, "index.html"), "utf8");

  // Product pages preload their JS chunk and hero photo so the browser starts
  // both while parsing HTML, instead of after the main bundle and Firestore.
  let productChunkPreload = [];
  try {
    const manifest = JSON.parse(await readFile(path.join(dist, ".vite", "manifest.json"), "utf8"));
    const entry = manifest["src/components/ProductPage.jsx"];
    if (entry) {
      productChunkPreload = [
        `<link rel="modulepreload" href="/${entry.file}" />`,
        ...(entry.css || []).map((c) => `<link rel="preload" as="style" href="/${c}" />`),
      ];
    }
  } catch {
    console.warn("[prerender] no Vite manifest; skipping product chunk preload");
  }
  // Build metadata only — don't publish it.
  await rm(path.join(dist, ".vite"), { recursive: true, force: true });
  // Site-wide identity schema goes in every page's <head>.
  const base = template.replace(
    "</head>",
    `    ${jsonScript(organizationJsonLd(), false)}\n    ${jsonScript(websiteJsonLd(), false)}\n  </head>`
  );

  // Plain app shell for client-only routes (/cart, /checkout, /account,
  // /order/:id, …). vercel.json rewrites unknown paths to /spa-shell. It is
  // the untouched template (no homepage content or homepage canonical), so
  // those pages don't masquerade as the homepage; useSeo sets their tags.
  // Written first so it exists even if the catalog can't be loaded.
  await writeFile(path.join(dist, "spa-shell.html"), base);

  let catalog = { products: [], variantsById: {} };
  try {
    catalog = await loadCatalog();
    console.log(`[prerender] loaded ${catalog.products.length} products`);
  } catch (err) {
    console.warn(`[prerender] could not load catalog, writing static pages only: ${err.message}`);
  }

  const visible = catalog.products
    .filter((p) => p.name)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const cases = visible.filter((p) => p.isJewellery !== true);

  const byModel = new Map();
  for (const p of cases) {
    for (const m of modelsForProduct(p)) {
      if (!byModel.has(m)) byModel.set(m, []);
      byModel.get(m).push(p);
    }
  }
  const models = [...byModel.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const sitemap = [{ loc: "/", priority: "1.0", images: [] }];

  // Homepage
  const homeImage = productImages(cases[0] || {})[0];
  await writeRoute(
    "/",
    renderPage(base, {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      urlPath: "/",
      image: homeImage,
      jsonLd: cases.length ? [itemListJsonLd(cases), faqJsonLd(FAQS)] : [faqJsonLd(FAQS)],
      body: `${nav}<main><h1>Phone Cases &amp; Covers Online in India</h1>
<p>${BRAND} sells designer mobile back covers and phone cases${models.length ? ` for ${models.length} phone models` : ""}, shipped across India.</p>
${trustFacts}${modelLinksHtml(models)}
<section><h2>All phone cases</h2>${productListHtml(cases)}</section>${faqHtml}</main>${footer}`,
    })
  );

  // One landing page per phone model: /cases/iphone-15-pro
  for (const model of models) {
    const items = byModel.get(model);
    const prices = items.map(productPrice).filter(Boolean);
    const min = prices.length ? Math.min(...prices) : null;
    const max = prices.length ? Math.max(...prices) : null;
    const urlPath = modelPath(model);
    await writeRoute(
      urlPath,
      renderPage(base, {
        title: modelTitle(model),
        description: modelDescription(model, items.length, min),
        urlPath,
        image: productImages(items[0])[0],
        jsonLd: [
          itemListJsonLd(items),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: `${model} Cases`, path: urlPath },
          ]),
        ],
        body: `${nav}<main><nav><a href="/">Home</a> › ${esc(model)} cases</nav>
<h1>${esc(model)} Cases &amp; Covers</h1>
<p>Browse ${items.length} ${esc(model)} back cover${items.length === 1 ? "" : "s"}${
          min ? ` priced from ₹${min}${max > min ? ` to ₹${max}` : ""}` : ""
        }. Every ${BRAND} case is cut for the ${esc(model)}'s camera and button layout.</p>
${trustFacts}<section><h2>${esc(model)} cases</h2>${productListHtml(items)}</section>
${modelLinksHtml(models.filter((m) => m !== model))}</main>${footer}`,
      })
    );
    sitemap.push({ loc: urlPath, priority: "0.9", images: [] });
  }

  // Product pages
  for (const p of visible) {
    const urlPath = `/product/${p.id}`;
    const pModels = modelsForProduct(p);
    const images = productImages(p);
    const price = productPrice(p);
    const crumbs = [{ name: "Home", path: "/" }];
    if (pModels.length === 1) crumbs.push({ name: `${pModels[0]} Cases`, path: modelPath(pModels[0]) });
    crumbs.push({ name: p.name, path: urlPath });

    // Same image ProductPage shows first: the first variant's photos if it has any.
    const firstVariantImages = (catalog.variantsById[p.id] || [])[0]?.imageUrls;
    const heroUrl = Array.isArray(firstVariantImages) && firstVariantImages.length ? firstVariantImages[0] : images[0];
    const hero = heroUrl ? responsiveImg(heroUrl, "(max-width: 760px) 100vw, 540px") : null;
    const heroPreload = hero
      ? [
          hero.srcSet
            ? `<link rel="preload" as="image" href="${esc(hero.src)}" imagesrcset="${esc(hero.srcSet)}" imagesizes="${esc(hero.sizes)}" fetchpriority="high" />`
            : `<link rel="preload" as="image" href="${esc(hero.src)}" fetchpriority="high" />`,
        ]
      : [];

    await writeRoute(
      urlPath,
      renderPage(base, {
        preload: [...productChunkPreload, ...heroPreload],
        title: productTitle(p),
        description: productDescription(p),
        urlPath,
        image: images[0],
        jsonLd: [productJsonLd(p, catalog.variantsById[p.id] || []), breadcrumbJsonLd(crumbs)],
        body: `${nav}<main><nav>${crumbs
          .map((c, i) => (i === crumbs.length - 1 ? esc(c.name) : `<a href="${c.path}">${esc(c.name)}</a>`))
          .join(" › ")}</nav>
<h1>${esc(p.name)}</h1>
${hero ? `<img src="${esc(hero.src)}"${hero.srcSet ? ` srcset="${esc(hero.srcSet)}" sizes="${esc(hero.sizes)}"` : ""} alt="${esc(p.name)}${pModels.length === 1 ? ` – ${esc(pModels[0])} case` : ""}" width="600" />` : ""}
${price ? `<p>Price: ₹${price} (inclusive of all taxes)</p>` : ""}
${p.description ? `<p>${esc(p.description)}</p>` : ""}
${
  pModels.length
    ? `<p>Available for: ${pModels.map((m) => `<a href="${modelPath(m)}">${esc(m)}</a>`).join(", ")}</p>`
    : ""
}
${trustFacts}<p>Marketed by ${BRAND}, India. Country of origin: China (imported).</p></main>${footer}`,
      })
    );
    sitemap.push({ loc: urlPath, priority: "0.8", images: images.slice(0, 5) });
  }

  // Static info pages: give them their own head tags too.
  const infoPages = [
    ["/about", `About ${BRAND} – Contact & Customer Support`, `Who we are, how to reach ${BRAND} on WhatsApp, phone and Instagram, and how we ship phone cases across India.`],
    ["/shipping-policy", `Shipping Policy | ${BRAND}`, "Dispatch in 24–48 hrs, delivery in 3–7 business days across India, free shipping over ₹500, cash on delivery available."],
    ["/returnPolicy", `Return & Refund Policy | ${BRAND}`, "2-day return/exchange window, free replacement for items damaged in transit with an unboxing video. Full details."],
    ["/privacy-policy", `Privacy Policy | ${BRAND}`, `How ${BRAND} collects, uses and protects your personal information when you shop with us.`],
    ["/orderstatus", `Track Your Order | ${BRAND}`, "Track your CASEWALL order: sign in with Google to see all your orders, or use your order ID."],
  ];
  for (const [urlPath, title, description] of infoPages) {
    await writeRoute(
      urlPath,
      renderPage(base, {
        title,
        description,
        urlPath,
        body: `${nav}<main><h1>${esc(title.split(" | ")[0])}</h1><p>${esc(description)}</p>${trustFacts}</main>${footer}`,
      })
    );
    sitemap.push({ loc: urlPath, priority: "0.5", images: [] });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemap
  .map(
    (u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${u.priority}</priority>${u.images
      .map((img) => `\n    <image:image><image:loc>${esc(img)}</image:loc></image:image>`)
      .join("")}
  </url>`
  )
  .join("\n")}
</urlset>
`;
  await writeFile(path.join(dist, "sitemap.xml"), xml);

  // llms.txt — a plain-language summary for AI assistants (llmstxt.org).
  const llms = `# ${BRAND}

> ${BRAND} (casewall.in) is an Indian online store selling designer mobile phone cases and back covers. Orders ship across India with cash on delivery available.

## Key facts
- Website: ${SITE_URL}
- Products: phone cases and back covers${models.length ? ` for ${models.length} phone models` : ""}${
    prices(cases) ? `, priced ${prices(cases)}` : ""
  }
- Payment: UPI, cards and net banking via Razorpay; cash on delivery (₹50 COD handling fee paid online, full order amount paid on delivery)
- Shipping: dispatch in 24–48 hours, delivery in 3–7 business days anywhere in India; free over ₹500, otherwise ₹80
- Returns: 2-day return/exchange window as store credit (₹100 processing fee); free replacement for transit damage reported within 24 hours with an unboxing video
- Support: WhatsApp / phone +91 98713 35748; Instagram ${INSTAGRAM_URL}

## Pages
- [Home – all phone cases](${SITE_URL}/)
- [About & contact](${SITE_URL}/about)
- [Shipping policy](${SITE_URL}/shipping-policy)
- [Return & refund policy](${SITE_URL}/returnPolicy)
- [Privacy policy](${SITE_URL}/privacy-policy)
- [Track an order](${SITE_URL}/orderstatus)

## Cases by phone model
${models.map((m) => `- [${m} cases & covers](${SITE_URL}${modelPath(m)}) – ${byModel.get(m).length} design${byModel.get(m).length === 1 ? "" : "s"}`).join("\n")}
`;
  await writeFile(path.join(dist, "llms.txt"), llms);

  // Google Merchant Center product feed (free Shopping listings). In Merchant
  // Center: Products → Add products → "Add products from a file" → enter
  // https://casewall.in/merchant-feed.xml → daily scheduled fetch.
  // Price/image/stock describe the variant ProductPage selects by default,
  // so the feed always matches what the landing page shows.
  const feedItems = visible
    .map((p) => {
      const variants = catalog.variantsById[p.id] || [];
      const v = p.hasVariants ? variants[0] : p;
      if (!v) return null;
      const price = Number(v.price);
      if (!Number.isFinite(price) || price <= 0) return null;
      const mrp = Number(p.hasVariants ? v.mrp : p.mrp);
      const stockLeft =
        typeof v.stock === "number" ? Number(v.stock) - Number(v.reservedStock || 0) : Infinity;
      const inStock = v.inStock !== false && v.active !== false && stockLeft > 0;
      const variantImages = Array.isArray(v.imageUrls) && v.imageUrls.length ? v.imageUrls : null;
      const imgs = variantImages || productImages(p);
      if (!imgs.length) return null;
      const feedImage = (u) => (u.includes("res.cloudinary.com") ? cloudinaryUrl(u, 1200).replace("f_auto", "f_jpg") : u);
      const pModels = modelsForProduct(p);
      const title = productTitle(p).replace(` | ${BRAND}`, "").slice(0, 150);
      const onSale = Number.isFinite(mrp) && mrp > price;
      return `    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${esc(title)}</g:title>
      <g:description>${esc(p.description || productDescription(p)).slice(0, 5000)}</g:description>
      <g:link>${SITE_URL}/product/${esc(p.id)}</g:link>
      <g:image_link>${esc(feedImage(imgs[0]))}</g:image_link>${imgs
        .slice(1, 10)
        .map((u) => `\n      <g:additional_image_link>${esc(feedImage(u))}</g:additional_image_link>`)
        .join("")}
      <g:availability>${inStock ? "in_stock" : "out_of_stock"}</g:availability>
      <g:price>${onSale ? mrp : price}.00 INR</g:price>${onSale ? `\n      <g:sale_price>${price}.00 INR</g:sale_price>` : ""}
      <g:brand>${BRAND}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>${p.isJewellery ? "188" : "2353"}</g:google_product_category>
      <g:product_type>${p.isJewellery ? "Jewellery" : `Phone Cases${pModels.length === 1 ? ` &gt; ${esc(pModels[0])}` : ""}`}</g:product_type>
      <g:shipping>
        <g:country>IN</g:country>
        <g:price>${price >= 500 ? 0 : 80}.00 INR</g:price>
      </g:shipping>
    </item>`;
    })
    .filter(Boolean);
  await writeFile(
    path.join(dist, "merchant-feed.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${BRAND}</title>
    <link>${SITE_URL}/</link>
    <description>${esc(DEFAULT_DESCRIPTION)}</description>
${feedItems.join("\n")}
  </channel>
</rss>
`
  );
  console.log(`[prerender] wrote merchant-feed.xml with ${feedItems.length} products`);

  console.log(`[prerender] wrote ${sitemap.length} pages, sitemap.xml and llms.txt`);
}

function prices(items) {
  const ps = items.map(productPrice).filter(Boolean);
  if (!ps.length) return "";
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  return min === max ? `₹${min}` : `₹${min}–₹${max}`;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[prerender] failed:", err);
    process.exit(1);
  });
