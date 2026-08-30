import { cache } from "react";
import type { ConfigResponse } from "@/context/ColorContext";

// Configuración de marca (/configuraciones/detail/1) leída EN EL SERVIDOR.
//
// Antes salía del navegador en un useEffect de ColorContext, así que el logo, los
// colores, el título y los pixels esperaban un fetch del cliente y se veía el salto
// de colores por defecto → marca en cada carga. Ahora entra en el HTML inicial y
// alimenta también a generateMetadata del layout raíz.
//
// No se usa la instancia axios (sus interceptores leen localStorage/window).

export const TAG_CONFIG = "config:sitio";

export interface BrandColors {
  emphasis: string;
  accentBase: string;
  accentLight: string;
  neutral: string;
  darker: string;
}

export const DEFAULT_COLORS: BrandColors = {
  emphasis: "#0E1A3D",
  accentBase: "#1A56DB",
  accentLight: "#38BDF8",
  neutral: "#F8FAFC",
  darker: "#1E293B",
};

const esHex = (c?: string | null): c is string =>
  !!c && /^#([0-9a-f]{3}){1,2}$/i.test(c);

const validarColores = (c: Record<string, unknown>): BrandColors => ({
  emphasis: esHex(c.enfasis as string) ? (c.enfasis as string) : DEFAULT_COLORS.emphasis,
  accentBase: esHex(c.acentoBase as string) ? (c.acentoBase as string) : DEFAULT_COLORS.accentBase,
  accentLight: esHex(c.acentoBajo as string) ? (c.acentoBajo as string) : DEFAULT_COLORS.accentLight,
  neutral: esHex(c.neutro as string) ? (c.neutro as string) : DEFAULT_COLORS.neutral,
  darker: esHex(c.fondo as string) ? (c.fondo as string) : DEFAULT_COLORS.darker,
});

const apiBase = (): string => {
  const url = process.env.NEXT_PUBLIC_URL_BACKEND;
  return url ? `${url}/api/v1` : "/api/v1";
};

// cache() de React: una sola ejecución por render. El layout y generateMetadata
// la llaman por separado y comparten el resultado (no se duplica la petición).
export const getSiteConfig = cache(
  async (): Promise<{ config: ConfigResponse | null; colors: BrandColors }> => {
    try {
      const res = await fetch(`${apiBase()}/configuraciones/detail/1`, {
        headers: { "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "" },
        // 1 h de red de seguridad; la invalidación real la dispara el backend
        // vía POST /api/revalidate con el tag config:sitio (ver doc 03).
        cache: "force-cache",
        next: { revalidate: 3600, tags: [TAG_CONFIG] },
        // Timeout amplio: esto corre en `next build` prerenderizando las rutas
        // estáticas. Un abort corto ahí hornea el fallback de marca durante toda
        // la ventana de revalidación. En build no hay latencia de usuario que
        // proteger; solo se corta si el backend está de verdad caído.
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`config HTTP ${res.status}`);
      const config = (await res.json()) as ConfigResponse;
      return { config, colors: validarColores(config as Record<string, unknown>) };
    } catch (err) {
      // La marca no puede tumbar el sitio: se cae a los colores por defecto.
      console.error("[config] no se pudo cargar la configuración de marca:", err);
      return { config: null, colors: DEFAULT_COLORS };
    }
  },
);
