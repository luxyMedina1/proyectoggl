import { describe, it, expect } from "vitest";
import { construirEventJsonLd, type EventoParaJsonLd } from "@/utils/jsonLdEvento";

// Feature: mejoras-extra-migracion, Property 2: `availability` refleja la frescura del cálculo
// Validates: Requirements 1.3, 1.4
//
// Para todo evento, el `offers` del JSON-LD OMITE `availability` cuando la disponibilidad no
// puede calcularse con datos frescos (`disponibilidad === undefined`), y cuando se declara, su
// valor se deriva del cálculo en el momento (`InStock` si disponible, `SoldOut` si no), nunca
// de un valor fijo.
//
// fast-check no está instalado en el repo: se usa una tabla determinista con generadores
// pseudoaleatorios sembrados (LCG) para recorrer >=100 iteraciones del espacio de entrada.

const IN_STOCK = "https://schema.org/InStock";
const SOLD_OUT = "https://schema.org/SoldOut";

// PRNG determinista (LCG de Numerical Recipes) — sin dependencias externas y reproducible.
function crearRng(semilla: number) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 0x100000000;
  };
}

// Genera una entidad de evento variada para no atar la propiedad a un único evento.
function generarEvento(rng: () => number): EventoParaJsonLd {
  const idx = Math.floor(rng() * 1000);
  const conRecinto = rng() > 0.3;
  const conCiudad = rng() > 0.3;
  const conPrecio = rng() > 0.4;
  return {
    nombre: `Evento ${idx}`,
    fecha: `2025-0${1 + (idx % 9)}-1${idx % 9}T20:00:00`,
    imagenPromocion: rng() > 0.5 ? `https://cdn/img${idx}.jpg` : null,
    descripcion: rng() > 0.5 ? `Descripción ${idx}` : null,
    precioBase: conPrecio ? (idx % 2 === 0 ? idx : String(idx)) : null,
    recinto: conRecinto ? { nombre: `Recinto ${idx}`, direccion: `Calle ${idx}` } : null,
    ciudad: conCiudad ? { nombre: `Ciudad ${idx}` } : null,
    artista: rng() > 0.5 ? { nombre: `Artista ${idx}` } : null,
  };
}

// Los tres estados del tri-estado `disponibilidad` con su expectativa sobre `availability`.
const casos: Array<{ disponibilidad: boolean | undefined; esperado: string | null }> = [
  { disponibilidad: undefined, esperado: null }, // omitido: la clave NO debe existir
  { disponibilidad: true, esperado: IN_STOCK },
  { disponibilidad: false, esperado: SOLD_OUT },
];

describe("construirEventJsonLd — Property 2: `availability` refleja la frescura del cálculo", () => {
  it("omite availability sii disponibilidad === undefined; deriva InStock/SoldOut cuando se declara (>=100 iteraciones)", () => {
    const rng = crearRng(0x2b2b2b);
    let iteraciones = 0;

    // 40 eventos x 3 estados = 120 iteraciones (>= 100 exigidas).
    for (let i = 0; i < 40; i++) {
      const evento = generarEvento(rng);
      const url = `https://taquilla.vip/eventos/evento-${i}`;

      for (const { disponibilidad, esperado } of casos) {
        const jsonLd = construirEventJsonLd(evento, url, disponibilidad);
        const offers = jsonLd.offers as Record<string, unknown>;

        if (esperado === null) {
          // Req 1.3: cuando no hay dato fresco, la clave `availability` está AUSENTE,
          // no presente con valor undefined.
          expect(Object.prototype.hasOwnProperty.call(offers, "availability")).toBe(false);
          expect("availability" in offers).toBe(false);
        } else {
          // Req 1.4: cuando se declara, el valor deriva del cálculo del momento.
          expect(offers.availability).toBe(esperado);
        }

        // Regla dura: InStock jamás aparece salvo que disponibilidad === true.
        if (disponibilidad !== true) {
          expect(offers.availability).not.toBe(IN_STOCK);
        }

        iteraciones++;
      }
    }

    expect(iteraciones).toBeGreaterThanOrEqual(100);
  });

  it("nunca fija un valor por defecto: dos llamadas con la misma disponibilidad son consistentes y distintas entre estados", () => {
    const rng = crearRng(0x51515);

    for (let i = 0; i < 40; i++) {
      const evento = generarEvento(rng);
      const url = `https://taquilla.vip/eventos/coherencia-${i}`;

      const sinDato = construirEventJsonLd(evento, url, undefined).offers as Record<string, unknown>;
      const disponible = construirEventJsonLd(evento, url, true).offers as Record<string, unknown>;
      const agotado = construirEventJsonLd(evento, url, false).offers as Record<string, unknown>;

      expect("availability" in sinDato).toBe(false);
      expect(disponible.availability).toBe(IN_STOCK);
      expect(agotado.availability).toBe(SOLD_OUT);
      // El valor no es fijo: cambia con la disponibilidad calculada.
      expect(disponible.availability).not.toBe(agotado.availability);
    }
  });
});
