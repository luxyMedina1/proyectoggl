import type { MetadataRoute } from "next";
import { buildEventoSlug, type EventoListaSlug, type FuncionSlugInput } from "@/utils/eventoSlug";
import { slugify } from "@/utils/slugify";
import { apiBase } from "@/lib/config/apiBase";

// Se regenera cada hora; no se calcula en cada petición del crawler.
export const revalidate = 3600;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";

// Fetch de servidor reutilizable para el sitemap. Fetch directo (no la
// instancia axios: sus interceptores leen localStorage/window). Cache opt-in
// de Next 16 (`force-cache` + `next: { revalidate, tags }`), timeout de 5 s y
// `catch → null` para que el backend caído no rompa el build.
const apiGet = async <T>(path: string, tags: string[]): Promise<T | null> => {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "" },
      cache: "force-cache",
      next: { revalidate: 3600, tags },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
};

// Evento del listado público, más el timestamp que el sitemap usa para `lastModified`.
type EventoSitemap = EventoListaSlug & { actualizadoEn?: string | null };

// Listado público de eventos. Si el backend no responde, el sitemap sale sólo
// con las rutas estáticas en vez de romper el build.
const getEventos = async (): Promise<EventoSitemap[]> => {
  const data = await apiGet<{ eventosFiltrados?: EventoSitemap[] }>(
    "/eventos/get_all_select?tipoDispositivo=web",
    ["eventos:lista"],
  );
  return data?.eventosFiltrados ?? [];
};

// Ciudades: el backend responde un arreglo directo o `{ ciudades: [...] }`
// (mismo contrato que `useCiudadesStore`).
export interface Ciudad {
  id: number;
  nombre: string;
}

// Paquete tal como llega en la landing de CityPass; solo interesan el nombre y
// la bandera de venta para decidir si es indexable.
export interface PaqueteLanding {
  nombre: string;
  disponibleVenta: boolean;
}

// Unión discriminada por `configurada`: solo las ciudades con CityPass
// configurado exponen paquetes indexables.
export type Landing = { configurada: false } | { configurada: true; paquetes?: PaqueteLanding[] };

// Mapper puro (sin I/O): a partir de las ciudades y su landing ya resuelta
// (por `ciudad.id`), construye las entradas de sitemap indexables. Es la lógica
// de filtrado/armado de URL aislada de `apiGet` para poder testearla con
// propiedades. Reglas:
//   - solo ciudades con slug no vacío (Req 4.4) y landing `configurada: true`
//     (Req 4.2, 4.6);
//   - solo paquetes con `disponibleVenta: true` y slug no vacío (Req 4.3);
//   - URLs con `slugify(ciudad.nombre)` / `slugify(paquete.nombre)`, exactamente
//     como `publicUi/pages/CityPassPage.tsx` (Req 4.4);
//   - una landing `null`/sin configurar se omite sin lanzar (Req 4.6).
export const construirRutasCityPass = (
  ciudades: Ciudad[],
  landingPorCiudad: (ciudadId: number) => Landing | null | undefined,
): MetadataRoute.Sitemap =>
  ciudades.flatMap((ciudad): MetadataRoute.Sitemap => {
    const ciudadSlug = slugify(ciudad.nombre);
    if (!ciudadSlug) return [];

    const landing = landingPorCiudad(ciudad.id);
    if (!landing?.configurada) return [];

    return [
      {
        url: `${SITE_URL}/citypass/${ciudadSlug}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      },
      ...(landing.paquetes ?? [])
        .filter((paquete) => paquete.disponibleVenta && slugify(paquete.nombre))
        .map((paquete) => ({
          url: `${SITE_URL}/citypass/${ciudadSlug}/paquete/${slugify(paquete.nombre)}`,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        })),
    ];
  });

// Descubrimiento server-side de las rutas de CityPass indexables. Consulta la
// lista de ciudades y, por cada una, su landing en paralelo, y delega el
// filtrado/armado de URL en `construirRutasCityPass` (puro). Omite sin fallar
// ante `null` o ciudad sin configurar.
const rutasCityPass = async (): Promise<MetadataRoute.Sitemap> => {
  const respuesta = await apiGet<Ciudad[] | { ciudades?: Ciudad[] }>("/ciudades/get_all_ciudades", [
    "ciudades",
  ]);
  const ciudades = Array.isArray(respuesta) ? respuesta : (respuesta?.ciudades ?? []);
  if (!ciudades.length) return [];

  // Landing por ciudad en paralelo; se indexa por `ciudad.id` para el mapper.
  const landings = await Promise.all(
    ciudades.map(async (ciudad): Promise<[number, Landing | null]> => {
      const ciudadSlug = slugify(ciudad.nombre);
      if (!ciudadSlug) return [ciudad.id, null];
      const landing = await apiGet<Landing>(`/citypass/publico/landing?ciudadId=${ciudad.id}`, [
        "ciudades",
        `citypass:${ciudadSlug}`,
      ]);
      return [ciudad.id, landing];
    }),
  );
  const landingPorCiudad = new Map(landings);

  return construirRutasCityPass(ciudades, (id) => landingPorCiudad.get(id));
};

// Construye las rutas de evento (cascarón + informacion) a partir del listado.
const construirRutasEventos = (eventos: EventoSitemap[]): MetadataRoute.Sitemap =>
  eventos.flatMap((evento) => {
    const lastModified = evento?.actualizadoEn ? new Date(evento.actualizadoEn) : undefined;
    const funciones: (FuncionSlugInput | null)[] = evento?.funciones?.length
      ? evento.funciones
      : [null];

    return [
      ...funciones.map((funcion) => ({
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

// Partición del sitemap (Req 6). Hoy una sola partición (id 0) que devuelve el
// conjunto completo; cuando el conteo de URLs se acerque al límite de 50.000 de
// Google, esta lista crece y `sitemap()` particiona por rango según el `id`.
export async function generateSitemaps(): Promise<{ id: number }[]> {
  return [{ id: 0 }];
}

// Firma de Next 16.0.0: `props.id` es ahora `Promise<string>` (ver
// node_modules/next/dist/docs/.../sitemap.md → "Version History"). Con una sola
// partición, `id === 0` y se devuelve el conjunto completo.
export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  // Hoy solo existe la partición 0; en el futuro, particionar por rango de `id`.
  void id;

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

  // Las dos fuentes no dependen entre sí: se resuelven en paralelo (Req 4.1).
  const [rutasEventos, rutasCP] = await Promise.all([
    getEventos().then(construirRutasEventos),
    rutasCityPass(),
  ]);

  return [...estaticas, ...rutasEventos, ...rutasCP];
}
