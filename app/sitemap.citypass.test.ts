import { describe, it, expect } from "vitest";
import { slugify } from "@/utils/slugify";
import {
  construirRutasCityPass,
  SITE_URL,
  type Ciudad,
  type Landing,
  type PaqueteLanding,
} from "./sitemap";

// Feature: mejoras-extra-migracion, Property 6: El sitemap solo declara CityPass indexable con URLs slugify-correctas
// Validates: Requirements 4.2, 4.3, 4.4, 4.6
//
// Para todo conjunto de ciudades y sus landings, `construirRutasCityPass`:
//   - produce URL de ciudad solo para landings `configurada: true` (Req 4.2, 4.6);
//   - produce URL de paquete solo para paquetes con `disponibleVenta: true` y slug
//     no vacío (Req 4.3);
//   - cada URL usa exactamente `slugify(ciudad.nombre)` / `slugify(paquete.nombre)`
//     (Req 4.4), coherente con `publicUi/pages/CityPassPage.tsx`;
//   - omite sin lanzar ante landing `null`/sin configurar o ciudad sin slug (Req 4.6).
//
// fast-check no está instalado en este proyecto; se usa un generador determinista
// (PRNG con semilla) para producir >=100 escenarios variados y reproducibles, que
// combinan `configurada` true/false, `disponibleVenta` true/false y nombres
// vacíos/válidos. Un oráculo independiente recalcula el conjunto esperado.

