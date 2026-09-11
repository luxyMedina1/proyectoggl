import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// El botón de CityPass del header (HeaderBuscador) debe reflejar la disponibilidad
// REAL de la ciudad elegida en el <select>, no solo si hay ciudades cargadas.
// Antes `cityPassDisponible` era `ciudades.length > 0`: con dos ciudades en el
// selector, una con CityPass configurado y otra sin él, el botón quedaba
// habilitado para ambas por igual.
const push = vi.fn();
let mockPathname = "/eventos";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => mockPathname,
}));

let authStatus: "authenticated" | "unauthenticated" = "unauthenticated";
vi.mock("../../hooks/useAuthStore", () => ({
  useAuthStore: () => ({
    checkAuthToken: vi.fn(),
    startLogout: vi.fn(),
    user: null,
    status: authStatus,
  }),
}));

const requestLogin = vi.fn();
vi.mock("../../context/AuthModalContext", () => ({
  useAuthModal: () => ({ requestLogin }),
}));

vi.mock("../../hooks/useAmigosStore", () => ({
  useAmigosStore: () => ({ getSolicitudesRecibidas: vi.fn(async () => []) }),
}));

vi.mock("../../hooks/useTransferenciasStore", () => ({
  useTransferenciasStore: () => ({ getPendientesRecibidas: vi.fn(async () => []) }),
}));

vi.mock("../../context/ColorContext", () => ({
  useColorConfig: () => ({ config: {} }),
}));

vi.mock("../../utils/notifEvents", () => ({
  onNotifRefresh: () => () => {},
}));

const DURANGO = { id: 1, nombre: "Durango" };
const REYNOSA = { id: 2, nombre: "Reynosa" };

const getAllCiudades = vi.fn();
vi.mock("../../hooks/useCiudadesStore", () => ({
  useCiudadesStore: () => ({ getAllCiudades: () => getAllCiudades() }),
}));

const getLanding = vi.fn();
vi.mock("../../hooks/useCityPassStore", () => ({
  useCityPassStore: () => ({ getLanding: (id: number) => getLanding(id) }),
}));

import SiteLayout from "./layout";

describe("SiteLayout — disponibilidad de CityPass por ciudad", () => {
  beforeEach(() => {
    authStatus = "unauthenticated";
    push.mockReset();
    getAllCiudades.mockReset();
    getLanding.mockReset();
    requestLogin.mockReset();
  });

  it("habilita el botón de CityPass cuando la ciudad por defecto SÍ tiene CityPass configurado", async () => {
    getAllCiudades.mockResolvedValue([DURANGO, REYNOSA]);
    getLanding.mockImplementation(async (id: number) =>
      id === DURANGO.id ? { configurada: true, ciudad: DURANGO } : { configurada: false, ciudad: REYNOSA, mensaje: "no" },
    );

    render(<SiteLayout>contenido</SiteLayout>);

    const boton = (await screen.findAllByRole("button", { name: "Ir al CityPass" }))[0];
    await waitFor(() => expect(boton).toBeEnabled());
    expect(getLanding).toHaveBeenCalledWith(DURANGO.id);
  });

  it("deshabilita el botón cuando la ciudad elegida NO tiene CityPass configurado", async () => {
    getAllCiudades.mockResolvedValue([DURANGO, REYNOSA]);
    getLanding.mockImplementation(async (id: number) =>
      id === DURANGO.id ? { configurada: true, ciudad: DURANGO } : { configurada: false, ciudad: REYNOSA, mensaje: "no" },
    );

    render(<SiteLayout>contenido</SiteLayout>);

    const boton = (await screen.findAllByRole("button", { name: "Ir al CityPass" }))[0];
    await waitFor(() => expect(boton).toBeEnabled());

    const selects = screen.getAllByRole("combobox", { name: "Selecciona una ciudad" });
    await userEvent.selectOptions(selects[0], String(REYNOSA.id));

    await waitFor(() => expect(getLanding).toHaveBeenCalledWith(REYNOSA.id));
    await waitFor(() => expect(boton).toBeDisabled());
  });

  it("deshabilita el botón cuando no hay ninguna ciudad disponible", async () => {
    getAllCiudades.mockResolvedValue([]);

    render(<SiteLayout>contenido</SiteLayout>);

    const boton = (await screen.findAllByRole("button", { name: "Ir al CityPass" }))[0];
    await waitFor(() => expect(boton).toBeDisabled());
    expect(getLanding).not.toHaveBeenCalled();
  });
});

