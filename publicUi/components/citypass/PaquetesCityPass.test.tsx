import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Antes, "Comprar paquete" llamaba a un `onComprar` que el padre (CityPassPage)
// resolvía con `useRouter().push(...)`. Al convertir CityPassPage a Server Component
// ese `useRouter` ya no existe ahí, así que PaquetesCityPass navega por su cuenta —
// este test cubre que arma bien la URL de destino y respeta el estado de venta.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { PaquetesCityPass } from "./PaquetesCityPass";
import type { CityPassPaqueteLanding } from "../../../types/CityPass";

const paquete = (overrides: Partial<CityPassPaqueteLanding> = {}): CityPassPaqueteLanding => ({
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
  atraccionesCount: 3,
  precios: [{ tipoBoletoId: 1, tipoBoleto: "Adulto", precio: 500 }],
  ...overrides,
});

describe("PaquetesCityPass", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("no renderiza nada si no hay paquetes", () => {
    const { container } = render(<PaquetesCityPass paquetes={[]} ciudadSlug="durango" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("al hacer clic en un paquete disponible, navega al detalle con el slug del paquete", async () => {
    const user = userEvent.setup();
    render(<PaquetesCityPass paquetes={[paquete({ nombre: "Pase Oro" })]} ciudadSlug="durango" />);

    await user.click(screen.getByRole("button", { name: "Comprar paquete" }));

    expect(push).toHaveBeenCalledWith("/citypass/durango/paquete/pase-oro");
  });

  it("un paquete sin disponibleVenta muestra 'No disponible' y el botón deshabilitado", () => {
    render(<PaquetesCityPass paquetes={[paquete({ disponibleVenta: false })]} ciudadSlug="durango" />);

    const boton = screen.getByRole("button", { name: "No disponible" });
    expect(boton).toBeDisabled();
  });
});
