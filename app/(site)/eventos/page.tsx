import { cache } from "react";
import type { Metadata } from "next";
import EventosView from "./EventosView";
import { getListaEventos } from "@/utils/ogEvento";
import { construirItemListEventosJsonLd } from "@/utils/jsonLdEvento";
import { getSiteConfig } from "@/lib/config/getSiteConfig";

// Mismo origen que el resto de <meta> del sitio, para que canonical y og:url
// declaren la misma URL absoluta.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";
const TITLE_APP = process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip";

const DESCRIPCION_HOME =
  "Explora conciertos, deportes, teatro y espectáculos con boletos disponibles. " +
  "Encuentra tu próximo evento y cómpralo en línea.";

// La lista se pide en `generateMetadata` (para la imagen OG) y en `Page` (para el
// ItemList). `cache()` de React la ejecuta una sola vez por render y comparte el
// resultado; además nunca lanza (cae a []), así que un back caído no rompe la
// página ni el build.
const getEventosHome = cache(async (): Promise<any[]> => {
  try {
    return await getListaEventos();
  } catch {
    return [];
  }
});

// Primera imagen utilizable del listado para la tarjeta al compartir `…/eventos`.
// Devuelve una URL absoluta (las imágenes de evento ya lo son) o null → se hereda
// la imagen OG de respaldo de `app/opengraph-image.tsx` (que dibuja el logo).
const imagenOgDestacada = (eventos: any[]): string | null => {
  for (const e of eventos) {
    const img: unknown = e?.imagenBanner || e?.imagenPromocion;
    if (typeof img === "string" && /^https?:\/\//.test(img)) return img;
  }
  return null;
};

// Cascarón de servidor de la home. La UI la sigue renderizando EventosView
// ("use client") con su propio fetch; aquí SOLO se añaden las <meta> propias de
// /eventos (antes heredaba las globales del layout) y el ItemList JSON-LD para
// crawlers. No se pasa data al cliente: el render y el flujo de datos no cambian
// (el SSR de la lista para el LCP sigue pendiente, ver doc 05).
export async function generateMetadata(): Promise<Metadata> {
  const { config } = await getSiteConfig();
  const siteName = config?.nombreMarca?.trim() || TITLE_APP;
  const title = "Eventos";
  const url = `${SITE_URL}/eventos`;

  const imagen = imagenOgDestacada(await getEventosHome());
  // Sin `images` la ruta hereda `app/opengraph-image.tsx`; con imagen destacada
  // se declara explícita (más `twitter.images` para la tarjeta grande).
  const imagenes = imagen ? [{ url: imagen, alt: `Eventos en ${siteName}` }] : undefined;

  return {
    title,
    description: DESCRIPCION_HOME,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName,
      locale: "es_MX",
      title,
      description: DESCRIPCION_HOME,
      images: imagenes,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: DESCRIPCION_HOME,
      images: imagen ? [imagen] : undefined,
    },
  };
}

export default async function Page() {
  // Listado leído en el servidor SOLO para el ItemList JSON-LD (los crawlers no
  // ejecutan el fetch en cliente de EventosView). Mismo endpoint y cache/tag
  // (`eventos:lista`) que el sitemap. Si el back no responde, la lista viene
  // vacía y se omite el bloque; la página renderiza igual.
  const eventos = await getEventosHome();
  const itemListJsonLd =
    eventos.length > 0 ? construirItemListEventosJsonLd(eventos, SITE_URL) : null;

  return (
    <>
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <EventosView />
    </>
  );
}