describe("SiteLayout — pide iniciar sesión antes de entrar a CityPass", () => {
  beforeEach(() => {
    authStatus = "unauthenticated";
    push.mockReset();
    getAllCiudades.mockReset();
    getLanding.mockReset();
    requestLogin.mockReset();
    getAllCiudades.mockResolvedValue([DURANGO]);
    getLanding.mockResolvedValue({ configurada: true, ciudad: DURANGO });
  });

  it("sin sesión: abre el modal de login y NO navega si el usuario lo cierra sin loguearse", async () => {
    requestLogin.mockResolvedValue(false);

    render(<SiteLayout>contenido</SiteLayout>);

    const boton = (await screen.findAllByRole("button", { name: "Ir al CityPass" }))[0];
    await waitFor(() => expect(boton).toBeEnabled());

    await userEvent.click(boton);

    await waitFor(() => expect(requestLogin).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
  });

  it("sin sesión: si el usuario inicia sesión en el modal, navega a CityPass", async () => {
    requestLogin.mockResolvedValue(true);

    render(<SiteLayout>contenido</SiteLayout>);

    const boton = (await screen.findAllByRole("button", { name: "Ir al CityPass" }))[0];
    await waitFor(() => expect(boton).toBeEnabled());

    await userEvent.click(boton);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/citypass/durango"));
  });

  it("ya autenticado: entra directo, sin pedir login", async () => {
    authStatus = "authenticated";

    render(<SiteLayout>contenido</SiteLayout>);

    const boton = (await screen.findAllByRole("button", { name: "Ir al CityPass" }))[0];
    await waitFor(() => expect(boton).toBeEnabled());

    await userEvent.click(boton);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/citypass/durango"));
    expect(requestLogin).not.toHaveBeenCalled();
  });
});

describe("SiteLayout — cambiar de ciudad filtra /eventos", () => {
  beforeEach(() => {
    authStatus = "unauthenticated";
    mockPathname = "/eventos";
    push.mockReset();
    getAllCiudades.mockReset();
    getLanding.mockReset();
    requestLogin.mockReset();
    getAllCiudades.mockResolvedValue([DURANGO, REYNOSA]);
    getLanding.mockResolvedValue({ configurada: true, ciudad: DURANGO });
    window.history.pushState(null, "", "/eventos");
  });

  it("estando en /eventos: elegir otra ciudad navega con ?ciudad=<id>", async () => {
    render(<SiteLayout>contenido</SiteLayout>);

    const selects = await screen.findAllByRole("combobox", { name: "Selecciona una ciudad" });
    await userEvent.selectOptions(selects[0], String(REYNOSA.id));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/eventos?ciudad=2"));
  });

  it("conserva ?buscar= ya presente en la URL al cambiar de ciudad", async () => {
    window.history.pushState(null, "", "/eventos?buscar=rock");

    render(<SiteLayout>contenido</SiteLayout>);

    const selects = await screen.findAllByRole("combobox", { name: "Selecciona una ciudad" });
    await userEvent.selectOptions(selects[0], String(REYNOSA.id));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/eventos?buscar=rock&ciudad=2"));
  });

  it("fuera de /eventos: elegir ciudad NO navega (solo actualiza el estado para CityPass)", async () => {
    mockPathname = "/explorar";

    render(<SiteLayout>contenido</SiteLayout>);

    const selects = await screen.findAllByRole("combobox", { name: "Selecciona una ciudad" });
    await userEvent.selectOptions(selects[0], String(REYNOSA.id));

    await waitFor(() => expect(getLanding).toHaveBeenCalledWith(REYNOSA.id));
    expect(push).not.toHaveBeenCalled();
  });
});
