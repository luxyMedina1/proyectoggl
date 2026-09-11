import { describe, it, expect, vi, beforeEach } from "vitest";

// generateMetadata del cascarón de CityPass por ciudad: la og:description y la
// og:image deben reflejar si la ciudad tiene CityPass a la venta o no, para que
// compartir el link no prometa paquetes que no existen (ni oculte los que sí).
const getCiudades = vi.fn();
const getLandingCityPass = vi.fn();
vi.mock("@/lib/citypass/getCityPass", () => ({
  getCiudades: () => getCiudades(),
  getLandingCityPass: (id: number, slug: string) => getLandingCityPass(id, slug),
  getPaquetesCityPass: vi.fn(async () => []),
}));

vi.mock("@/lib/config/getSiteConfig", () => ({
  getSiteConfig: async () => ({ config: { nombreMarca: "TaquillaVip" }, colors: {} }),
}));

// Isla de cliente: no aporta a este test y arrastra Redux/next-navigation.
vi.mock("@/publicUi/pages/CityPassPage", () => ({ default: () => null }));

import type { ResolvingMetadata } from "next";
import { generateMetadata } from "./page";

const CIUDAD = { id: 7, nombre: "Torreón" };

// `parent`: lo que `generateMetadata` hereda del layout raíz (imagen de marca de
// `app/opengraph-image.tsx`). Las ramas sin imagen propia deben reinyectarla —
// declarar un bloque `openGraph` propio sin `images` pisa la del padre (mismo fix
// que `/eventos`), así que sin esto la tarjeta al compartir sale sin imagen.
const IMAGEN_MARCA = [{ url: "https://taquillavip.com/opengraph-image", alt: "TaquillaVip" }];
const PARENT = Promise.resolve({
  openGraph: { images: IMAGEN_MARCA },
}) as unknown as ResolvingMetadata;

describe("generateMetadata — CityPass por ciudad", () => {
  beforeEach(() => {
    getCiudades.mockReset();
    getLandingCityPass.mockReset();
  });

  it("hereda el OG genérico del layout cuando el slug no resuelve ninguna ciudad", async () => {
    getCiudades.mockResolvedValue([CIUDAD]);

    const metadata = await generateMetadata(
      { params: Promise.resolve({ slug: "ciudad-inexistente" }) },
      PARENT,
    );

    expect(metadata).toEqual({});
    expect(getLandingCityPass).not.toHaveBeenCalled();
  });

  it("cuando la ciudad SÍ tiene CityPass configurado: título, descripción e imagen del hero", async () => {
    getCiudades.mockResolvedValue([CIUDAD]);
    getLandingCityPass.mockResolvedValue({
      configurada: true,
      ciudad: CIUDAD,
      hero: { titulo: "CityPass Torreón", descripcion: "<p>Vive la ciudad</p>", imagen: "https://cdn/hero.jpg" },
      paquetes: [{ id: 1 }, { id: 2 }],
    });

    const metadata = await generateMetadata(
      { params: Promise.resolve({ slug: "torreon" }) },
      PARENT,
    );

    expect(metadata.title).toBe("CityPass Torreón");
    expect(metadata.description).toBe("Vive la ciudad");
    expect(metadata.openGraph?.images).toEqual([
      { url: "https://cdn/hero.jpg", alt: "CityPass Torreón" },
    ]);
    expect(metadata.twitter?.images).toEqual(["https://cdn/hero.jpg"]);
  });

  it("cuando la ciudad NO tiene CityPass configurado: mensaje real del backend, imagen de marca heredada", async () => {
    getCiudades.mockResolvedValue([CIUDAD]);
    getLandingCityPass.mockResolvedValue({
      configurada: false,
      ciudad: CIUDAD,
      mensaje: "Aún no tenemos CityPass en Torreón.",
    });

    const metadata = await generateMetadata(
      { params: Promise.resolve({ slug: "torreon" }) },
      PARENT,
    );

    expect(metadata.title).toBe("CityPass Torreón");
    expect(metadata.description).toBe("Aún no tenemos CityPass en Torreón.");
    expect(metadata.openGraph?.images).toEqual(IMAGEN_MARCA);
    expect(metadata.twitter?.images).toEqual(IMAGEN_MARCA);
  });

  it("cuando el backend de landing no responde: mensaje genérico de 'próximamente', imagen de marca heredada", async () => {
    getCiudades.mockResolvedValue([CIUDAD]);
    getLandingCityPass.mockResolvedValue(null);

    const metadata = await generateMetadata(
      { params: Promise.resolve({ slug: "torreon" }) },
      PARENT,
    );

    expect(metadata.title).toBe("CityPass Torreón");
    expect(metadata.description).toBe(
      "Estamos preparando el CityPass de Torreón. Muy pronto podrás verlo aquí.",
    );
    expect(metadata.openGraph?.images).toEqual(IMAGEN_MARCA);
  });

  it("cuando la ciudad tiene CityPass pero el hero no trae imagen: cae a la imagen de marca heredada", async () => {
    getCiudades.mockResolvedValue([CIUDAD]);
    getLandingCityPass.mockResolvedValue({
      configurada: true,
      ciudad: CIUDAD,
      hero: { titulo: "CityPass Torreón", descripcion: "<p>Vive la ciudad</p>", imagen: null },
      paquetes: [{ id: 1 }],
    });

    const metadata = await generateMetadata(
      { params: Promise.resolve({ slug: "torreon" }) },
      PARENT,
    );

    expect(metadata.openGraph?.images).toEqual(IMAGEN_MARCA);
    expect(metadata.twitter?.images).toEqual(IMAGEN_MARCA);
  });
});
