import { Reel, ReelEvento } from "../types";
import { rutaEvento, type EventoSlugInput, type FuncionSlugInput } from "../../utils/eventoSlug";

// Resolución del destino del CTA del reel según el contrato del backend
// (sección 7 del README de integración de contenido).
export type DestinoReel =
  | { tipo: "interno-detalle"; eventoId: number; evento: ReelEvento }
  | { tipo: "interno-fechas"; eventoId: number; evento: ReelEvento }
  | { tipo: "externo"; url: string }
  | { tipo: "ninguno" };

export const resolverDestino = (reel: Reel): DestinoReel => {
  const ev = reel?.evento;
  if (!ev) return { tipo: "ninguno" };
  if (ev.externo) return ev.url ? { tipo: "externo", url: ev.url } : { tipo: "ninguno" };
  if (ev.id == null) return { tipo: "ninguno" };
  if (ev.esMultiFuncion) return { tipo: "interno-fechas", eventoId: ev.id, evento: ev };
  return { tipo: "interno-detalle", eventoId: ev.id, evento: ev };
};

// El slug del evento solo usa el nombre; recinto, ciudad y fecha se quedan fuera a
// proposito porque alargan la URL y se leen mal al compartirla.
export const eventoSlugDeReel = (ev: ReelEvento): EventoSlugInput => ({
  id: ev.id ?? "",
  nombre: ev.nombre,
});

// Rutas internas de la app cliente. La app no tiene una ruta dedicada de
// "fechas": el detalle del evento (/eventos/:slug) ya resuelve la selección de
// función para eventos multifunción, por lo que ambos casos internos apuntan ahí.
export const RUTAS_REEL = {
  detalle: (ev: ReelEvento, funcion?: FuncionSlugInput | null) =>
    rutaEvento(eventoSlugDeReel(ev), funcion),
  fechas: (ev: ReelEvento) => rutaEvento(eventoSlugDeReel(ev)),
};

// URL de Google Maps para el botón "Ver mapa" (web).
export { mapsUrl } from "../../utils/mapsHelpers";
