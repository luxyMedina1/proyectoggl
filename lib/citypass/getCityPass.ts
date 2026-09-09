import { cache } from "react";
import { apiBase } from "@/lib/config/apiBase";
import { slugify } from "@/utils/slugify";
import type { Ciudad } from "@/types/Ciudad";
import type { CityPassLanding, CityPassPaqueteLanding } from "@/types/CityPass";

// Fetch de servidor CACHEADO para ciudades y paquetes de CityPass (Req 25.1, 25.2).
//
// Se usa el patrón `fetch` opt-in de Next 16 (`cache: "force-cache"` +
// `next: { revalidate, tags }`), ya establecido en `lib/config/getSiteConfig.ts` y
// `app/sitemap.ts`. Fetch DIRECTO (no la instancia axios de `api/apiApplication.ts`,
// cuyos interceptores leen `localStorage`/`window` y no existen en servidor).
//
// Los consumidores de cliente actuales (`useCiudadesStore`, `useCityPassStore`) NO
// se tocan: siguen sirviendo las pantallas privadas / islas de cliente. Este módulo
// es la ruta de servidor cacheada para los cascarones de `(site)` (ver nota de
// adopción al final).

// TTLs y tags acordados en el diseño (sección 3.2). Los tres tags ya están en la
// allowlist de `app/api/revalidate/route.ts` (`ciudades` exacto, prefijo `citypass:`),
// así que el backend puede invalidarlos desde el primer día.
export const TTL_CIUDADES = 86_400; // 24 h
export const TTL_CITYPASS = 3_600; // 1 h
export const TAG_CIUDADES = "ciudades";

// El tag por ciudad se deriva de `slugify(ciudad.nombre)`, coherente con el sitemap
// y con la UI (`publicUi/pages/CityPassPage.tsx`).
export const tagCityPass = (ciudadSlug: string): string => `citypass:${ciudadSlug}`;

const headers = () => ({ "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "" });

// Ciudades: TTL 24 h, tag `ciudades`. El backend responde un arreglo directo o
// `{ ciudades: [...] }` (mismo contrato que `useCiudadesStore`). Si el backend no
// responde, se devuelve `[]` para no tumbar el cascarón que la consuma.
export const getCiudades = cache(async (): Promise<Ciudad[]> => {
  try {
    const res = await fetch(`${apiBase()}/ciudades/get_all_ciudades`, {
      headers: headers(),
      cache: "force-cache",
      next: { revalidate: TTL_CIUDADES, tags: [TAG_CIUDADES] },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Ciudad[] | { ciudades?: Ciudad[] };
    if (Array.isArray(data)) return data;
    return Array.isArray(data?.ciudades) ? data.ciudades : [];
  } catch {
    return [];
  }
});

// Landing público de una ciudad (contiene los paquetes de CityPass): TTL 1 h, tag
// `citypass:<ciudadSlug>` (además de `ciudades`, para poder invalidar en cascada).
// El slug se pasa explícito para que el tag coincida con el que usa el sitemap y
// con el que el backend invalida. Devuelve `null` ante fallo o ciudad inexistente.
export const getLandingCityPass = cache(
  async (ciudadId: number, ciudadSlug: string): Promise<CityPassLanding | null> => {
    try {
      const res = await fetch(`${apiBase()}/citypass/publico/landing?ciudadId=${ciudadId}`, {
        headers: headers(),
        cache: "force-cache",
        next: {
          revalidate: TTL_CITYPASS,
          tags: [TAG_CIUDADES, tagCityPass(ciudadSlug)],
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return (await res.json()) as CityPassLanding;
    } catch {
      return null;
    }
  },
);

// Azúcar: los paquetes indexables/vendibles de una ciudad. Solo devuelve paquetes
// de una landing `configurada: true` y `disponibleVenta: true`. Útil para el
// cascarón de `citypass/[slug]` y para el sitemap si se migra a este helper.
export const getPaquetesCityPass = cache(
  async (ciudad: Ciudad): Promise<CityPassPaqueteLanding[]> => {
    const ciudadSlug = slugify(ciudad.nombre);
    if (!ciudadSlug) return [];
    const landing = await getLandingCityPass(ciudad.id, ciudadSlug);
    if (!landing?.configurada) return [];
    return landing.paquetes.filter((paquete) => paquete.disponibleVenta);
  },
);

// ---------------------------------------------------------------------------
// Nota de adopción (server-first incremental):
//
// El layout `app/(site)/layout.tsx` es hoy `'use client'` (consume Redux, contextos
// de marca/auth y `useRouter`), así que NO puede llamar a estos helpers de servidor
// tal cual: migrarlo entero está fuera del alcance de esta tarea (Req 27, "server
// primero" incremental). Cuando el header se parta en un cascarón de servidor + isla
// de cliente, `getCiudades()` alimenta el selector de ciudad desde el HTML inicial
// (hoy lo pide `useCiudadesStore` en un `useEffect`).
//
// El cascarón de `citypass/[slug]` (Server Component) es el consumidor inmediato de
// `getLandingCityPass` / `getPaquetesCityPass` para sembrar el HTML indexable con la
// disponibilidad cacheada 1 h e invalidable por tag `citypass:<slug>`.
// ---------------------------------------------------------------------------
