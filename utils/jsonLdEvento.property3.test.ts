import { describe, it, expect } from "vitest";
import { construirEventosJsonLd, type EventoConFunciones } from "@/utils/jsonLdEvento";
import type { FuncionSlugInput } from "@/utils/eventoSlug";

// Task 5.5 — test de propiedad.
//
// **Feature: mejoras-extra-migracion, Property 3: Un `Event` por función en eventos multifecha**
// **Validates: Requirements 1.5**
//
// Property: para todo evento con N funciones (N >= 0), el cascarón emite exactamente
// `max(N, 1)` bloques `Event`, y el `startDate` de cada bloque coincide con la fecha de su
// función correspondiente (o con `evento.fecha` cuando no hay funciones).
//
// fast-check no está instalado en el proyecto, así que se usa un generador determinista con
// semilla (LCG) que produce 100+ eventos variados: N funciones (N = 0..8), funciones con y sin
// fecha propia (para ejercer el fallback a evento.fecha), y campos opcionales del evento.

// --- PRNG determinista (LCG de Numerical Recipes) para reproducibilidad ---
const crearRng = (semilla: number) => {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 0xffffffff;
  };
};

const FECHA_EVENTO = "2025-05-10T20:00:00-06:00";

// Fechas candidatas para las funciones; se incluye null para ejercer el fallback a evento.fecha.
const FECHAS_FUNCION: (string | null)[] = [
  "2025-05-10T18:00:00-06:00",
  "2025-05-11T18:00:00-06:00",
  "2025-05-12T21:30:00-06:00",
  "2025-06-01T09:00:00-06:00",
  null, // función sin fecha propia -> debe caer a evento.fecha
];

// Genera un evento con N funciones (N variable) y campos opcionales variados.
const generarEvento = (
  rng: () => number,
): { evento: EventoConFunciones; nFunciones: number } => {
  const idx = Math.floor(rng() * 1000);
  const nFunciones = Math.floor(rng() * 9); // 0..8

  const funciones: FuncionSlugInput[] = Array.from({ length: nFunciones }, (_, i) => ({
    id: `${idx}-${i}`,
    nombre: rng() > 0.5 ? `Función ${i}` : null,
    fecha: FECHAS_FUNCION[Math.floor(rng() * FECHAS_FUNCION.length)],
  }));

  const evento: EventoConFunciones = {
    id: idx,
    nombre: `Evento ${idx}`,
    fecha: FECHA_EVENTO,
    imagenPromocion: rng() > 0.5 ? `https://cdn/img${idx}.jpg` : null,
    descripcion: rng() > 0.5 ? `Descripción ${idx}` : null,
    recinto: rng() > 0.3 ? { nombre: `Recinto ${idx}`, direccion: `Calle ${idx}` } : null,
    ciudad: rng() > 0.3 ? { nombre: `Ciudad ${idx}` } : null,
    // funciones puede quedar como arreglo vacío (N = 0): esa es la rama de fecha única.
    funciones,
  };

  return { evento, nFunciones };
};

const SITE_URL = "https://taquillavip.com";
const ITERACIONES = 200;

describe("Property 3: Un `Event` por función en eventos multifecha", () => {
  it("emite exactamente max(N, 1) bloques Event, cada uno con su startDate (100+ entradas)", () => {
    const rng = crearRng(0x3c3c3c3c);
    let vistosConFunciones = 0;
    let vistosSinFunciones = 0;

    for (let i = 0; i < ITERACIONES; i++) {
      const { evento, nFunciones } = generarEvento(rng);
      const bloques = construirEventosJsonLd(evento, SITE_URL);

      // Cardinalidad: exactamente max(N, 1) bloques.
      const esperados = Math.max(nFunciones, 1);
      expect(bloques).toHaveLength(esperados);

      // Todo bloque es un Event de schema.org.
      for (const bloque of bloques) {
        expect(bloque["@type"]).toBe("Event");
        expect(bloque["@context"]).toBe("https://schema.org");
        expect(bloque.name).toBe(evento.nombre);
      }

      if (nFunciones === 0) {
        vistosSinFunciones++;
        // Sin funciones: un único Event con startDate === evento.fecha.
        expect(bloques).toHaveLength(1);
        expect(bloques[0].startDate).toBe(evento.fecha);
      } else {
        vistosConFunciones++;
        const funciones = evento.funciones ?? [];
        // Con funciones: el startDate de cada bloque coincide con la fecha de su función
        // (o con evento.fecha cuando la función no trae fecha propia), en el mismo orden.
        funciones.forEach((funcion, idx) => {
          const esperado = funcion.fecha ?? evento.fecha;
          expect(bloques[idx].startDate).toBe(esperado);
        });
      }
    }

    // Se ejercieron >= 100 iteraciones y ambas ramas (con y sin funciones) del espacio.
    expect(vistosConFunciones + vistosSinFunciones).toBe(ITERACIONES);
    expect(vistosConFunciones).toBeGreaterThan(0);
    expect(vistosSinFunciones).toBeGreaterThan(0);
  });

  it("caso concreto: 3 funciones producen 3 Event con sus fechas respectivas", () => {
    const evento: EventoConFunciones = {
      id: 42,
      nombre: "Sky Fest Laguna",
      fecha: "2025-07-07T00:00:00-06:00",
      funciones: [
        { id: 1, nombre: "Matutino", fecha: "2025-07-07T10:00:00-06:00" },
        { id: 2, nombre: "Vespertino", fecha: "2025-07-07T18:00:00-06:00" },
        { id: 3, nombre: null, fecha: "2025-07-08T18:00:00-06:00" },
      ],
    };

    const bloques = construirEventosJsonLd(evento, SITE_URL);

    expect(bloques).toHaveLength(3);
    expect(bloques.map((b) => b.startDate)).toEqual([
      "2025-07-07T10:00:00-06:00",
      "2025-07-07T18:00:00-06:00",
      "2025-07-08T18:00:00-06:00",
    ]);
    expect(bloques.every((b) => b["@type"] === "Event")).toBe(true);
  });

  it("caso concreto: sin funciones produce un único Event con evento.fecha", () => {
    const evento: EventoConFunciones = {
      id: 7,
      nombre: "Tuff Riders",
      fecha: "2025-09-01T21:00:00-06:00",
      funciones: [],
    };

    const bloques = construirEventosJsonLd(evento, SITE_URL);

    expect(bloques).toHaveLength(1);
    expect(bloques[0]["@type"]).toBe("Event");
    expect(bloques[0].startDate).toBe("2025-09-01T21:00:00-06:00");
  });
});
