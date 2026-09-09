import { describe, it, expect, afterEach } from "vitest";

// Feature: mejoras-extra-migracion, Property 7: `apiBase()` de servidor falla de forma visible
// Validates: Requirements 24.1, 24.2
//
// Para todo estado del entorno, apiBase() de servidor devuelve
// `${NEXT_PUBLIC_URL_BACKEND}/api/v1` cuando la variable esta definida, y lanza
// un error con mensaje `Falta NEXT_PUBLIC_URL_BACKEND` cuando no lo esta
// (nunca devuelve un fallback relativo en servidor).
//
// fast-check no esta instalado en este proyecto; se usa una tabla dirigida con
// muchos valores generados (>=100 iteraciones) sobre el espacio de entrada
// relevante: la variable definida (dominios/URLs arbitrarios), indefinida y vacia.
import { apiBase } from "./apiBase";

// Guardamos y restauramos process.env para no filtrar estado entre tests ni al resto de la suite.
const ORIGINAL = process.env.NEXT_PUBLIC_URL_BACKEND;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.NEXT_PUBLIC_URL_BACKEND;
  } else {
    process.env.NEXT_PUBLIC_URL_BACKEND = ORIGINAL;
  }
});

// Generador determinista de URLs base plausibles. Constrena al espacio de entrada
// razonable (esquema + host + puerto/ruta opcionales) sin dependencias externas.
const schemes = ["https://", "http://"] as const;
const hosts = [
  "api.taquillavip.com",
  "backend.example.org",
  "localhost",
  "10.0.0.5",
  "staging-api.taquilla-v2.io",
  "mi-backend.internal",
];
const suffixes = ["", ":3000", ":8080", "/v2", "/backend", "/proxy/x"];

function genDefinedValues(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const scheme = schemes[i % schemes.length];
    const host = hosts[(i * 7 + 3) % hosts.length];
    const suffix = suffixes[(i * 5 + 1) % suffixes.length];
    out.push(`${scheme}${host}${suffix}`);
  }
  return out;
}

describe("Property 7: apiBase() de servidor falla de forma visible", () => {
  it("devuelve `${NEXT_PUBLIC_URL_BACKEND}/api/v1` para toda variable definida (>=100 casos)", () => {
    const values = genDefinedValues(120);
    expect(values.length).toBeGreaterThanOrEqual(100);

    for (const url of values) {
      process.env.NEXT_PUBLIC_URL_BACKEND = url;
      const result = apiBase();

      // Devuelve exactamente la composicion esperada.
      expect(result).toBe(`${url}/api/v1`);
      // Nunca un fallback relativo en servidor.
      expect(result).not.toBe("/api/v1");
      expect(result.startsWith("/api/v1")).toBe(false);
    }
  });

  it("lanza `Falta NEXT_PUBLIC_URL_BACKEND` cuando la variable no esta definida o esta vacia (>=100 casos)", () => {
    // Estados que se consideran "no definida" por la comprobacion `if (!url)`:
    // undefined y cadena vacia. Se repiten para cumplir el minimo de iteraciones.
    const missingStates: Array<undefined | ""> = [];
    for (let i = 0; i < 120; i++) {
      missingStates.push(i % 2 === 0 ? undefined : "");
    }
    expect(missingStates.length).toBeGreaterThanOrEqual(100);

    for (const state of missingStates) {
      if (state === undefined) {
        delete process.env.NEXT_PUBLIC_URL_BACKEND;
      } else {
        process.env.NEXT_PUBLIC_URL_BACKEND = state;
      }

      // Lanza y nunca devuelve un fallback relativo.
      expect(() => apiBase()).toThrow("Falta NEXT_PUBLIC_URL_BACKEND");
    }
  });
});
