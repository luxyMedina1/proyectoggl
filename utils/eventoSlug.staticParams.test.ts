import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildEventoSlug, eventosAStaticParams, type EventoSlugInput } from "./eventoSlug";

// Feature: mejoras-extra-migracion, Property 5: `generateStaticParams` acota y mapea
// correctamente.
// Validates: Requirements 3.1, 3.2
//
// Para toda lista de eventos, `generateStaticParams` devuelve a lo sumo 50 entradas,
// cada una con `slug === buildEventoSlug(e)` para un evento `e` de la lista, y devuelve
// `[]` (sin lanzar) cuando la obtención de la lista falla.
//
// fast-check no está instalado en el proyecto; se usa un generador determinista
// (PRNG con semilla) para producir >=100 listas de eventos variadas y reproducibles.

// PRNG mulberry32: determinista y sembrable -> un contraejemplo es reproducible.
const prng = (semilla: number) => () => {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const NOMBRES = [
  "Sky Fest",
  "Sky Fest Laguna",
  "Tuff Riders",
  "  Café  con  Ñandú  ",
  "Concierto 2025 !!!",
  "",
  "---",
  "Ünïçödé Tëst",
  "A",
  "The Very Long Event Name That Keeps Going On And On",
];

// Genera un evento arbitrario: a veces sin nombre (cae al id), a veces con artista,
// a veces con slug propio del back (que gana), para ejercitar todas las ramas de
// buildEventoSlug.
const generarEvento = (rand: () => number, i: number): EventoSlugInput => {
  const r = rand();
  const id = Math.floor(rand() * 100000) + 1;
  const nombre = NOMBRES[Math.floor(rand() * NOMBRES.length)];
  const evento: EventoSlugInput = { id: rand() < 0.5 ? id : String(id) };
  if (r < 0.15) return evento; // sin nombre -> slug cae al id
  if (r < 0.35) return { ...evento, slug: `slug-back-${i}` };
  if (r < 0.6) return { ...evento, artista: { nombre } };
  return { ...evento, nombre };
};

const generarLista = (rand: () => number): EventoSlugInput[] => {
  // Tamaños alrededor del límite (50) para ejercitar el slice en ambos lados.
  const n = Math.floor(rand() * 130); // 0..129
  return Array.from({ length: n }, (_, i) => generarEvento(rand, i));
};

describe("Property 5: eventosAStaticParams acota y mapea correctamente (Req 3.1, 3.2)", () => {
  it("para toda lista: <=50 entradas y cada slug === buildEventoSlug(e) de un evento de la lista", () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const rand = prng(semilla);
      const eventos = generarLista(rand);

      const params = eventosAStaticParams(eventos);

      // Acotado a 50 (o al tamaño de la lista si es menor).
      expect(params.length).toBeLessThanOrEqual(50);
      expect(params.length).toBe(Math.min(eventos.length, 50));

      // Cada entrada corresponde, en orden, a un evento de la lista y su slug es el
      // que produce buildEventoSlug (coincide con el declarado por el sitemap).
      params.forEach((p, i) => {
        expect(p).toEqual({ slug: buildEventoSlug(eventos[i]) });
      });
    }
  });

  it("respeta el orden: son exactamente los primeros N eventos", () => {
    for (let semilla = 500; semilla < 620; semilla++) {
      const rand = prng(semilla);
      const eventos = generarLista(rand);

      const params = eventosAStaticParams(eventos);
      const esperado = eventos.slice(0, 50).map((e) => ({ slug: buildEventoSlug(e) }));

      expect(params).toEqual(esperado);
    }
  });

  it("no lanza ante entradas degeneradas (lista vacía, null, undefined)", () => {
    expect(eventosAStaticParams([])).toEqual([]);
    // @ts-expect-error entrada inválida: el contrato es no lanzar y devolver [].
    expect(eventosAStaticParams(null)).toEqual([]);
    // @ts-expect-error entrada inválida
    expect(eventosAStaticParams(undefined)).toEqual([]);
  });
});

// La otra mitad de la propiedad: cuando la obtención de la lista falla,
// `generateStaticParams` devuelve `[]` (sin lanzar) para no romper el build (Req 3.2).
describe("Property 5 (parte 2): generateStaticParams devuelve [] cuando el fetch falla (Req 3.2)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("getListaEventos que lanza -> [] (build no falla)", async () => {
    vi.doMock("@/utils/ogEvento", () => ({
      getListaEventos: vi.fn().mockRejectedValue(new Error("backend caído")),
      getEvento: vi.fn(),
      buildMetadataEvento: vi.fn(),
    }));
    vi.doMock("./EventoDetalleView", () => ({ default: () => null }));

    const { generateStaticParams } = await import(
      "../app/(site)/eventos/[slug]/page"
    );

    await expect(generateStaticParams()).resolves.toEqual([]);
  }, 30000);

  it("getListaEventos que resuelve -> mapea acotado (a lo sumo 50)", async () => {
    const eventos = Array.from({ length: 73 }, (_, i) => ({
      id: i + 1,
      nombre: `Evento ${i + 1}`,
    }));
    vi.doMock("@/utils/ogEvento", () => ({
      getListaEventos: vi.fn().mockResolvedValue(eventos),
      getEvento: vi.fn(),
      buildMetadataEvento: vi.fn(),
    }));
    vi.doMock("./EventoDetalleView", () => ({ default: () => null }));

    const { generateStaticParams } = await import(
      "../app/(site)/eventos/[slug]/page"
    );

    const params = await generateStaticParams();
    expect(params).toHaveLength(50);
    expect(params[0]).toEqual({ slug: buildEventoSlug(eventos[0]) });
  }, 30000);
});
