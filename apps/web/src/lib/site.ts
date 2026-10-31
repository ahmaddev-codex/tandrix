// Where the site lives. Set at build time on the production host; everything absolute (social
// cards, the sitemap) follows it.
const url = process.env.NEXT_PUBLIC_SITE_URL;

export const SITE_URL =
  url && /^https?:\/\//.test(url) ? url.replace(/\/+$/, "") : "http://localhost:3000";
