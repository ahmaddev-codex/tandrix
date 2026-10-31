import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const pages: Array<[string, MetadataRoute.Sitemap[number]["changeFrequency"], number]> = [
  ["/", "weekly", 1],
  ["/mac", "monthly", 0.9],
  ["/iphone", "monthly", 0.9],
  ["/technical", "monthly", 0.7],
  ["/safety", "monthly", 0.7],
  ["/whats-new", "weekly", 0.6],
  ["/credits", "yearly", 0.3],
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map(([path, changeFrequency, priority]) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
