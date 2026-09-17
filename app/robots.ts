import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/super-admin",
          "/super-admin/",
          "/api/",
          "/_next/",
        ],
      },
      {
        // Block all bots from admin panels
        userAgent: "*",
        disallow: ["/*/admin", "/*/admin/"],
      },
    ],
    sitemap: "https://studelect.com.ng/sitemap.xml",
  };
}
