import { describe, it, expect, vi, beforeEach } from "vitest";

// generateMetadata del cascarón de detalle de paquete: la og:description y la
// og:image deben reflejar el paquete real, o heredar el OG genérico del layout
// raíz cuando el slug no resuelve a ningún paquete (mismo criterio que citypass/[slug]).
const getPaqueteCityPassDetalle = vi.fn();
vi.mock("@/lib/citypass/getCityPass", () => ({
  getPaqueteCityPassDetalle: (paqueteSlug: string, ciudadSlug: string) =>
    getPaqueteCityPassDetalle(paqueteSlug, ciudadSlug),
}));

vi.mock("@/lib/config/getSiteConfig", () => ({
  getSiteConfig: async () => ({ config: { nombreMarca: "TaquillaVip" }, colors: {} }),
}));

// Isla de cliente: no aporta a este test y arrastra hooks/next-navigation.
vi.mock("@/publicUi/pages/CityPassPaquetePage", () => ({ default: () => null }));

import type { ResolvingMetadata } from "next";
import { generateMetadata } from "./page";

const IMAGEN_MARCA = [{ url: "https://taquillavip.com/opengraph-image", alt: "TaquillaVip" }];
const PARENT = Promise.resolve({
  openGraph: { images: IMAGEN_MARCA },
}) as unknown as ResolvingMetadata;

describe("generateMetadata — detalle de paquete CityPass", () => {
  beforeEach(() => {
    getPaqueteCityPassDetalle.mockReset();
  });

  it("hereda el OG genérico del layout cuando el slug no resuelve ningún paquete", async () => {
    getPaqueteCityPassDetalle.mockResolvedValue(null);

    const metadata = await generateMetadata(
      { params: Promise.resolve({ slug: "torreon", paqueteSlug: "paquete-inexistente" }) },
      PARENT,
    );

    expect(metadata).toEqual({});
    expect(getPaqueteCityPassDetalle).toHaveBeenCalledWith("paquete-inexistente", "torreon");
  });

  it("con paquete resuelto: título, descripción e imagen propios, canonical de la URL del paquete", async () => {
    getPaqueteCityPassDetalle.mockResolvedValue({
      nombre: "Básico",
      descripcion: "<p>Acceso a las mejores atracciones</p>",
      imagenPrincipal: "https://cdn/basico.jpg",
      atraccionesCount: 5,
      ciudad: { id: 7, nombre: "Torreón" },
    });

    const metadata = await generateMetadata(
      { params: Promise.resolve({ slug: "torreon", paqueteSlug: "basico" }) },
      PARENT,
    );

    expect(metadata.title).toBe("Básico");
    expect(metadata.description).toBe("Acceso a las mejores atracciones");
    expect(metadata.alternates?.canonical).toBe(
      "https://taquillavip.com/citypass/torreon/paquete/basico",
    );
    expect(metadata.openGraph?.images).toEqual([
      { url: "https://cdn/basico.jpg", alt: "Básico" },
    ]);
    expect(metadata.twitter?.images).toEqual(["https://cdn/basico.jpg"]);
  });

  it("sin descripción propia: arma una a partir del conteo de atracciones", async () => {
    getPaqueteCityPassDetalle.mockResolvedValue({
      nombre: "Básico",
      descripcion: null,
      imagenPrincipal: null,
      atraccionesCount: 1,
      ciudad: { id: 7, nombre: "Torreón" },
    });

    const metadata = await generateMetadata(
      { params: Promise.resolve({ slug: "torreon", paqueteSlug: "basico" }) },
      PARENT,
    );

    expect(metadata.description).toBe(
      "Descubre el CityPass Básico en Torreón: acceso a 1 atracción.",
    );
    expect(metadata.openGraph?.images).toEqual(IMAGEN_MARCA);
    expect(metadata.twitter?.images).toEqual(IMAGEN_MARCA);
  });
});
