import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// El buscador del header filtra /eventos por ciudad vía ?ciudad=<id> (ver
// app/(site)/layout.tsx). Si el backend agrega una ciudad sin eventos, la lista
// debe mostrarlo claramente (mensaje de "no hay eventos"), no dejar la sección en
// blanco como pasaba antes (Object.entries({}).map(...) no renderiza nada).

let mockSearch = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearch,
}));

const getListaEventos = vi.fn();
vi.mock("../../../hooks/useEventosStore", () => ({
  useEventosStore: () => ({ getListaEventos: () => getListaEventos() }),
}));

vi.mock("../../../hooks/useAuthStore", () => ({
  useAuthStore: () => ({ status: "unauthenticated", isVerified: false }),
}));

vi.mock("../../../api/apiApplication", () => ({
  default: { get: vi.fn(async () => ({ data: { categorias: [] } })) },
}));

import EventosView from "./EventosView";

const DURANGO_ID = 4;
const REYNOSA_ID = 5;

const baseEvento = {
  id: 1,
  tipo: "Comercial",
  nombre: "Tuff Riders",
  fecha: "2026-10-03T20:00:00.000Z",
  precioBase: "100",
  descripcion: null,
  imagenPromocion: "",
  imagenBanner: "",
  artista: { id: 1, nombre: "Tuff Riders", genero: "deportes" },
  recinto: { id: 1, nombre: "Arena Durango", direccion: "Durango, Dgo." },
  asientosDisponibles: 10,
  precioMin: "100",
  precioMax: "200",
  ciudad: { id: DURANGO_ID, nombre: "Durango" },
  categoria: "deportes",
  esMultiFuncion: false,
};

const eventoDurango = { ...baseEvento };
const eventoReynosa = {
  ...baseEvento,
  id: 2,
  nombre: "Sky Fest",
  artista: { id: 2, nombre: "Sky Fest", genero: "concierto" },
  ciudad: { id: REYNOSA_ID, nombre: "Reynosa" },
};

describe("EventosView — filtro por ciudad (?ciudad=)", () => {
  beforeEach(() => {
    mockSearch = new URLSearchParams();
    getListaEventos.mockReset();
    getListaEventos.mockResolvedValue({ eventosFiltrados: [eventoDurango, eventoReynosa] });
  });

  // El evento aparece dos veces (hero + tarjeta de la sección "Próximos Eventos"):
  // el hero SIEMPRE muestra el primero de la lista sin filtrar (no cambia con la
  // ciudad), así que la aserción se ancla a la tarjeta, un <h3> dentro del grid.
  const tarjeta = (nombre: string) => screen.queryByRole("heading", { level: 3, name: nombre });

  it("sin filtro de ciudad: muestra los eventos de todas las ciudades", async () => {
    render(<EventosView />);

    await waitFor(() => expect(tarjeta("Tuff Riders")).toBeInTheDocument());
    expect(tarjeta("Sky Fest")).toBeInTheDocument();
  });

  it("con ?ciudad=<id de una ciudad CON eventos>: solo muestra los de esa ciudad", async () => {
    mockSearch = new URLSearchParams({ ciudad: String(DURANGO_ID) });

    render(<EventosView />);

    await waitFor(() => expect(tarjeta("Tuff Riders")).toBeInTheDocument());
    expect(tarjeta("Sky Fest")).not.toBeInTheDocument();
  });

  it("con ?ciudad=<id de una ciudad SIN eventos>: no muestra eventos y avisa que no hay", async () => {
    mockSearch = new URLSearchParams({ ciudad: "999" });

    render(<EventosView />);

    await waitFor(() =>
      expect(screen.getByText("No hay eventos disponibles en esta ciudad.")).toBeInTheDocument(),
    );
    expect(tarjeta("Tuff Riders")).not.toBeInTheDocument();
    expect(tarjeta("Sky Fest")).not.toBeInTheDocument();
  });
});
