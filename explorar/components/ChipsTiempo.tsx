import { IoCheckmarkCircle } from "react-icons/io5";
import { Contadores, ReelCuando } from "../types";

interface Props {
  cuando: ReelCuando;
  contadores: Contadores | null;
  variant: "grid" | "row";
  onChange: (cuando: ReelCuando) => void;
}

const CHIPS: { value: Exclude<ReelCuando, "">; label: string; key: keyof Contadores }[] = [
  { value: "hoy", label: "Hoy", key: "hoy" },
  { value: "manana", label: "Mañana", key: "manana" },
  { value: "semana", label: "Semana", key: "semana" },
  { value: "fin_semana", label: "Fin de semana", key: "finSemana" },
];

export const ChipsTiempo = ({ cuando, contadores, variant, onChange }: Props) => {
  const fila = variant === "row";
  // Grid (desktop) usa chips más grandes; row (mobile) se mantiene compacto.
  const sizeChip = fila ? "gap-2 px-3 py-2 text-sm" : "gap-2.5 px-4 py-3 text-base";
  const sizeIcon = fila ? "text-lg" : "text-xl";
  return (
    <div
      className={
        fila
          ? "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex flex-wrap gap-2"
      }
    >
      {CHIPS.map((c) => {
        const activo = cuando === c.value;
        const count = contadores ? contadores[c.key] : null;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(activo ? "" : c.value)}
            aria-pressed={activo}
            className={`flex flex-none items-center rounded-full border font-medium transition-colors ${sizeChip} ${
              activo
                ? "border-accentBase bg-accentBase text-neutral"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            <IoCheckmarkCircle
              className={`flex-none ${sizeIcon} ${activo ? "text-neutral" : "text-gray-300"}`}
            />
            <span className="whitespace-nowrap">{c.label}</span>
            {count != null && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none ${
                  activo ? "bg-white/25 text-neutral" : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
