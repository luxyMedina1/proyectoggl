import { cache } from "react";
import { connection } from "next/server";
import type { Metadata, ResolvingMetadata } from "next";
import EventosView, { type Evento } from "./EventosView";
import { getListaEventos } from "@/utils/ogEvento";
import type { EventoListaSlug } from "@/utils/eventoSlug";
import { construirBreadcrumbEventosJsonLd, construirItemListEventosJsonLd } from "@/utils/jsonLdEvento";
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

// Cascarón de servidor de la home: <meta> propias de /eventos, ItemList JSON-LD y la
// lista de eventos YA resuelta para EventosView ("use client"), que la usa como estado
// inicial (doc 05: el banner/LCP y el grid salen en el HTML, sin esperar al fetch de
// cliente). EventosView sigue refrescando en cliente en segundo plano.
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

// Campos pesados del listado que EventosView no usa (descripciones HTML, datos del
// cliente/promotor, imágenes del boleto, SEO). Se quitan antes de pasarlos al cliente
// porque todo lo que va como prop viaja serializado en el payload RSC del HTML.
const CAMPOS_SOLO_SERVIDOR = [
  "descripcion",
  "descripcionExtra",
  "cliente",
  "leyendaMapa",
  "imagenBoleto",
  "imagenBoletoDigital",
  "seo",
  "camposIncluidosEnBoleto",
] as const;

const paraCliente = (eventos: EventoListaSlug[]): Evento[] =>
  eventos.map((evento) => {
    const copia: Record<string, unknown> = { ...evento };
    for (const campo of CAMPOS_SOLO_SERVIDOR) delete copia[campo];
    return copia as unknown as Evento;
  });

export default async function Page() {
  // Render por peticion: EventosView usa useSearchParams() (filtros ?ciudad= y ?buscar=
  // del header). En una ruta estatica eso hace bailout de CSR y la lista no entra al
  // HTML; con `connection()` la ruta es dinamica y useSearchParams tiene valor ya en el
  // render del servidor (doc de use-search-params, "Dynamic Rendering"). La lista en si
  // sigue cacheada por `eventos:lista` (getListaEventos -> apiGet), no se pide al back
  // en cada visita.
  await connection();
  // Listado leído en el servidor SOLO para el ItemList JSON-LD (los crawlers no
  // ejecutan el fetch en cliente de EventosView). Mismo endpoint y cache/tag
  // (`eventos:lista`) que el sitemap. Si el back no responde, la lista viene
  // vacía y se omite el bloque; la página renderiza igual.
  const eventos = await getEventosHome();
  const itemListJsonLd =
    eventos.length > 0 ? construirItemListEventosJsonLd(eventos, SITE_URL) : null;
  const breadcrumbJsonLd = construirBreadcrumbEventosJsonLd(SITE_URL);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      <EventosView eventosIniciales={paraCliente(eventos)} />
    </>
  );
}
