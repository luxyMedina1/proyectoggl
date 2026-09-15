import type { Metadata, ResolvingMetadata } from "next";
import {
  getCiudades,
  getPaquetesCityPass,
  getPaqueteCityPassDetalle,
} from "@/lib/citypass/getCityPass";
import { construirProductJsonLd } from "@/utils/jsonLdCityPass";
import { slugify } from "@/utils/slugify";
import { textoPlano } from "@/utils/sanitizeHtml";
import { getSiteConfig } from "@/lib/config/getSiteConfig";
import CityPassPaquetePage from "@/publicUi/pages/CityPassPaquetePage";

type Props = { params: Promise<{ slug: string; paqueteSlug: string }> };

// Mismo origen que las <meta> Open Graph, para que el JSON-LD declare la misma URL absoluta.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";
const SITE_NAME_FALLBACK = process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip";

// Mismo TTL que `TTL_CITYPASS` en `lib/citypass/getCityPass.ts` (a mano: el config de
// segmento de Next exige un literal estático, no puede importarse). Sin esto, y sin
// `generateStaticParams` abajo, cada request se serviría 100% dinámico con
// `Cache-Control: no-store` aunque el fetch de abajo ya esté cacheado — mismo fix
// verificado con `next start` real en `citypass/[slug]/page.tsx`.
export const revalidate = 3_600;

// Prerenderiza en build los paquetes vendibles de cada ciudad conocida (mismo patrón
// que `citypass/[slug]/page.tsx` y `/eventos/[slug]`). `dynamicParams` es `true` por
// defecto: un paquete nuevo que no estuviera aquí al momento del build se sirve bien
// igual, solo que su primera visita es on-demand.
export async function generateStaticParams(): Promise<{ slug: string; paqueteSlug: string }[]> {
  const ciudades = await getCiudades();
  const params: { slug: string; paqueteSlug: string }[] = [];
  for (const ciudad of ciudades) {
    const paquetes = await getPaquetesCityPass(ciudad);
    for (const paquete of paquetes) {
      params.push({ slug: slugify(ciudad.nombre), paqueteSlug: slugify(paquete.nombre) });
    }
  }
  return params;
}

// Mismo patrón que `citypass/[slug]/page.tsx`: reutiliza el fetch CACHEADO
// (`getPaqueteCityPassDetalle`, TTL 1 h + tag `citypass:<slug>`) también para
// pintar OG/Twitter al compartir el link de un paquete puntual.
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { slug, paqueteSlug } = await params;
  const url = `${SITE_URL}/citypass/${slug}/paquete/${paqueteSlug}`;

  const paquete = await getPaqueteCityPassDetalle(paqueteSlug, slug);
  // Slug que no corresponde a ningún paquete de esta ciudad: sin datos reales que
  // anunciar, se hereda el OG genérico del layout raíz en vez de inventar un título.
  if (!paquete) return {};

  const { config } = await getSiteConfig();
  const siteName = config?.nombreMarca?.trim() || SITE_NAME_FALLBACK;

  // Imagen de marca del layout raíz, para cuando el paquete no trae imagen propia
  // que anunciar (mismo fix que `/eventos` y `citypass/[slug]`).
  const heredadas = (await parent).openGraph?.images ?? [];

  const titulo = paquete.nombre;
  const descripcion =
    (paquete.descripcion && textoPlano(paquete.descripcion)) ||
    `Descubre el CityPass ${paquete.nombre}${paquete.ciudad ? ` en ${paquete.ciudad.nombre}` : ""}: acceso a ${paquete.atraccionesCount} ${paquete.atraccionesCount === 1 ? "atracción" : "atracciones"}.`;
  const imagen = paquete.imagenPrincipal || undefined;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName,
      locale: "es_MX",
      title: titulo,
      description: descripcion,
      images: imagen ? [{ url: imagen, alt: titulo }] : heredadas,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: imagen ? [imagen] : heredadas,
    },
  };
}

// Server Component completo: resuelve el paquete con el fetch CACHEADO, siembra su
// `Product` de schema.org en el HTML inicial, y se lo pasa ya resuelto a
// `CityPassPaquetePage` como prop — ya no vuelve a pedirlo por su cuenta. El resto de
// la página (auth, carrito de boletos, mapa, galería) se queda en cliente a propósito:
// es la pantalla de compra, no solo contenido para indexar.
export default async function Page({ params }: Props) {
  const { slug, paqueteSlug } = await params;
  const paquete = await getPaqueteCityPassDetalle(paqueteSlug, slug);

  // JSON-LD emitido con JSON.stringify: escapa el contenido, no hay vector de inyección.
  const jsonLd = paquete
    ? construirProductJsonLd(paquete, `${SITE_URL}/citypass/${slug}/paquete/${paqueteSlug}`)
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <CityPassPaquetePage paquete={paquete} />
    </>
  );
}
