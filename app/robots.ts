import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/perfil/",
        "/terminar_compra",
        "/terminar_compra_abono",
        "/terminar_compra_conferencia",
        "/terminar_compra_conferencia_gratis",
        "/citypass/checkout/",
        "/citypass/terminar_compra/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
