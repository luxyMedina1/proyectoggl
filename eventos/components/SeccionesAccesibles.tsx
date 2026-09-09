import { TbTicket } from "react-icons/tb";
import { formatearDinero } from "../helpers/formatearDinero";

// Subconjunto mínimo de una sección que necesita la lista accesible. Coincide con la forma de
// `Secciones` de EventoDetalleView (id, nombre, precio, disponibilidad, tipo, color). Se mantiene
// laxo (`Partial`-style) para no acoplarse a todo el DTO y facilitar el test de propiedad.
export interface SeccionAccesible {
  id: number;
  nombre: string;
  precioSeccion: string;
  asientosDisponibles: number;
  tipo_seccion: "general" | "numerada" | "suite" | "mesas";
  colorGeneral?: string;
  color?: string;
  nombreEspecial?: string;
}

interface SeccionesAccesiblesProps<T extends SeccionAccesible> {
  secciones: T[] | null | undefined;
  // MISMO callback que dispara el clic sobre el mapa. La equivalencia lista/mapa (Req 16.3,
  // Property 10) se sostiene porque ambos caminos invocan esta función con la misma sección.
  onSeleccionarSeccion: (seccion: T) => void;
}

// Alternativa accesible al mapa de asientos (Req 16): una lista navegable por teclado donde cada
// sección es un `<button>` real (enfocable, activable con Enter/Espacio). Al activar una sección
// invoca `onSeleccionarSeccion(seccion)`, el MISMO efecto que el clic sobre el mapa.
function SeccionesAccesibles<T extends SeccionAccesible>({
  secciones,
  onSeleccionarSeccion,
}: SeccionesAccesiblesProps<T>) {
  const seleccionables = (secciones ?? []).filter((s) => s != null);

  if (seleccionables.length === 0) return null;

  return (
    <nav aria-label="Lista de secciones (alternativa accesible al mapa de asientos)" className="mt-6">
      <h3 className="text-gray-700 text-lg font-semibold mb-3">
        Elegir sección desde la lista
        <span className="block font-normal text-sm text-gray-500">
          Alternativa al mapa, navegable con teclado.
        </span>
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 list-none p-0 m-0">
        {seleccionables.map((seccion, index) => {
          const agotado =
            seccion.asientosDisponibles === null ||
            seccion.asientosDisponibles === undefined ||
            seccion.asientosDisponibles <= 0;
          const nombreVisible = seccion.nombreEspecial || seccion.nombre;
          const disponibilidadTexto = agotado
            ? "Agotado"
            : `${seccion.asientosDisponibles} disponibles`;

          return (
            <li key={seccion.id ?? index}>
              <button
                type="button"
                onClick={() => onSeleccionarSeccion(seccion)}
                disabled={agotado}
                aria-label={`Sección ${nombreVisible}, ${formatearDinero(
                  Number(seccion.precioSeccion),
                )}, ${disponibilidadTexto}`}
                className={`w-full text-left px-3 py-2 rounded-md border border-gray-300 bg-white shadow-sm flex items-center gap-x-3 transition-colors hover:border-accentBase focus:outline-none focus:ring-2 focus:ring-accentBase ${
                  agotado ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <span
                  className="grid place-items-center rounded-md w-9 h-9 shrink-0"
                  style={{ backgroundColor: seccion.colorGeneral || seccion.color || "#000000" }}
                >
                  <TbTicket className="text-xl text-white" aria-hidden="true" />
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold text-gray-800">{nombreVisible}</span>
                  <span className="text-sm text-gray-600">
                    {formatearDinero(Number(seccion.precioSeccion))}
                  </span>
                  <span className={`text-xs ${agotado ? "text-red-500" : "text-gray-500"}`}>
                    {disponibilidadTexto}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default SeccionesAccesibles;
