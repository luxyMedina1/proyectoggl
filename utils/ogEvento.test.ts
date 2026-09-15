import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `/eventos/[slug]` (compra) y `/eventos/informacion/[slug]` (ficha extendida) son
// paginas distintas a proposito, pero antes de este fix `buildMetadataEvento` producia
// el MISMO <title> y la MISMA <meta description> en ambas para un evento de fecha unica
// -> riesgo real de canibalizacion de keyword (ver checklist-frontend.md). Este test
// verifica que quedan diferenciados sin depender del backend real.
process.env.NEXT_PUBLIC_URL_BACKEND = "https://backend.test";
process.env.NEXT_PUBLIC_API_KEY = "k-test";
process.env.NEXT_PUBLIC_SITE_URL = "https://taquillavip.com";

vi.mock("@/lib/config/getSiteConfig", () => ({
  getSiteConfig: async () => ({ config: { nombreMarca: "TaquillaVip" }, colors: {} }),
}));

import { buildMetadataEvento } from "./ogEvento";

const EVENTO = {
  id: 1,
  nombre: "Sky Fest Laguna",
  fecha: "2026-10-10T20:00:00.000Z",
  imagenPromocion: "https://cdn/evento.jpg",
  descripcion: "<p>La mejor fiesta del año, con artistas internacionales.</p>",
  recinto: { id: 1, nombre: "Arena Laguna", direccion: "" },
  ciudad: { id: 1, nombre: "Torreón" },
};

const mockFetchSlugYDetalle = (evento: unknown, funcionId: string | number | null = null) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/eventos/slug/")) {
        return { ok: true, json: async () => ({ eventoId: 1, funcionId }) };
      }
      if (url.includes("/detalle")) {
        return { ok: true, json: async () => evento };
      }
      throw new Error(`fetch no mockeado: ${url}`);
    }),
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildMetadataEvento — variante detalle vs informacion no deben canibalizarse", () => {
  it("con la MISMA fecha única, detalle e informacion producen title/description DISTINTOS", async () => {
    mockFetchSlugYDetalle(EVENTO);

    const detalle = await buildMetadataEvento("sky-fest-laguna", "detalle");
    const informacion = await buildMetadataEvento("sky-fest-laguna", "informacion");

    expect(detalle.title).not.toBe(informacion.title);
    expect(detalle.description).not.toBe(informacion.description);
  });

  it("detalle: title = nombre del evento, description = texto plano de la reseña real", async () => {
    mockFetchSlugYDetalle(EVENTO);

    const metadata = await buildMetadataEvento("sky-fest-laguna", "detalle");

    expect(metadata.title).toBe("Sky Fest Laguna");
    expect(metadata.description).toBe("La mejor fiesta del año, con artistas internacionales.");
    expect(metadata.alternates?.canonical).toBe("https://taquillavip.com/eventos/sky-fest-laguna");
  });

  it("informacion: title con sufijo propio, description con prefijo + la misma reseña real", async () => {
    mockFetchSlugYDetalle(EVENTO);

    const metadata = await buildMetadataEvento("sky-fest-laguna", "informacion");

    expect(metadata.title).toBe("Sky Fest Laguna - Información y fechas");
    expect(metadata.description).toBe(
      "Información y fechas de Sky Fest Laguna en Torreón. La mejor fiesta del año, con artistas internacionales.",
    );
    expect(metadata.alternates?.canonical).toBe(
      "https://taquillavip.com/eventos/informacion/sky-fest-laguna",
    );
  });

  it("detalle con función seleccionada: el título SÍ incluye el nombre de la función (comportamiento previo intacto)", async () => {
    mockFetchSlugYDetalle(
      { ...EVENTO, funciones: [{ id: 7, nombre: "Matutino", fecha: EVENTO.fecha }] },
      7,
    );

    const metadata = await buildMetadataEvento("sky-fest-laguna-7-matutino", "detalle");

    expect(metadata.title).toBe("Sky Fest Laguna - Matutino");
  });

  it("sin descripción propia: el fallback fecha/recinto/ciudad también se diferencia entre variantes", async () => {
    mockFetchSlugYDetalle({ ...EVENTO, descripcion: "" });

    const detalle = await buildMetadataEvento("sky-fest-laguna", "detalle");
    const informacion = await buildMetadataEvento("sky-fest-laguna", "informacion");

    expect(detalle.description).not.toBe(informacion.description);
    expect(informacion.description).toContain("Información y fechas de Sky Fest Laguna");
    expect(informacion.description).toContain(detalle.description as string);
  });
});
