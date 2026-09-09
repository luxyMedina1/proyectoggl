import { cache } from "react";
import { apiBase } from "@/lib/config/apiBase";

// Detalle de conferencia (Cosmotech) resuelto en SERVIDOR y cacheado, para alimentar
// las <meta> Open Graph y el JSON-LD del cascarón `app/cosmotech/[eventoId]/page.tsx`
// desde el mismo dato (una sola petición por request gracias a `cache()`).
//
// Fetch DIRECTO (no la instancia axios de `api/apiApplication.ts`, cuyos interceptores
// leen `localStorage`/`window` y no existen en servidor). El componente hijo
// `DetalleConferencia` sigue siendo "use client" y vuelve a pedir los datos para
// renderizar la UI; este módulo solo sirve el cascarón de servidor.

// Subconjunto de la entidad de conferencia que consume el cascarón. El backend expone
// más campos; aquí solo se declaran los que usa la vista de servidor.
export interface ConferenciaDetalle {
  nombre?: string | null;
  fecha?: string | null;
  descripcion?: string | null;
  ubicacion?: string | null;
  imagenBanner?: string | null;
  imagenLogo?: string | null;
}

const TTL_CONFERENCIA = 300; // 5 min, igual que el `generateMetadata` previo.

export const getConferencia = cache(
  async (eventoId: string): Promise<ConferenciaDetalle | null> => {
    try {
      const res = await fetch(`${apiBase()}/eventos/conferencia/detalle/${eventoId}`, {
        headers: { "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "" },
        cache: "force-cache",
        next: { revalidate: TTL_CONFERENCIA },
        // Si el backend no responde, no demorar el render (cae a los fallbacks).
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      return (await res.json()) as ConferenciaDetalle;
    } catch {
      return null;
    }
  },
);
