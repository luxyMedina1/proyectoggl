// Selector rapido de fechas para eventos multifecha (parte de arriba de la pagina de compra)
// y tarjeta de informacion con icono. Se separan aqui para no engordar EventoDetalleView.
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "../../utils/dateHelpers";
import { IconoChevron } from "./iconosEvento";

interface FuncionMin {
    id?: number | string;
    nombre?: string | null;
    fecha?: string | null;
    finalEvento?: string | null;
}

interface SelectorFechasProps {
    funciones: FuncionMin[];
    seleccionadaId?: number | string | null;
    // Ruta a la que navega cada fecha (la de su funcion).
    rutaDe: (funcion: FuncionMin) => string;
}

// Barra horizontal de pastillas de fecha. La seleccionada se resalta y se centra a la vista.
export const SelectorFechas = ({ funciones, seleccionadaId, rutaDe }: SelectorFechasProps) => {
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);
    const activaRef = useRef<HTMLButtonElement>(null);

    const seleccionada = funciones.find((f) => String(f.id) === String(seleccionadaId)) ?? funciones[0];

    // Al entrar (o cambiar de fecha) se centra la pastilla activa dentro del scroll.
    useEffect(() => {
        activaRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, [seleccionadaId]);

    const desplazar = (dir: -1 | 1) => {
        scrollRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" });
    };

    return (
        <div className="mb-6">
            <p className="text-center text-xl sm:text-2xl font-semibold text-gray-800 mb-3">
                FECHA:{" "}
                <span className="text-accentBase">
                    {seleccionada?.fecha
                        ? formatDate(seleccionada.fecha, "MMMM d").toUpperCase()
                        : ""}
                </span>
            </p>

            <div className="flex items-center gap-2 sm:gap-3">
                <button
                    type="button"
                    aria-label="Fechas anteriores"
                    onClick={() => desplazar(-1)}
                    className="shrink-0 w-9 h-9 grid place-items-center rounded-full border border-gray-300 text-gray-500 hover:text-accentBase hover:border-accentBase transition-colors"
                >
                    <IconoChevron className="w-2.5 h-2.5 rotate-180" />
                </button>

                <div
                    ref={scrollRef}
                    className="flex-1 flex gap-3 justify-center overflow-x-auto scroll-smooth py-1 px-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                    {funciones.map((funcion) => {
                        const activa = String(funcion.id) === String(seleccionada?.id);
                        return (
                            <button
                                key={String(funcion.id)}
                                ref={activa ? activaRef : undefined}
                                type="button"
                                onClick={() => !activa && router.push(rutaDe(funcion))}
                                aria-current={activa ? "true" : undefined}
                                className={`relative shrink-0 w-24 rounded-xl border px-2 py-2.5 text-center transition-all ${
                                    activa
                                        ? "border-accentBase bg-blue-50 ring-2 ring-blue-200 shadow-sm"
                                        : "border-gray-200 bg-white hover:border-accentBase hover:shadow-sm"
                                }`}
                            >
                                {activa && (
                                    <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-accentBase" />
                                )}
                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    {funcion.fecha ? formatDate(funcion.fecha, "MMM") : ""}
                                </span>
                                <span
                                    className={`block text-2xl font-bold leading-tight ${activa ? "text-accentBase" : "text-gray-800"}`}
                                >
                                    {funcion.fecha ? formatDate(funcion.fecha, "d") : "--"}
                                </span>
                                {funcion.nombre ? (
                                    <span className="block text-[11px] text-gray-500 truncate">
                                        {funcion.nombre}
                                    </span>
                                ) : (
                                    <span className="block text-[11px] text-transparent select-none">
                                        &middot;
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    aria-label="Fechas siguientes"
                    onClick={() => desplazar(1)}
                    className="shrink-0 w-9 h-9 grid place-items-center rounded-full border border-gray-300 text-gray-500 hover:text-accentBase hover:border-accentBase transition-colors"
                >
                    <IconoChevron className="w-2.5 h-2.5" />
                </button>
            </div>
        </div>
    );
};

interface InfoEventoProps {
    icono: ReactNode;
    etiqueta: string;
    valor: string;
    // Nota secundaria bajo el valor (ej. nombre de la funcion "Matutino").
    detalle?: string;
}

// Tarjeta de dato con icono para la fila "Informacion importante del evento".
export const InfoEvento = ({ icono, etiqueta, valor, detalle }: InfoEventoProps) => (
    <div className="flex items-start gap-3">
        <span className="shrink-0 grid place-items-center w-10 h-10 rounded-lg bg-blue-50 text-accentBase">
            {icono}
        </span>
        <div className="min-w-0">
            <p className="text-xs text-gray-400">{etiqueta}</p>
            <p className="text-sm font-semibold text-gray-800 leading-snug">{valor}</p>
            {detalle && <p className="text-xs text-gray-500">{detalle}</p>}
        </div>
    </div>
);
