import type { MetadataRoute } from "next";
import { buildEventoSlug } from "@/utils/eventoSlug";

// Se regenera cada hora; no se calcula en cada petición del crawler.
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";

const apiBase = (): string => {
  const url = process.env.NEXT_PUBLIC_URL_BACKEND;
  return url ? `${url}/api/v1` : "/api/v1";
};

// Listado público de eventos. Fetch directo (no la instancia axios: sus
// interceptores leen localStorage/window). Si el backend no responde, el
// sitemap sale sólo con las rutas estáticas en vez de romper el build.
const getEventos = async (): Promise<any[]> => {
  try {
    const res = await fetch(
      `${apiBase()}/eventos/get_all_select?tipoDispositivo=web`,
      {
        headers: { "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "" },
        cache: "force-cache",
        next: { revalidate: 3600, tags: ["eventos:lista"] },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data?.eventosFiltrados ?? [];
  } catch {
    return [];
  }
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    "",
    "/eventos",
    "/explorar",
    "/legales/terminos_y_condiciones",
    "/legales/aviso_de_privacidad",
    "/legales/nuestras_politicas",
    "/legales/eliminacion_de_cuenta",
  ].map((ruta) => ({
    url: `${SITE_URL}${ruta}`,
    changeFrequency: "weekly" as const,
  }));

  const eventos = await getEventos();

  // Una entrada por función: cada fecha de un multifecha es una URL distinta.
  const rutasEventos: MetadataRoute.Sitemap = eventos.flatMap((evento) => {
    const lastModified = evento?.actualizadoEn
      ? new Date(evento.actualizadoEn)
      : undefined;
    const funciones = evento?.funciones?.length ? evento.funciones : [null];

    return [
      ...funciones.map((funcion: any) => ({
        url: `${SITE_URL}/eventos/${buildEventoSlug(evento, funcion)}`,
        lastModified,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      {
        url: `${SITE_URL}/eventos/informacion/${buildEventoSlug(evento)}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      },
    ];
  });

  return [...estaticas, ...rutasEventos];
}
