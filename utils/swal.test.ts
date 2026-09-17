import { describe, it, expect, vi, beforeEach } from "vitest";

// `fireSwal`/`precalentarSwal` reemplazan el `import Swal from 'sweetalert2'` estático (ver
// utils/swal.ts): sweetalert2 solo debe descargarse con `import()` dinámico, la primera vez
// que de verdad se necesita, no en el bundle inicial de cada página que lo usa.
const fire = vi.fn(async (...args: unknown[]) => ({ isConfirmed: true, args }));
vi.mock("sweetalert2", () => ({
  default: { fire },
}));

import { fireSwal, precalentarSwal } from "./swal";

beforeEach(() => {
  fire.mockClear();
});

describe("fireSwal — reemplazo dinámico de Swal.fire", () => {
  it("con un objeto de opciones, lo pasa tal cual a Swal.fire", async () => {
    await fireSwal({ title: "Error", text: "algo salió mal", icon: "error" });
    expect(fire).toHaveBeenCalledWith({ title: "Error", text: "algo salió mal", icon: "error" });
  });

  it("con title/html/icon sueltos (forma corta), los pasa como argumentos posicionales", async () => {
    await fireSwal("Mensaje", "Ingresa un código valido", "warning");
    expect(fire).toHaveBeenCalledWith("Mensaje", "Ingresa un código valido", "warning");
  });

  it("devuelve el resultado real de Swal.fire (ej. isConfirmed para diálogos de confirmación)", async () => {
    const resultado = await fireSwal({ title: "¿Confirmar?", showCancelButton: true });
    expect(resultado.isConfirmed).toBe(true);
  });
});

describe("precalentarSwal — descarga el chunk sin bloquear ni duplicar el import", () => {
  it("no lanza y no espera a que termine la descarga", () => {
    expect(() => precalentarSwal()).not.toThrow();
  });

  it("llamadas repetidas de fireSwal cada una dispara su propio Swal.fire", async () => {
    await fireSwal({ title: "Uno" });
    await fireSwal({ title: "Dos" });
    await fireSwal({ title: "Tres" });
    expect(fire).toHaveBeenCalledTimes(3);
  });
});
