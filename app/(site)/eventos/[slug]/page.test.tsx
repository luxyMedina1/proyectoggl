import { describe, it, expect, vi, beforeEach } from "vitest";

// Task 1.1 — test de ejemplo: el cascarón de evento debe invocar notFound() cuando
// getEvento(slug) no resuelve un evento (Req 2.1).
//
// notFound() lanza en producción (NEXT_HTTP_ERROR_FALLBACK;404) para cortar el render;
// aquí se espía como no-op para poder afirmar que se llamó sin interrumpir el test.
const notFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

// getEvento es la resolución server-side; se controla su retorno por test.
const getEvento = vi.fn();
vi.mock("@/utils/ogEvento", () => ({
  getEvento: (slug: string) => getEvento(slug),
  buildMetadataEvento: vi.fn(),
}));

// La isla de cliente no aporta a este test y arrastra medio bundle; se stubbea. La proyección
// `proyectarCabeceraEvento` que invoca `page.tsx` vive en el módulo puro `./cabeceraEvento`
// (sin `'use client'`) y no necesita mock: es una función pura sobre el evento resuelto.
vi.mock("./EventoDetalleView", () => ({
  default: () => null,
}));

import Page from "./page";

describe("Pagina_Evento — notFound() con slug no resuelto", () => {
  beforeEach(() => {
    notFound.mockClear();
    getEvento.mockReset();
  });

  it("invoca notFound() cuando getEvento(slug) devuelve null", async () => {
    getEvento.mockResolvedValue(null);

    await Page({ params: Promise.resolve({ slug: "slug-inexistente" }) });

    expect(getEvento).toHaveBeenCalledWith("slug-inexistente");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("no invoca notFound() cuando el evento resuelve", async () => {
    getEvento.mockResolvedValue({ nombre: "Evento Real" });

    await Page({ params: Promise.resolve({ slug: "evento-real" }) });

    expect(getEvento).toHaveBeenCalledWith("evento-real");
    expect(notFound).not.toHaveBeenCalled();
  });
});
