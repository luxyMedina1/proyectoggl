import type { Metadata } from "next";
import DetalleConferencia from "@/eventos/pages/conferencias/DetalleConferencia";
import { getConferencia } from "@/lib/conferencia/getConferencia";
import { construirEventJsonLd, type EventoParaJsonLd } from "@/utils/jsonLdEvento";

type Props = { params: Promise<{ eventoId: string }> };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";

const DESCRIPCION_FALLBACK = "Compra boletos para conciertos, deportes y espectaculos.";

// Se ejecuta en el servidor en cada request: trae los datos de la conferencia
// para que el enlace compartido muestre su nombre, descripcion e imagen reales.
// El componente hijo (DetalleConferencia) sigue siendo "use client" y vuelve a
// pedir los datos para renderizar; aqui solo se resuelven las <meta> del <head>.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventoId } = await params;
  const c = await getConferencia(eventoId);
  if (!c) return {};

  const titulo = c.nombre || "Conferencia";
  const descripcion = c.descripcion || DESCRIPCION_FALLBACK;
  const imagen = c.imagenBanner || c.imagenLogo || "/event_default.webp";

  return {
    title: titulo,
    description: descripcion,
    openGraph: {
      type: "website",
      siteName: process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip",
      locale: "es_MX",
      title: titulo,
      description: descripcion,
      images: [{ url: imagen, alt: titulo }],
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: [imagen],
    },
  };
}

// Mapea la entidad de conferencia (Cosmotech) al subconjunto que consume el helper
// JSON-LD de evento. Una conferencia es un `Event` de schema.org como cualquier otro
// (Req 1.7): `ubicacion` es un texto libre en el backend, así que se coloca como
// nombre del `Place`; no hay dato de disponibilidad fresco, así que se OMITE (nunca
// se declara InStock por defecto — Req 1.3/1.4).
const conferenciaAJsonLd = (c: {
  nombre?: string | null;
  fecha?: string | null;
  descripcion?: string | null;
  ubicacion?: string | null;
  imagenBanner?: string | null;
  imagenLogo?: string | null;
}): EventoParaJsonLd => ({
  nombre: c.nombre ?? "Conferencia",
  fecha: c.fecha ?? "",
  imagenPromocion: c.imagenBanner || c.imagenLogo || null,
  descripcion: c.descripcion,
  recinto: c.ubicacion ? { nombre: c.ubicacion } : null,
});

export default async function Page({ params }: Props) {
  const { eventoId } = await params;
  const conferencia = await getConferencia(eventoId);

  // Solo se emite JSON-LD si la conferencia resolvió; sin dato no se declara nada.
  // JSON-LD emitido con JSON.stringify: escapa el contenido, no hay vector de inyección.
  const jsonLd = conferencia
    ? construirEventJsonLd(
        conferenciaAJsonLd(conferencia),
        `${SITE_URL}/cosmotech/${eventoId}`,
      )
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <DetalleConferencia />
    </>
  );
}
