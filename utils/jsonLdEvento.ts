import { textoPlano } from "@/utils/sanitizeHtml"; // reutiliza el sanitizador existente

// Subconjunto de la entidad de evento ya resuelta que necesita el JSON-LD.
// El helper es puro y sin I/O: recibe la entidad y devuelve el objeto schema.org,
// por eso es testeable con propiedades.
export interface EventoParaJsonLd {
  nombre: string;
  fecha: string; // startDate de la función
  imagenPromocion?: string | null;
  descripcion?: string | null;
  precioBase?: string | number | null;
  recinto?: { nombre?: string | null; direccion?: string | null } | null;
  ciudad?: { nombre?: string | null } | null;
  artista?: { nombre?: string | null } | null;
}

/**
 * Construye el schema `Event` de schema.org a partir de una entidad de evento resuelta.
 *
 * `disponibilidad` es intencionadamente un tri-estado:
 *   - `true`      -> `availability: InStock`
 *   - `false`     -> `availability: SoldOut`
 *   - `undefined` -> se OMITE `availability` por completo
 *
 * Regla dura (Req 1.3/1.4): NUNCA se fija `InStock`. `availability` solo se declara cuando
 * hay un dato de disponibilidad fresco calculado en el momento, jamás un valor por defecto.
 *
 * El resultado se emite como `<script type="application/ld+json">` con `JSON.stringify`,
 * que escapa el contenido: no hay vector de inyección.
 */
export const construirEventJsonLd = (
  evento: EventoParaJsonLd,
  url: string,
  disponibilidad?: boolean,
) => {
  const offers: Record<string, unknown> = {
    "@type": "AggregateOffer",
    priceCurrency: "MXN",
    lowPrice: evento.precioBase ?? undefined,
    url,
  };

  // Solo se declara availability si hay dato fresco. Nunca se fija InStock.
  if (disponibilidad !== undefined) {
    offers.availability = disponibilidad
      ? "https://schema.org/InStock"
      : "https://schema.org/SoldOut";
  }

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: evento.nombre,
    startDate: evento.fecha,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    image: evento.imagenPromocion ? [evento.imagenPromocion] : undefined,
    description: evento.descripcion ? textoPlano(evento.descripcion) : undefined,
    location: {
      "@type": "Place",
      name: evento.recinto?.nombre,
      address: {
        "@type": "PostalAddress",
        streetAddress: evento.recinto?.direccion,
        addressLocality: evento.ciudad?.nombre,
        addressCountry: "MX",
      },
    },
    performer: evento.artista?.nombre
      ? { "@type": "PerformingGroup", name: evento.artista.nombre }
      : undefined,
    offers,
  };
};

// --- Emisión multifecha (Req 1.5) ---

import { rutaEvento, type EventoSlugInput, type FuncionSlugInput } from "@/utils/eventoSlug";

// Entidad de evento resuelta que necesita la emisión multifecha: lo que pide el JSON-LD
// (EventoParaJsonLd) más lo que pide la construcción de la URL (EventoSlugInput) y la lista
// de funciones. El detalle resuelto por getEvento cumple esta forma.
export type EventoConFunciones = EventoParaJsonLd &
  EventoSlugInput & {
    funciones?: FuncionSlugInput[] | null;
  };

/**
 * Construye el/los objetos JSON-LD `Event` para el cascarón de un evento (Req 1.5).
 *
 * En un evento multifecha se emite un `Event` por función, cada uno con su propio `startDate`
 * (la fecha de la función) y su URL absoluta (buildEventoSlug con la función). Si el evento no
 * tiene funciones, se emite un único `Event` con `evento.fecha` y la URL base del evento.
 *
 * Es decir: para N funciones (N >= 0) se emiten exactamente `max(N, 1)` bloques `Event`.
 *
 * CRÍTICO: la disponibilidad se deja `undefined` a propósito. El cascarón no tiene un dato de
 * disponibilidad fresco (el detalle está cacheado ~5 min), así que `availability` se OMITE del
 * schema. Nunca se declara `InStock` aquí (Req 1.3/1.4).
 *
 * Función pura (sin I/O): recibe la entidad de evento y el origen del sitio, y devuelve los
 * objetos schema.org. Extraída aparte para poder testearla sin arrastrar el Server Component
 * de la página (que importa next/navigation, etc.).
 */
export const construirEventosJsonLd = (
  evento: EventoConFunciones,
  siteUrl: string,
): Record<string, unknown>[] => {
  const funciones: FuncionSlugInput[] = Array.isArray(evento?.funciones)
    ? evento.funciones
    : [];

  if (funciones.length === 0) {
    return [construirEventJsonLd(evento, `${siteUrl}${rutaEvento(evento)}`)];
  }

  return funciones.map((funcion) =>
    construirEventJsonLd(
      { ...evento, fecha: funcion.fecha ?? evento.fecha },
      `${siteUrl}${rutaEvento(evento, funcion)}`,
    ),
  );
};
