import { textoPlano } from "@/utils/sanitizeHtml"; // reutiliza el sanitizador existente

// Subconjunto del paquete de CityPass ya resuelto que necesita el JSON-LD `Product`.
// Es intencionadamente laxo: acepta tanto `CityPassPaqueteDetalle` como
// `CityPassPaqueteLanding` (ambos exponen nombre, descripcion, imagen, precios y la
// bandera de venta), para que el helper sirva tanto a la landing como al detalle de
// paquete sin acoplarse a una forma concreta.
export interface PaqueteParaJsonLd {
  nombre: string;
  descripcion?: string | null;
  imagenPrincipal?: string | null;
  // Precios por tipo de boleto; el `lowPrice` del Offer se deriva del menor.
  precios?: { precio: number }[] | null;
  // Tri-estado de disponibilidad de venta (ver regla dura abajo).
  disponibleVenta?: boolean;
}

// Menor precio de la lista, o `undefined` si no hay precios. Se ignoran valores no
// finitos por defensa ante datos sucios del backend.
const menorPrecio = (precios?: { precio: number }[] | null): number | undefined => {
  if (!Array.isArray(precios) || precios.length === 0) return undefined;
  const validos = precios
    .map((p) => p?.precio)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (validos.length === 0) return undefined;
  return Math.min(...validos);
};

/**
 * Construye el schema `Product` de schema.org a partir de un paquete de CityPass resuelto.
 *
 * El paquete es un producto comercial (un pase con acceso a N atracciones), no un evento
 * con fecha/lugar, así que el `@type` es `Product` con un `offers` de tipo `Offer` — a
 * diferencia del `Event`/`AggregateOffer` de `construirEventJsonLd`.
 *
 * Regla dura de disponibilidad, idéntica a `construirEventJsonLd` (Req 1.3/1.4): NUNCA se
 * fija `InStock` por defecto. `disponibleVenta` es tri-estado:
 *   - `undefined` -> se OMITE `availability`
 *   - `true`      -> `availability: InStock`
 *   - `false`     -> `availability: SoldOut`
 *
 * El resultado se emite como `<script type="application/ld+json">` con `JSON.stringify`,
 * que escapa el contenido: no hay vector de inyección.
 */
export const construirProductJsonLd = (paquete: PaqueteParaJsonLd, url: string) => {
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    priceCurrency: "MXN",
    price: menorPrecio(paquete.precios),
    url,
  };

  // Solo se declara availability si hay dato de venta. Nunca se fija InStock por defecto.
  if (paquete.disponibleVenta !== undefined) {
    offers.availability = paquete.disponibleVenta
      ? "https://schema.org/InStock"
      : "https://schema.org/SoldOut";
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: paquete.nombre,
    image: paquete.imagenPrincipal ? [paquete.imagenPrincipal] : undefined,
    description: paquete.descripcion ? textoPlano(paquete.descripcion) : undefined,
    offers,
  };
};
