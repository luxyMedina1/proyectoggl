import { getCiudades, getPaquetesCityPass } from "@/lib/citypass/getCityPass";
import { construirProductJsonLd } from "@/utils/jsonLdCityPass";
import { slugify } from "@/utils/slugify";
import CityPassPage from "@/publicUi/pages/CityPassPage";

type Props = { params: Promise<{ slug: string }> };

// Mismo origen que las <meta> Open Graph, para que el JSON-LD declare la misma URL absoluta.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";

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
