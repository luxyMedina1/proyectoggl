import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// CityPassPaquetePage ya no pide el paquete por su cuenta (era una cascada de 3
// fetches en cliente: ciudades -> landing -> paquete, solo para resolver el slug a un
// id). Ahora es una isla de cliente que recibe el paquete ya resuelto como prop desde
// la ruta (`app/(site)/citypass/[slug]/paquete/[paqueteSlug]/page.tsx`) y solo se
// queda con lo que de verdad necesita ser interactivo: auth, carrito de boletos, mapa.
const push = vi.fn();
const back = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back }),
}));

let authState = { status: "authenticated" as string, isVerified: true };
vi.mock("../../hooks/useAuthStore", () => ({
  useAuthStore: () => authState,
}));

const requestLogin = vi.fn();
vi.mock("../../context/AuthModalContext", () => ({
  useAuthModal: () => ({ requestLogin: () => requestLogin() }),
}));

// El mapa usa react-leaflet (toca `window`/canvas de forma que jsdom no soporta bien)
// y aquí no aporta nada al comportamiento bajo prueba.
vi.mock("../components/citypass/MapaAtracciones", () => ({
  MapaAtracciones: () => null,
}));

import CityPassPaquetePage from "./CityPassPaquetePage";
import type { CityPassPaqueteDetalle } from "../../types/CityPass";

const PAQUETE: CityPassPaqueteDetalle = {
  id: 1,
  nombre: "Pase Oro",
  textoComplementario: null,
  descripcion: null,
  imagenPrincipal: null,
  validezDias: 30,
  cargoServicioPorcentaje: 0,
  cargoTarjetaPorcentaje: 0,
  fechaInicioVenta: null,
  fechaFinVenta: null,
  disponibleVenta: true,
  ciudad: { id: 1, nombre: "Durango" },
  atraccionesCount: 2,
  precios: [{ tipoBoletoId: 1, tipoBoleto: "Adulto", precio: 500 }],
  atracciones: [],
  galeria: [],
  mapa: { puntos: [] },
};

describe("CityPassPaquetePage", () => {
  beforeEach(() => {
    push.mockReset();
    back.mockReset();
    requestLogin.mockReset();
    authState = { status: "authenticated", isVerified: true };
  });

  it("sin paquete (slug no resuelto): muestra 'Paquete no encontrado'", () => {
    render(<CityPassPaquetePage paquete={null} />);

    expect(screen.getByRole("heading", { name: "Paquete no encontrado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a eventos" })).toBeInTheDocument();
  });

  it("con paquete: pinta el título de compra y el panel de boletos", () => {
    render(<CityPassPaquetePage paquete={PAQUETE} />);

    expect(screen.getByRole("heading", { name: "Compra de Pase Oro" })).toBeInTheDocument();
    // Sin boletos seleccionados todavía, "Comprar ahora" arranca deshabilitado.
    expect(screen.getByRole("button", { name: "Comprar ahora" })).toBeDisabled();
  });

  it("sin sesión: comprar boletos abre el modal de login en vez de navegar directo al checkout", async () => {
    authState = { status: "unauthenticated", isVerified: false };
    requestLogin.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<CityPassPaquetePage paquete={PAQUETE} />);

    await user.click(screen.getByRole("button", { name: "Agregar Adulto" }));
    await user.click(screen.getByRole("button", { name: "Comprar ahora" }));

    expect(requestLogin).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
