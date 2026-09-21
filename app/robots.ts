import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "Googlebot",
        allow: [
          "/",
          "/pricing",
          "/legal/*",
          "/logos/*",
          "/*.jpg",
          "/*.png",
          "/*.svg",
        ],
        disallow: [
          "/super-admin*",
          "/*/admin*",
          "/api/*",
          "/_next/*",
          "/*/elections/*/vote*",
          "/admin/login*",
        ],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/super-admin*",
          "/*/admin*",
          "/api/*",
          "/_next/*",
          "/*/elections/*/vote*",
          "/admin/login*",
        ],
      },
    ],
    sitemap: "https://studelect.com.ng/sitemap.xml",
    host: "https://studelect.com.ng",
  };
}

