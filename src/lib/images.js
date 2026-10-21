// Product photos are uploaded to Cloudinary at full camera size (often 2–4 MB
// PNGs). Cloudinary can resize and re-encode on the fly when transformation
// parameters are added to the URL, so we never ship the original file:
//   f_auto  -> AVIF/WebP for browsers that support it
//   q_auto  -> perceptual quality compression
//   c_limit -> scale down to the width, never up
// Non-Cloudinary URLs are returned unchanged.

const UPLOAD_SEGMENT = "/image/upload/";

export function cloudinaryUrl(url, width) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com") || !url.includes(UPLOAD_SEGMENT)) {
    return url;
  }
  const [base, rest] = url.split(UPLOAD_SEGMENT);
  // Already transformed (first path segment has transformation params) -> leave as-is.
  if (/^[a-z]{1,3}_[^/]+\//.test(rest) && !/^v\d+\//.test(rest)) return url;
  const t = ["f_auto", "q_auto", "c_limit", width ? `w_${width}` : null].filter(Boolean).join(",");
  return `${base}${UPLOAD_SEGMENT}${t}/${rest}`;
}

const WIDTHS = [320, 480, 640, 960, 1280];

// Props for an <img>: a sensible default src plus a srcset so the browser
// picks the smallest file that is sharp on the user's screen.
export function responsiveImg(url, sizes, maxWidth = 1280) {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com")) return { src: url };
  const widths = WIDTHS.filter((w) => w <= maxWidth);
  return {
    src: cloudinaryUrl(url, widths[Math.min(2, widths.length - 1)]),
    srcSet: widths.map((w) => `${cloudinaryUrl(url, w)} ${w}w`).join(", "),
    sizes,
  };
}
