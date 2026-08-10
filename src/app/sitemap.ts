import type { MetadataRoute } from "next";

const BASE = process.env.APP_URL || "https://servox-phi.vercel.app";

const publicPages = ["", "/login", "/signup", "/track"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return publicPages.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
