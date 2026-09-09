// Módulo PURO (sin `'use client'`) para el subconjunto Cabecera_Evento y su proyección.
//
// Vive fuera de `EventoDetalleView.tsx` a propósito: ese archivo es `'use client'`, y una función
// exportada desde un módulo de cliente NO puede invocarse desde un Server Component (Next.js la
// convierte en una referencia de cliente y lanza en tiempo de build/prerender). El Server Component
// `page.tsx` necesita llamar `proyectarCabeceraEvento` al resolver el evento, así que la proyección
// (y los tipos que arrastra) tienen que estar en un módulo neutro que ambos lados puedan importar.

// Tipos mínimos que la cabecera necesita del recinto y la ciudad del evento.
export interface Recinto {
  id: number;
  nombre: string;
  svg: string;
  direccion: string;
  esGeneral?: boolean;
}

export interface Ciudad {
  id: number;
  nombre: string;
}

// Subconjunto explícito que el servidor (Server Component `page.tsx`) pasa a la vista de cliente
// para pintar la cabecera y la imagen en el HTML inicial (ganancia de LCP, Req 26.1).
//
// CRÍTICO (Req 26.2 / venta doble): son EXACTAMENTE estas 6 claves. NUNCA se pasa el objeto
// `evento` completo, porque el detalle acarrea `secciones[].asientosDisponibles` cacheado ~5 min;
// servir un mapa de asientos de caché vendería el mismo asiento dos veces. La disponibilidad la
// pide la vista al montar con `cache: "no-store"` (tarea 3.2).
export interface CabeceraEvento {
  nombre: string;
  fecha: string;
  imagenPromocion: string;
  recinto: Recinto;
  ciudad: Ciudad;
  descripcion: string;
}

// Entrada del proyector: el evento resuelto por el servidor acarrea muchas más claves que las
// 6 de la cabecera (entre ellas `secciones[].asientosDisponibles`, cacheado ~5 min). Se tipa
// laxo a propósito porque la fuente es un DTO del backend sin tipo fuerte en el servidor.
export type EventoParaCabecera = {
  nombre: string;
  fecha: string;
  imagenPromocion: string;
  recinto: Recinto;
  ciudad: Ciudad;
  descripcion: string;
  [clave: string]: unknown;
};

// Proyección PURA del subconjunto Cabecera_Evento (Req 26.1). Se construye clave por clave a
// propósito: NUNCA `{ ...evento }`, porque el detalle acarrea `secciones[].asientosDisponibles`
// cacheado ~5 min y propagarlo al cliente permitiría vender el mismo asiento dos veces
// (Req 26.2 / venta doble). El resultado tiene EXACTAMENTE estas 6 claves; la disponibilidad la
// pide la vista al montar con `cache: "no-store"` (tarea 3.2).
//
// Se extrae como función pura (fuera del Server Component async y del módulo de cliente) para
// poder invocarla desde el servidor y verificar por propiedad que la proyección excluye la
// disponibilidad en todo nivel (Property 9, tarea 3.3).
export function proyectarCabeceraEvento(evento: EventoParaCabecera): CabeceraEvento {
  return {
    nombre: evento.nombre,
    fecha: evento.fecha,
    imagenPromocion: evento.imagenPromocion,
    recinto: evento.recinto,
    ciudad: evento.ciudad,
    descripcion: evento.descripcion,
  };
}
