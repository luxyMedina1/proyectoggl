import type { Metadata, ResolvingMetadata } from "next";
import { getPaqueteCityPassDetalle } from "@/lib/citypass/getCityPass";
import { construirProductJsonLd } from "@/utils/jsonLdCityPass";
import { textoPlano } from "@/utils/sanitizeHtml";
import { getSiteConfig } from "@/lib/config/getSiteConfig";
import CityPassPaquetePage from "@/publicUi/pages/CityPassPaquetePage";

type Props = { params: Promise<{ slug: string; paqueteSlug: string }> };

// Mismo origen que las <meta> Open Graph, para que el JSON-LD declare la misma URL absoluta.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";
const SITE_NAME_FALLBACK = process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip";

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

// Cascarón de servidor del detalle de un paquete de CityPass. Resuelve el paquete
// con el fetch CACHEADO y siembra su `Product` de schema.org en el HTML inicial.
// La UI la sigue renderizando `CityPassPaquetePage` ("use client"), que vuelve a
// pedir el detalle para pintar; aquí solo se emite metadata + dato estructurado.
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
      <CityPassPaquetePage />
    </>
  );
}