// PRNG mulberry32: determinista y sembrable -> un contraejemplo es reproducible.
const prng = (semilla: number) => () => {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Nombres que ejercitan slugify: acentos, mayúsculas, espacios dobles, símbolos,
// cadenas que colapsan a slug vacío ("", "---", "  ") y colisiones tras slugify.
const NOMBRES_CIUDAD = [
  "Ciudad de México",
  "Monterrey",
  "Guadalajara",
  "  San  Luis  Potosí  ",
  "Cancún",
  "",
  "---",
  "   ",
  "León",
  "Querétaro 2025 !!!",
];

const NOMBRES_PAQUETE = [
  "Paquete Básico",
  "Premium VIP",
  "Todo Incluido 2025",
  "  Family  Pass  ",
  "",
  "###",
  "Ñoño Deluxe",
  "Combo",
];

const generarPaquete = (rand: () => number): PaqueteLanding => ({
  nombre: NOMBRES_PAQUETE[Math.floor(rand() * NOMBRES_PAQUETE.length)],
  disponibleVenta: rand() < 0.6, // mezcla de true/false
});

// Genera una landing por ciudad: a veces null (backend no respondió / 404),
// a veces `configurada: false`, a veces configurada con 0..N paquetes.
const generarLanding = (rand: () => number): Landing | null => {
  const r = rand();
  if (r < 0.2) return null; // omitir sin fallar
  if (r < 0.45) return { configurada: false };
  const n = Math.floor(rand() * 5); // 0..4 paquetes
  return {
    configurada: true,
    paquetes: Array.from({ length: n }, () => generarPaquete(rand)),
  };
};

interface Escenario {
  ciudades: Ciudad[];
  landingPorCiudad: (ciudadId: number) => Landing | null | undefined;
}

const generarEscenario = (semilla: number): Escenario => {
  const rand = prng(semilla);
  const nCiudades = Math.floor(rand() * 8); // 0..7 ciudades
  const idsVistos = new Set<number>();
  const ciudades: Ciudad[] = [];
  const landings = new Map<number, Landing | null>();

  for (let i = 0; i < nCiudades; i++) {
    // ids únicos para poder indexar la landing por id sin colisiones.
    let id = Math.floor(rand() * 100000) + 1;
    while (idsVistos.has(id)) id += 1;
    idsVistos.add(id);
    const nombre = NOMBRES_CIUDAD[Math.floor(rand() * NOMBRES_CIUDAD.length)];
    ciudades.push({ id, nombre });
    landings.set(id, generarLanding(rand));
  }

  return {
    ciudades,
    landingPorCiudad: (ciudadId: number) => landings.get(ciudadId),
  };
};

// Oráculo independiente: recalcula el conjunto de URLs esperado siguiendo las
// reglas del requisito, sin reutilizar el código bajo prueba.
const urlsEsperadas = (esc: Escenario): string[] => {
  const urls: string[] = [];
  for (const ciudad of esc.ciudades) {
    const ciudadSlug = slugify(ciudad.nombre);
    if (!ciudadSlug) continue; // Req 4.4: sin slug válido, no hay URL
    const landing = esc.landingPorCiudad(ciudad.id);
    if (!landing || landing.configurada !== true) continue; // Req 4.2, 4.6
    urls.push(`${SITE_URL}/citypass/${ciudadSlug}`);
    for (const paquete of landing.paquetes ?? []) {
      const paqueteSlug = slugify(paquete.nombre);
      if (!paquete.disponibleVenta || !paqueteSlug) continue; // Req 4.3
      urls.push(`${SITE_URL}/citypass/${ciudadSlug}/paquete/${paqueteSlug}`);
    }
  }
  return urls;
};

describe("Property 6: el sitemap solo declara CityPass indexable con URLs slugify-correctas", () => {
  it("coincide con el oráculo para >=100 escenarios generados (Req 4.2, 4.3, 4.4, 4.6)", () => {
    const NUM_ESCENARIOS = 150;
    expect(NUM_ESCENARIOS).toBeGreaterThanOrEqual(100);

    for (let semilla = 1; semilla <= NUM_ESCENARIOS; semilla++) {
      const esc = generarEscenario(semilla);

      const rutas = construirRutasCityPass(esc.ciudades, esc.landingPorCiudad);
      const urls = rutas.map((r) => r.url);

      // El conjunto de URLs coincide exactamente con el recalculado por el oráculo.
      expect(urls).toEqual(urlsEsperadas(esc));
    }
  });

  it("toda URL declarada proviene de una ciudad indexable con slug no vacío (Req 4.2, 4.4, 4.6)", () => {
    for (let semilla = 1; semilla <= 150; semilla++) {
      const esc = generarEscenario(semilla);
      const rutas = construirRutasCityPass(esc.ciudades, esc.landingPorCiudad);

      // Slugs de ciudad que SÍ son indexables (configurada:true y slug no vacío).
      // Nota: nombres distintos pueden colapsar al mismo slug; por eso se razona
      // sobre el conjunto de slugs indexables, no ciudad por ciudad.
      const slugsIndexables = new Set(
        esc.ciudades
          .filter((c) => {
            const s = slugify(c.nombre);
            const l = esc.landingPorCiudad(c.id);
            return Boolean(s) && l?.configurada === true;
          })
          .map((c) => slugify(c.nombre)),
      );

      for (const ruta of rutas) {
        const resto = ruta.url.replace(`${SITE_URL}/citypass/`, "");
        const ciudadSlug = resto.split("/")[0];
        // Cada URL declarada debe pertenecer a un slug de ciudad indexable.
        expect(slugsIndexables.has(ciudadSlug)).toBe(true);
      }
    }
  });

  it("solo declara paquetes disponibles con slug no vacío, y con URL slugify-correcta (Req 4.3, 4.4)", () => {
    for (let semilla = 1; semilla <= 150; semilla++) {
      const esc = generarEscenario(semilla);
      const rutas = construirRutasCityPass(esc.ciudades, esc.landingPorCiudad);
      const urls = new Set(rutas.map((r) => r.url));

      // Conjunto de URLs de paquete que DEBEN existir según el requisito. Se
      // agrega por conjunto (no por ítem) porque distintos paquetes/ciudades
      // pueden colapsar a la misma URL tras slugify.
      const urlsPaqueteEsperadas = new Set<string>();
      for (const ciudad of esc.ciudades) {
        const ciudadSlug = slugify(ciudad.nombre);
        const landing = esc.landingPorCiudad(ciudad.id);
        if (!ciudadSlug || landing?.configurada !== true) continue;
        for (const paquete of landing.paquetes ?? []) {
          const paqueteSlug = slugify(paquete.nombre);
          if (paquete.disponibleVenta && paqueteSlug) {
            urlsPaqueteEsperadas.add(
              `${SITE_URL}/citypass/${ciudadSlug}/paquete/${paqueteSlug}`,
            );
          }
        }
      }

      // Todas las esperadas están presentes (Req 4.3, 4.4).
      for (const url of urlsPaqueteEsperadas) {
        expect(urls.has(url)).toBe(true);
      }

      // Y toda URL de paquete declarada estaba en el conjunto esperado: nunca se
      // declara un paquete no disponible o con slug vacío (Req 4.3).
      for (const ruta of rutas) {
        if (ruta.url.includes("/paquete/")) {
          expect(urlsPaqueteEsperadas.has(ruta.url)).toBe(true);
        }
      }
    }
  });

  it("todas las URLs generadas usan exactamente slugify() (Req 4.4)", () => {
    for (let semilla = 1; semilla <= 150; semilla++) {
      const esc = generarEscenario(semilla);
      const rutas = construirRutasCityPass(esc.ciudades, esc.landingPorCiudad);

      for (const ruta of rutas) {
        const resto = ruta.url.replace(`${SITE_URL}/citypass/`, "");
        const segmentos = resto.split("/"); // [ciudadSlug] o [ciudadSlug, "paquete", paqueteSlug]
        // Cada segmento de slug es idempotente bajo slugify y no vacío.
        expect(segmentos[0]).toBe(slugify(segmentos[0]));
        expect(segmentos[0]).not.toBe("");
        if (segmentos.length === 3) {
          expect(segmentos[1]).toBe("paquete");
          expect(segmentos[2]).toBe(slugify(segmentos[2]));
          expect(segmentos[2]).not.toBe("");
        }
      }
    }
  });

  it("no lanza ante entradas degeneradas (lista vacía, landing null/undefined)", () => {
    expect(construirRutasCityPass([], () => null)).toEqual([]);
    expect(
      construirRutasCityPass([{ id: 1, nombre: "Monterrey" }], () => null),
    ).toEqual([]);
    expect(
      construirRutasCityPass([{ id: 1, nombre: "Monterrey" }], () => undefined),
    ).toEqual([]);
    // Ciudad con slug vacío nunca produce URL, aunque su landing esté configurada.
    expect(
      construirRutasCityPass([{ id: 1, nombre: "---" }], () => ({
        configurada: true,
        paquetes: [{ nombre: "Premium", disponibleVenta: true }],
      })),
    ).toEqual([]);
  });
});
