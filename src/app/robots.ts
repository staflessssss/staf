import type { MetadataRoute } from "next";

const baseUrl = "https://behalfy.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms", "/data-deletion"],
      disallow: ["/api", "/admin", "/client", "/login", "/invite", "/preview"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
