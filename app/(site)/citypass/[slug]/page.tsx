import type { Metadata, ResolvingMetadata } from "next";
import { getCiudades, getLandingCityPass, getPaquetesCityPass } from "@/lib/citypass/getCityPass";
import { construirProductJsonLd } from "@/utils/jsonLdCityPass";
import { slugify, deslugify } from "@/utils/slugify";
import { textoPlano } from "@/utils/sanitizeHtml";
import { getSiteConfig } from "@/lib/config/getSiteConfig";
import CityPassPage from "@/publicUi/pages/CityPassPage";

type Props = { params: Promise<{ slug: string }> };

// Mismo origen que las <meta> Open Graph, para que el JSON-LD declare la misma URL absoluta.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";
const SITE_NAME_FALLBACK = process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip";

// Las tarjetas de WhatsApp/Facebook/X no ejecutan JS: sin esto, compartir el link de
// CUALQUIER ciudad —tenga o no CityPass a la venta— mostraba el OG genérico del layout
// raíz. Reutiliza los mismos helpers CACHEADOS que el cascarón (`getCiudades`,
// `getLandingCityPass`, TTL 1 h + tag `citypass:<slug>`), así que no duplica fetch al
// backend: React `cache()` dedupea por los mismos argumentos dentro del request.
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { slug } = await params;
  const url = `${SITE_URL}/citypass/${slug}`;

  const ciudades = await getCiudades();
  const ciudad = ciudades.find((c) => slugify(c.nombre) === slug);
  // Slug que no corresponde a ninguna ciudad: sin datos reales que anunciar, se
  // hereda el OG genérico del layout raíz en vez de inventar un título.
  if (!ciudad) return {};

  const landing = await getLandingCityPass(ciudad.id, slug);
  const { config } = await getSiteConfig();
  const siteName = config?.nombreMarca?.trim() || SITE_NAME_FALLBACK;

  // Imagen de marca del layout raíz (logo sobre el degradado, `app/opengraph-image.tsx`),
  // para las ramas de abajo que no tienen imagen propia que anunciar. Hay que heredarla
  // explícitamente de `parent`: al declarar un bloque `openGraph`/`twitter` propio, Next
  // NO reinyecta la imagen de archivo del segmento raíz (mismo fix que `/eventos`,
  // probado ahí: sin esto quedaba sin `og:image`).
  const heredadas = (await parent).openGraph?.images ?? [];

  // Ciudad sin CityPass configurado (landing `configurada: false`, o el back no
  // respondió): mismo título en las dos ramas, pero la descripción NO promete
  // paquetes que no existen — coherente con el estado vacío que pinta
  // `CityPassPage` para este mismo caso. La imagen SÍ se anuncia (la de marca):
  // sin esto la tarjeta al compartir salía sin imagen (se verificó contra el
  // backend real — hoy Durango, la única ciudad, está en este caso).
  if (!landing || landing.configurada === false) {
    const titulo = `CityPass ${ciudad.nombre}`;
    const descripcion =
      landing?.configurada === false
        ? landing.mensaje
        : `Estamos preparando el CityPass de ${ciudad.nombre || deslugify(slug)}. Muy pronto podrás verlo aquí.`;

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
        images: heredadas,
      },
      twitter: {
        card: "summary_large_image",
        title: titulo,
        description: descripcion,
        images: heredadas,
      },
    };
  }

  // Ciudad con CityPass a la venta: título/descripción/imagen reales del hero,
  // igual que pinta `CityPassHero`. Si el hero no trae imagen, cae a la de marca
  // (misma razón que arriba) en vez de quedarse sin ninguna.
  const titulo = landing.hero.titulo || `CityPass ${ciudad.nombre}`;
  const descripcion =
    textoPlano(landing.hero.descripcion) ||
    `Descubre el CityPass de ${ciudad.nombre}: ${landing.paquetes.length} paquete${landing.paquetes.length === 1 ? "" : "s"} disponible${landing.paquetes.length === 1 ? "" : "s"}.`;
  const imagen = landing.hero.imagen || undefined;

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

// Cascarón de servidor de la landing de CityPass de una ciudad. Resuelve los paquetes
// vendibles con los helpers CACHEADOS (`getPaquetesCityPass`, TTL 1 h + tag
// `citypass:<slug>`) y siembra un `Product` de schema.org por paquete indexable en el
// HTML inicial (Req 1.6). La UI la sigue renderizando `CityPassPage` ("use client"),
// que vuelve a pedir el landing para pintar; aquí solo se emite el dato estructurado.
export default async function Page({ params }: Props) {
  const { slug } = await params;

  // Resolver la ciudad por slug con la misma regla que la UI (`slugify(nombre)`) y traer
  // solo los paquetes `disponibleVenta: true` de una landing `configurada: true`.
  const ciudades = await getCiudades();
  const ciudad = ciudades.find((c) => slugify(c.nombre) === slug);
  const paquetes = ciudad ? await getPaquetesCityPass(ciudad) : [];

  // Un `Product` por paquete vendible. La URL apunta al detalle del paquete
  // (`/citypass/<ciudadSlug>/paquete/<paqueteSlug>`), coherente con la ruta real.
  // JSON-LD emitido con JSON.stringify: escapa el contenido, no hay vector de inyección.
  const scriptsJsonLd = paquetes.map((paquete) =>
    construirProductJsonLd(
      paquete,
      `${SITE_URL}/citypass/${slug}/paquete/${slugify(paquete.nombre)}`,
    ),
  );

  return (
    <>
      {scriptsJsonLd.map((jsonLd, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ))}
      <CityPassPage />
    </>
  );
}
