import { IoClose, IoChevronForward, IoAdd, IoCheckmark } from "react-icons/io5";
import { FiltrosPanelDraft, ReelCategoria } from "../types";
import { RangoPrecios } from "./RangoPrecios";

interface Props {
  categorias: ReelCategoria[];
  draft: FiltrosPanelDraft;
  bounds: { min: number; max: number };
  variant: "panel" | "sheet";
  onChangeDraft: (patch: Partial<FiltrosPanelDraft>) => void;
  onAplicar: () => void;
  onLimpiar: () => void;
  onClose: () => void;
}

export const FiltrosPanel = ({
  categorias,
  draft,
  bounds,
  variant,
  onChangeDraft,
  onAplicar,
  onLimpiar,
  onClose,
}: Props) => {
  const esSheet = variant === "sheet";
  // { min: 0, max: 0 } (o sin rango) => no hay eventos con boletaje en el contexto.
  const precioDisponible = bounds.max > bounds.min;
  const desde = draft.precioMin ?? bounds.min;
  const hasta = draft.precioMax ?? bounds.max;

  const onPrecio = (d: number, h: number) =>
    onChangeDraft({
      precioMin: d <= bounds.min ? null : d,
      precioMax: h >= bounds.max ? null : h,
    });

  return (
    <div className={`flex h-full flex-col bg-white ${esSheet ? "rounded-t-2xl" : "border-l border-gray-200 shadow-2xl"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        {esSheet ? (
          <h2 className="text-base font-bold text-gray-900">Filtros</h2>
        ) : (
          <span className="text-sm font-medium text-gray-400">Filtros</span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-x-1 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          {esSheet ? <IoClose className="text-lg" /> : <>Ocultar filtros <IoChevronForward /></>}
        </button>
      </div>

      {/* Cuerpo scrolleable */}
      <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 pb-5">
        {/* Rango de precios */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold text-gray-900">Rango de precios</h3>
            <button
              type="button"
              onClick={() => onChangeDraft({ precioMin: null, precioMax: null })}
              className="flex-none whitespace-nowrap text-sm text-gray-400 transition-colors hover:text-accentBase"
            >
              Limpiar filtro
            </button>
          </div>
          {precioDisponible ? (
            <>
              <p className="-mt-2 text-sm text-gray-400">Ingrese el rango</p>
              <RangoPrecios bounds={bounds} desde={desde} hasta={hasta} onChange={onPrecio} />
            </>
          ) : (
            <p className="-mt-2 text-sm text-gray-400">
              No hay eventos con precio en esta selección.
            </p>
          )}
        </section>

        {/* Secciones (categorías) */}
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold text-gray-900">Secciones</h3>
            <button
              type="button"
              onClick={() => onChangeDraft({ categoriaId: null })}
              className="flex-none whitespace-nowrap text-sm text-gray-400 transition-colors hover:text-accentBase"
            >
              Limpiar filtro
            </button>
          </div>
          {categorias.length === 0 ? (
            <p className="text-sm text-gray-400">No hay categorías disponibles.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {categorias.map((cat) => {
                const activo = draft.categoriaId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onChangeDraft({ categoriaId: activo ? null : cat.id })}
                    aria-pressed={activo}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                      activo
                        ? "bg-accentBase text-neutral"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <span>{cat.nombre}</span>
                    {activo ? (
                      <IoCheckmark className="flex-none text-lg" />
                    ) : (
                      <IoAdd className="flex-none text-lg text-accentBase" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-4">
        <button
          type="button"
          onClick={onLimpiar}
          className="flex-1 rounded-lg border border-accentBase px-4 py-2.5 text-sm font-semibold text-accentBase transition-colors hover:bg-accentBase/5"
        >
          Limpiar filtros
        </button>
        <button
          type="button"
          onClick={onAplicar}
          className="flex-1 rounded-lg bg-emphasis px-4 py-2.5 text-sm font-semibold text-neutral transition-colors hover:bg-accentBase"
        >
          Aplicar filtros
        </button>
      </div>
    </div>
  );
};
