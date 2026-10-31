import type { MetadataRoute } from "next";

// URLs turn absolute once the production domain lands in metadataBase.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "/", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "/technical", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: "/credits", lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
