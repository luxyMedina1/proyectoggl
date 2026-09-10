import { cache } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import EventosView from "./EventosView";
import { getListaEventos } from "@/utils/ogEvento";
import type { EventoListaSlug } from "@/utils/eventoSlug";
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
const getEventosHome = cache(async (): Promise<EventoListaSlug[]> => {
  try {
    return await getListaEventos();
  } catch {
    return [];
  }
});

// Cascarón de servidor de la home. La UI la sigue renderizando EventosView
// ("use client") con su propio fetch; aquí SOLO se añaden las <meta> propias de
// /eventos (antes heredaba las globales del layout) y el ItemList JSON-LD para
// crawlers. No se pasa data al cliente: el render y el flujo de datos no cambian
// (el SSR de la lista para el LCP sigue pendiente, ver doc 05).
export async function generateMetadata(
  _props: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { config } = await getSiteConfig();
  const siteName = config?.nombreMarca?.trim() || TITLE_APP;
  const url = `${SITE_URL}/eventos`;

  // El <title> del documento sigue siendo "Eventos" (+ plantilla "%s | Marca" del
  // layout): describe la página y aporta la keyword para buscadores y pestaña.
  // Pero la tarjeta al compartir (og:/twitter:) muestra la MARCA, no "Eventos":
  // es el índice del sitio, y un título de sección suelto se lee peor que el
  // nombre de marca en un chat.
  //
  // La imagen es la OG de respaldo de marca (`app/opengraph-image.tsx`: logo sobre
  // el degradado). Antes se usaba el banner del primer evento del listado, pero
  // eso ataba la portada compartida a un evento cualquiera y, si la lista venía
  // vacía, salía sin imagen. Hay que heredarla explícitamente de `parent`: al
  // declarar un bloque `openGraph`/`twitter` propio sin `images`, Next NO reinyecta
  // la imagen de archivo del segmento raíz (se probó: quedaba sin `og:image`).
  const heredadas = (await parent).openGraph?.images ?? [];

  return {
    title: "Eventos",
    description: DESCRIPCION_HOME,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName,
      locale: "es_MX",
      title: siteName,
      description: DESCRIPCION_HOME,
      images: heredadas,
    },
    twitter: {
      card: "summary_large_image",
      title: siteName,
      description: DESCRIPCION_HOME,
      images: heredadas,
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
