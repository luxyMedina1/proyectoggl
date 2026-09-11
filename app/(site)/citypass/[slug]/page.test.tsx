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

import { generateMetadata } from "./page";

const CIUDAD = { id: 7, nombre: "Torreón" };

describe("generateMetadata — CityPass por ciudad", () => {
  beforeEach(() => {
    getCiudades.mockReset();
    getLandingCityPass.mockReset();
  });

  it("hereda el OG genérico del layout cuando el slug no resuelve ninguna ciudad", async () => {
    getCiudades.mockResolvedValue([CIUDAD]);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "ciudad-inexistente" }),
    });

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

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "torreon" }) });

    expect(metadata.title).toBe("CityPass Torreón");
    expect(metadata.description).toBe("Vive la ciudad");
    expect(metadata.openGraph?.images).toEqual([
      { url: "https://cdn/hero.jpg", alt: "CityPass Torreón" },
    ]);
    expect(metadata.twitter?.images).toEqual(["https://cdn/hero.jpg"]);
  });

  it("cuando la ciudad NO tiene CityPass configurado: mensaje real del backend, sin imagen", async () => {
    getCiudades.mockResolvedValue([CIUDAD]);
    getLandingCityPass.mockResolvedValue({
      configurada: false,
      ciudad: CIUDAD,
      mensaje: "Aún no tenemos CityPass en Torreón.",
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "torreon" }) });

    expect(metadata.title).toBe("CityPass Torreón");
    expect(metadata.description).toBe("Aún no tenemos CityPass en Torreón.");
    expect(metadata.openGraph?.images).toBeUndefined();
    expect(metadata.twitter?.images).toBeUndefined();
  });

  it("cuando el backend de landing no responde: mensaje genérico de 'próximamente', sin imagen", async () => {
    getCiudades.mockResolvedValue([CIUDAD]);
    getLandingCityPass.mockResolvedValue(null);

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "torreon" }) });

    expect(metadata.title).toBe("CityPass Torreón");
    expect(metadata.description).toBe(
      "Estamos preparando el CityPass de Torreón. Muy pronto podrás verlo aquí.",
    );
    expect(metadata.openGraph?.images).toBeUndefined();
  });
});
