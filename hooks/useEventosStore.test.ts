import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosRequestConfig } from "axios";

// Task 3.4 — test de ejemplo: la disponibilidad de asientos debe pedirse con
// `cache: "no-store"` (Req 26.3, anti venta doble). Un mapa de asientos servido de
// caché vendería el mismo asiento dos veces.
//
// Enfoque: unit-test de la capa store. `useEventosStore` cierra sobre el cliente axios
// `apiApplication` importado a nivel de módulo, así que espiamos su `.get` y afirmamos
// que el `config` con el que se invoca lleva `cache: "no-store"`. Esto prueba Req 26.3
// sin el peso ni la fragilidad de renderizar EventoDetalleView completo.

// `apiApplication` es el default export de ../api/apiApplication (relativo al store).
// `vi.hoisted` porque la fábrica de `vi.mock` se eleva por encima de este archivo.
const { get } = vi.hoisted(() => ({
  get: vi.fn(
    async (_url: string, _config?: AxiosRequestConfig) => ({ data: {} }),
  ),
}));
vi.mock("../api/apiApplication", () => ({
  default: { get },
}));

import { useEventosStore, SIN_CACHE_DISPONIBILIDAD } from "./useEventosStore";

beforeEach(() => {
  get.mockClear();
});

describe("SIN_CACHE_DISPONIBILIDAD (contrato de frescura, Req 26.3)", () => {
  it("declara cache: 'no-store'", () => {
    expect(SIN_CACHE_DISPONIBILIDAD.cache).toBe("no-store");
  });

  it("refuerza la frescura con cabeceras Cache-Control/Pragma", () => {
    expect(SIN_CACHE_DISPONIBILIDAD.headers).toMatchObject({
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    });
  });
});

describe("fetch de disponibilidad con no-store al montar (Req 26.3)", () => {
  it("getDetalleEventos reenvía el config no-store al cliente axios", async () => {
    const { getDetalleEventos } = useEventosStore();

    await getDetalleEventos("1084", SIN_CACHE_DISPONIBILIDAD);

    expect(get).toHaveBeenCalledTimes(1);
    const [url, config] = get.mock.calls[0];
    expect(url).toBe("/eventos/1084/detalle");
    expect(config).toEqual(SIN_CACHE_DISPONIBILIDAD);
    expect((config as { cache?: string } | undefined)?.cache).toBe("no-store");
  });

  it("getDetalleEventoSecciones reenvía el config no-store al cliente axios", async () => {
    const { getDetalleEventoSecciones } = useEventosStore();

    await getDetalleEventoSecciones("1084", "42", SIN_CACHE_DISPONIBILIDAD);

    expect(get).toHaveBeenCalledTimes(1);
    const [url, config] = get.mock.calls[0];
    expect(url).toBe("/eventos/1084/detalle_seccion/false/web/42");
    expect(config).toEqual(SIN_CACHE_DISPONIBILIDAD);
    expect((config as { cache?: string } | undefined)?.cache).toBe("no-store");
  });
});
