import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { slugify } from "@/utils/slugify";

// Task 10.1 — tests del fetch de servidor CACHEADO de ciudades y paquetes de CityPass.
// Valida el patrón `fetch` opt-in de Next 16: TTL y tags correctos (Req 25.1, 25.2),
// la normalización del contrato de ciudades y el filtrado de paquetes vendibles.
//
// `apiBase()` exige `NEXT_PUBLIC_URL_BACKEND`; se fija antes de importar el módulo.
const BASE = "https://backend.test";
process.env.NEXT_PUBLIC_URL_BACKEND = BASE;
process.env.NEXT_PUBLIC_API_KEY = "k-test";

// React.cache memoiza por render; en tests basta con que sea identidad para que
// cada llamada ejecute el fetch y podamos inspeccionarlo.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: <T>(fn: T) => fn };
});

import {
  getCiudades,
  getLandingCityPass,
  getPaquetesCityPass,
  tagCityPass,
  TTL_CIUDADES,
  TTL_CITYPASS,
  TAG_CIUDADES,
} from "./getCityPass";

type FetchOpts = { next?: { revalidate?: number; tags?: string[] }; cache?: string };

const mockFetchOnce = (payload: unknown, ok = true) => {
  const fetchSpy = vi.fn(async () => ({
    ok,
    json: async () => payload,
  })) as unknown as typeof fetch;
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy as unknown as ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getCiudades — Req 25.1 (TTL 24 h, tag `ciudades`)", () => {
  it("usa force-cache con revalidate=86400 y tag `ciudades`", async () => {
    const fetchSpy = mockFetchOnce([{ id: 1, nombre: "Torreón" }]);

    const ciudades = await getCiudades();

    expect(ciudades).toEqual([{ id: 1, nombre: "Torreón" }]);
    const [url, opts] = fetchSpy.mock.calls[0] as [string, FetchOpts];
    expect(url).toBe(`${BASE}/api/v1/ciudades/get_all_ciudades`);
    expect(opts.cache).toBe("force-cache");
    expect(opts.next?.revalidate).toBe(TTL_CIUDADES);
    expect(TTL_CIUDADES).toBe(86_400);
    expect(opts.next?.tags).toEqual([TAG_CIUDADES]);
  });

  it("normaliza tanto arreglo directo como `{ ciudades: [...] }`", async () => {
    mockFetchOnce({ ciudades: [{ id: 2, nombre: "León" }] });
    expect(await getCiudades()).toEqual([{ id: 2, nombre: "León" }]);
  });

  it("devuelve [] ante respuesta no-ok o red caída (no rompe el cascarón)", async () => {
    mockFetchOnce(null, false);
    expect(await getCiudades()).toEqual([]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }) as unknown as typeof fetch,
    );
    expect(await getCiudades()).toEqual([]);
  });
});

describe("getLandingCityPass — Req 25.2 (TTL 1 h, tag `citypass:<slug>`)", () => {
  it("usa force-cache con revalidate=3600 y tags [`ciudades`, `citypass:<slug>`]", async () => {
    const fetchSpy = mockFetchOnce({ configurada: true, paquetes: [] });

    await getLandingCityPass(7, "torreon");

    const [url, opts] = fetchSpy.mock.calls[0] as [string, FetchOpts];
    expect(url).toBe(`${BASE}/api/v1/citypass/publico/landing?ciudadId=7`);
    expect(opts.cache).toBe("force-cache");
    expect(opts.next?.revalidate).toBe(TTL_CITYPASS);
    expect(TTL_CITYPASS).toBe(3_600);
    expect(opts.next?.tags).toEqual([TAG_CIUDADES, "citypass:torreon"]);
  });

  it("devuelve null ante respuesta no-ok o red caída", async () => {
    mockFetchOnce(null, false);
    expect(await getLandingCityPass(1, "leon")).toBeNull();
  });
});

describe("getPaquetesCityPass — solo paquetes indexables/vendibles", () => {
  it("filtra por `configurada:true` y `disponibleVenta:true`", async () => {
    mockFetchOnce({
      configurada: true,
      paquetes: [
        { id: 1, nombre: "Básico", disponibleVenta: true },
        { id: 2, nombre: "Agotado", disponibleVenta: false },
      ],
    });

    const paquetes = await getPaquetesCityPass({ id: 3, nombre: "Torreón" });

    expect(paquetes.map((p) => p.id)).toEqual([1]);
  });

  it("devuelve [] cuando la landing no está configurada", async () => {
    mockFetchOnce({ configurada: false });
    expect(await getPaquetesCityPass({ id: 4, nombre: "León" })).toEqual([]);
  });

  it("devuelve [] cuando el slug de la ciudad queda vacío", async () => {
    const fetchSpy = mockFetchOnce({ configurada: true, paquetes: [] });
    expect(await getPaquetesCityPass({ id: 5, nombre: "###" })).toEqual([]);
    // Sin slug válido no debe siquiera consultar la landing.
    expect(fetchSpy.mock.calls.length).toBe(0);
  });
});

describe("tagCityPass — el tag deriva de slugify(nombre) (coherente con sitemap y allowlist)", () => {
  it("produce `citypass:<slugify(nombre)>` para una tabla de nombres reales", () => {
    const nombres = ["Torreón", "Ciudad de México", "León", "San Luis Potosí", "Mérida"];
    for (const nombre of nombres) {
      const slug = slugify(nombre);
      const tag = tagCityPass(slug);
      expect(tag).toBe(`citypass:${slug}`);
      // El prefijo `citypass:` es el que la allowlist de /api/revalidate acepta.
      expect(tag.startsWith("citypass:")).toBe(true);
      expect(tag.length).toBeGreaterThan("citypass:".length);
    }
  });
});
