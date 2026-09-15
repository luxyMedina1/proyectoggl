import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// CityPassPage ya no pide datos por su cuenta (era "use client" + useEffect); ahora
// es un Server Component que solo pinta lo que la ruta (`app/(site)/citypass/[slug]/
// page.tsx`) ya resolvió y le pasa como prop `landing`. Este test cubre las 3 ramas de
// ese prop, ya que antes la carga async ocultaba estos casos detrás de un `loading`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import CityPassPage from "./CityPassPage";
import type { CityPassLandingConfigurada } from "../../types/CityPass";

const LANDING: CityPassLandingConfigurada = {
  configurada: true,
  ciudad: { id: 1, nombre: "Durango" },
  hero: { titulo: "CityPass Durango", descripcion: null, imagen: null },
  categorias: [],
  paquetes: [],
  comparativa: { paquetes: [], atracciones: [] },
  galeria: [],
};

describe("CityPassPage", () => {
  it("sin landing (ciudad no resuelta): muestra el estado vacío genérico 'próximamente'", () => {
    render(<CityPassPage landing={null} slug="ciudad-inexistente" />);

    expect(screen.getByRole("heading", { name: "CityPass Ciudad Inexistente" })).toBeInTheDocument();
    expect(screen.getByText(/Muy pronto podrás verlo aquí/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a eventos" })).toBeInTheDocument();
  });

  it("landing configurada: false — muestra el mensaje real del backend, no el genérico", () => {
    render(
      <CityPassPage
        landing={{
          configurada: false,
          ciudad: { id: 1, nombre: "Torreón" },
          mensaje: "Aún no tenemos CityPass en Torreón.",
        }}
        slug="torreon"
      />,
    );

    expect(screen.getByText("Aún no tenemos CityPass en Torreón.")).toBeInTheDocument();
    expect(screen.queryByText(/Muy pronto podrás verlo aquí/)).not.toBeInTheDocument();
  });

  it("landing configurada: true — pinta el hero y el título de la ciudad real", () => {
    render(<CityPassPage landing={LANDING} slug="durango" />);

    expect(screen.getByRole("heading", { name: "CityPass Durango" })).toBeInTheDocument();
    expect(screen.queryByText("Volver a eventos")).not.toBeInTheDocument();
  });
});
