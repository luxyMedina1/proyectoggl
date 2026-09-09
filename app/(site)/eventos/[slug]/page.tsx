import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadataEvento, getEvento, getListaEventos } from "@/utils/ogEvento";
import { eventosAStaticParams } from "@/utils/eventoSlug";
import { construirEventosJsonLd } from "@/utils/jsonLdEvento";
import EventoDetalleView from "./EventoDetalleView";
// La proyección PURA y su tipo viven en un módulo sin `'use client'`: no se pueden invocar
// funciones de un módulo de cliente desde este Server Component (Req 26.1, tarea 3.2).
import { proyectarCabeceraEvento, type CabeceraEvento } from "./cabeceraEvento";

type Props = { params: Promise<{ slug: string }> };

// Mismo origen que las <meta> Open Graph de ogEvento.ts, para que og:url y el JSON-LD
// declaren la misma URL absoluta.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";

// Corre en el servidor: resuelve el evento por slug y emite las <meta> (title,
// description, Open Graph, Twitter, canonical) en el HTML para la vista previa al
// compartir. La UI la sigue renderizando EventoDetalleView ("use client").
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildMetadataEvento(slug, "detalle");
}

// Prerenderiza en build los primeros 50 eventos (los de mayor trafico) con el mismo
// buildEventoSlug que usa el sitemap. El resto se sirve bajo demanda porque
// `dynamicParams` es true por defecto (Req 3.3). Si la lista no se puede obtener,
// se devuelve [] para no romper el build; esas rutas se generaran bajo demanda
// (Req 3.1, 3.2).
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    return eventosAStaticParams(await getListaEventos());
  } catch {
    return [];
  }
}

// El cascarón resuelve el evento en el servidor; si el slug no corresponde a ningún
// evento, invoca notFound() para responder un 404 real (renderiza app/not-found.tsx) en
// vez de un soft 404 (200 con la vista vacía) que malgasta presupuesto de rastreo.
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  // notFound() lanza (retorno `never`) y corta el render con un 404 real; el `return`
  // asegura que no se siga construyendo el JSON-LD con un evento nulo.
  if (!evento) return notFound();

  // JSON-LD emitido con JSON.stringify: escapa el contenido, no hay vector de inyección.
  // La emisión multifecha (un `Event` por función, o uno con evento.fecha si no hay) vive en
  // utils/jsonLdEvento.ts como función pura para poder testearla sin este Server Component.
  const scriptsJsonLd = construirEventosJsonLd(evento, SITE_URL);

  // Proyección EXPLÍCITA de exactamente 6 claves (Req 26.1). `proyectarCabeceraEvento` construye
  // la cabecera clave por clave: NUNCA `{ ...evento }`, porque el detalle acarrea
  // `secciones[].asientosDisponibles` cacheado ~5 min y propagarlo al cliente permitiría vender
  // el mismo asiento dos veces (Req 26.2). La disponibilidad la pide la vista al montar con
  // `cache: "no-store"` (tarea 3.2). La proyección es una función pura (colocada junto al tipo
  // `CabeceraEvento`) para poder verificar por propiedad que excluye la disponibilidad (Property 9).
  const cabecera: CabeceraEvento = proyectarCabeceraEvento(evento);

  return (
    <>
      {scriptsJsonLd.map((jsonLd, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ))}
      <EventoDetalleView cabecera={cabecera} />
    </>
  );
}
