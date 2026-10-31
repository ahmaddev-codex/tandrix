// Where the site lives: everything absolute (social cards, the sitemap) follows it. Set
// NEXT_PUBLIC_SITE_URL to name it; on Vercel, production and each preview otherwise know their own.
const url = process.env.NEXT_PUBLIC_SITE_URL;
const vercel =
  process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL;

export const SITE_URL =
  url && /^https?:\/\//.test(url)
    ? url.replace(/\/+$/, "")
    : vercel
      ? `https://${vercel}`
      : "http://localhost:3000";
