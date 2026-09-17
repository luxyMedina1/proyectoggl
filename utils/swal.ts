import type { SweetAlertIcon, SweetAlertOptions, SweetAlertResult } from "sweetalert2";

// `sweetalert2` pesa ~37 KiB y se importaba con `import Swal from 'sweetalert2'` arriba de
// cada archivo: entraba al bundle inicial de la página aunque el diálogo nunca se mostrara
// (docs/checklist-migracion/08-code-splitting.md, candidato documentado). `import()` lo pone
// en un chunk aparte que Next solo descarga la primera vez que de verdad se llama `fireSwal`.
let cargaSwal: Promise<(typeof import("sweetalert2"))["default"]> | null = null;

const cargarSwal = () => {
  if (!cargaSwal) {
    cargaSwal = import("sweetalert2").then((m) => m.default);
  }
  return cargaSwal;
};

// Descarga el chunk en segundo plano sin bloquear nada, para que el primer diálogo real no
// tenga que esperar la descarga. Llamar en un `useEffect` de pantallas donde un diálogo es
// casi seguro (checkout, formularios de pago).
export const precalentarSwal = (): void => {
  void cargarSwal();
};

// Mismas dos formas de llamar que `Swal.fire` (objeto de opciones, o title/html/icon sueltos)
// para que el reemplazo en los call sites existentes sea mecánico.
export function fireSwal(options: SweetAlertOptions): Promise<SweetAlertResult>;
export function fireSwal(
  title?: string,
  html?: string,
  icon?: SweetAlertIcon,
): Promise<SweetAlertResult>;
export async function fireSwal(
  optionsOrTitle: SweetAlertOptions | string = {},
  html?: string,
  icon?: SweetAlertIcon,
): Promise<SweetAlertResult> {
  const Swal = await cargarSwal();
  if (typeof optionsOrTitle === "string") {
    return Swal.fire(optionsOrTitle, html, icon);
  }
  return Swal.fire(optionsOrTitle);
}
