import { useNavigate } from '@/utils/nextRouterCompat';
import { IoChevronUp, IoChevronDown } from "react-icons/io5";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { HiVolumeUp, HiVolumeOff } from "react-icons/hi";
import { LuSlidersHorizontal, LuLayoutGrid } from "react-icons/lu";
import { Reel } from "../types";

interface Props {
  reel: Reel;
  muted: boolean;
  variant: "side" | "overlay";
  hasPrev: boolean;
  hasNext: boolean;
  filtrosOpen: boolean;
  filtrosCount: number;
  onPrev: () => void;
  onNext: () => void;
  onLike: () => void;
  onToggleMute: () => void;
  onToggleFiltros: () => void;
}

const compact = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);

// Botón circular + etiqueta opcional. A nivel de módulo para no remontarlo en
// cada render del rail.
const RailButton = ({
  icon,
  label,
  ariaLabel,
  onClick,
  overlay,
  active = false,
  badge,
  disabled = false,
  transparent = false,
}: {
  icon: React.ReactNode;
  label?: string;
  ariaLabel: string;
  onClick: () => void;
  overlay: boolean;
  active?: boolean;
  badge?: string | number;
  disabled?: boolean;
  // Sin relleno de fondo: deja sólo el ícono (hover sutil para conservar el
  // affordance). El resto del rail mantiene su chip circular.
  transparent?: boolean;
}) => {
  // Superficie del botón según variante (overlay sobre video / lateral claro) y
  // si lleva o no relleno.
  const surface = transparent
    ? overlay
      ? "text-white hover:bg-white/10"
      : "text-gray-700 hover:bg-gray-100"
    : overlay
    ? "bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"
    : "bg-gray-100 text-gray-700 hover:bg-gray-200";

  return (
  <div className="flex flex-col items-center text-center gap-1">
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`reel-action relative grid h-11 w-11 place-items-center rounded-full transition-colors disabled:opacity-40 ${surface} ${
        active ? (overlay ? "!text-rose-400" : "!text-rose-500") : ""
      }`}
    >
      {/* Sin chip sobre el video el ícono necesita sombra para legibilidad. */}
      <span className={`text-xl ${transparent && overlay ? "drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]" : ""}`}>{icon}</span>
      {badge != null && (
        <span className="absolute -right-1.5 -top-1.5 grid min-w-[20px] place-items-center rounded-full bg-accentBase px-1 py-0.5 text-[10px] font-bold leading-none text-neutral">
          {badge}
        </span>
      )}
    </button>
    {label && (
      <span className={`text-[11px] font-medium ${overlay ? "text-white/90" : "text-gray-500"}`}>
        {label}
      </span>
    )}
  </div>
  );
};

export const ReelActionRail = ({
  reel,
  muted,
  variant,
  hasPrev,
  hasNext,
  filtrosOpen,
  filtrosCount,
  onPrev,
  onNext,
  onLike,
  onToggleMute,
  onToggleFiltros,
}: Props) => {
  const overlay = variant === "overlay";
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Navegación entre reels (sólo desktop; en mobile lo hace el scroll). */}
      {!overlay && (
        <div className="flex flex-col items-center gap-2">
          <RailButton icon={<IoChevronUp />} ariaLabel="Reel anterior" onClick={onPrev} overlay={overlay} disabled={!hasPrev} />
          <RailButton icon={<IoChevronDown />} ariaLabel="Siguiente reel" onClick={onNext} overlay={overlay} disabled={!hasNext} />
        </div>
      )}

      <RailButton
        icon={reel.liked ? <FaHeart /> : <FaRegHeart />}
        label={overlay ? undefined : "Me gusta"}
        badge={reel.likesCount > 0 ? compact(reel.likesCount) : undefined}
        ariaLabel={reel.liked ? "Quitar me gusta" : "Me gusta"}
        onClick={onLike}
        overlay={overlay}
        active={reel.liked}
        transparent
      />

      <RailButton
        icon={muted ? <HiVolumeOff /> : <HiVolumeUp />}
        label={overlay ? undefined : muted ? "Activar sonido" : "Silenciar"}
        ariaLabel={muted ? "Activar sonido" : "Silenciar"}
        onClick={onToggleMute}
        overlay={overlay}
        transparent
      />

      <RailButton
        icon={<LuLayoutGrid />}
        label={overlay ? undefined : "Cambiar"}
        ariaLabel="Cambiar a la lista de eventos"
        onClick={() => navigate("/eventos")}
        overlay={overlay}
        transparent
      />

      <RailButton
        icon={<LuSlidersHorizontal />}
        label={overlay ? undefined : "Filtros"}
        badge={filtrosCount > 0 ? filtrosCount : undefined}
        ariaLabel={filtrosOpen ? "Ocultar filtros" : "Mostrar filtros"}
        onClick={onToggleFiltros}
        overlay={overlay}
        active={filtrosOpen}
        transparent
      />
    </div>
  );
};
