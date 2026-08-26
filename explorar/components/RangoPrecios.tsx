interface Props {
  bounds: { min: number; max: number };
  step?: number;
  desde: number;
  hasta: number;
  onChange: (desde: number, hasta: number) => void;
}

// Slider de rango doble (dos thumbs) + inputs Desde/Hasta.
// Sin librería: dos <input type="range"> superpuestos (thumbs con pointer-events,
// pista con pointer-events:none) sobre una pista con relleno. Estilos en index.scss.
export const RangoPrecios = ({ bounds, step = 50, desde, hasta, onChange }: Props) => {
  const span = Math.max(1, bounds.max - bounds.min);
  const pct = (v: number) => ((v - bounds.min) / span) * 100;

  const setDesde = (v: number) => onChange(Math.min(v, hasta), hasta);
  const setHasta = (v: number) => onChange(desde, Math.max(v, desde));

  const clampInput = (raw: string): number => {
    const n = Number(raw.replace(/[^\d]/g, ""));
    if (Number.isNaN(n)) return bounds.min;
    return Math.min(Math.max(n, bounds.min), bounds.max);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rango-precios relative h-5">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-200" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accentBase"
          style={{ left: `${pct(desde)}%`, right: `${100 - pct(hasta)}%` }}
        />
        {/* el thumb de "desde" gana z-index cerca del tope para no quedar atrapado */}
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={desde}
          onChange={(e) => setDesde(Number(e.target.value))}
          aria-label="Precio mínimo"
          className="rango-precios__input"
          style={{ zIndex: desde > bounds.max - span / 10 ? 5 : 3 }}
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={hasta}
          onChange={(e) => setHasta(Number(e.target.value))}
          aria-label="Precio máximo"
          className="rango-precios__input"
          style={{ zIndex: 4 }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2.5">
          <span className="flex-none text-sm text-gray-400">Desde</span>
          <span className="flex min-w-0 flex-1 items-center justify-end text-sm font-medium text-gray-700">
            $
            <input
              type="text"
              inputMode="numeric"
              value={desde}
              onChange={(e) => setDesde(clampInput(e.target.value))}
              className="w-full min-w-0 bg-transparent text-right outline-none"
            />
          </span>
        </label>
        <label className="flex min-w-0 items-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2.5">
          <span className="flex-none text-sm text-gray-400">Hasta</span>
          <span className="flex min-w-0 flex-1 items-center justify-end text-sm font-medium text-gray-700">
            $
            <input
              type="text"
              inputMode="numeric"
              value={hasta}
              onChange={(e) => setHasta(clampInput(e.target.value))}
              className="w-full min-w-0 bg-transparent text-right outline-none"
            />
          </span>
        </label>
      </div>
    </div>
  );
};
