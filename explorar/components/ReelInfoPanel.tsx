import { HiLocationMarker } from "react-icons/hi";
import { BsFillCalendarEventFill, BsTicketPerforatedFill } from "react-icons/bs";
import { FaRegMap } from "react-icons/fa";
import { FiExternalLink } from "react-icons/fi";
import { Reel } from "../types";
import { formatDate } from "../../utils/dateHelpers";
import { resolverDestino } from "../helpers/navegacion";

interface Props {
  reel: Reel;
  variant: "panel" | "overlay";
  onCTA: (reel: Reel) => void;
  onVerMapa: (reel: Reel) => void;
}

// Panel de información del evento asociado al reel.
// "panel"  -> columna lateral (desktop) sobre fondo claro.
// "overlay"-> superpuesto sobre el video (mobile), texto claro con scrim.
export const ReelInfoPanel = ({ reel, variant, onCTA, onVerMapa }: Props) => {
  const overlay = variant === "overlay";
  const destino = resolverDestino(reel);
  const ctaDeshabilitado = destino.tipo === "ninguno";
  const esExterno = destino.tipo === "externo";
  const recinto = reel.evento?.recinto ?? null;
  const tag = reel.categoria?.nombre ?? reel.tags?.[0];

  const textoMuted = overlay ? "text-white/85" : "text-gray-500";
  const textoTitulo = overlay ? "text-white" : "text-gray-900";
  const iconColor = overlay ? "text-white/70" : "text-gray-500";

  // Tamaños: el panel lateral (desktop) usa tipografía más grande y un badge de
  // categoría más prominente que el overlay (mobile).
  const tagSize = overlay
    ? "gap-x-1.5 px-3 py-1 text-xs"
    : "gap-x-2 px-4 py-2 text-sm";
  const tituloSize = overlay ? "text-2xl" : "text-4xl 2xl:text-5xl";
  const descSize = overlay ? "line-clamp-2 text-sm" : "line-clamp-3 text-lg";
  const metaSize = overlay ? "text-sm" : "text-base";
  const metaIcon = overlay ? "text-lg" : "text-xl";
  const btnSize = overlay ? "px-5 py-2.5 text-sm" : "px-6 py-3 text-base";
  const btnMapaSize = overlay ? "px-4 py-2.5 text-sm" : "px-5 py-3 text-base";

  return (
    <div className={overlay ? "flex flex-col gap-y-2.5" : "flex flex-col gap-y-4"}>
      {tag && (
        <span
          className={`inline-flex w-fit items-center rounded-full bg-accentBase font-bold uppercase tracking-wide text-neutral ${tagSize}`}
        >
          <BsTicketPerforatedFill className={overlay ? "text-sm" : "text-base"} />
          {tag}
        </span>
      )}

      <h1 className={`font-bold leading-tight ${textoTitulo} ${tituloSize}`}>{reel.titulo}</h1>

      {reel.descripcion && (
        <p className={`${textoMuted} ${descSize}`}>{reel.descripcion}</p>
      )}

      {recinto && (
        <p className={`flex items-start gap-x-2 ${metaSize} ${textoMuted}`}>
          <HiLocationMarker className={`mt-0.5 flex-none ${metaIcon} ${iconColor}`} />
          <span>
            <span className={overlay ? "font-semibold text-white" : "font-semibold text-gray-700"}>
              {recinto.nombre}
            </span>
            <span className="block">
              {recinto.direccion}
              {recinto.ciudad ? `, ${recinto.ciudad}` : ""}
            </span>
          </span>
        </p>
      )}

      {reel.evento?.fecha && (
        <p className={`flex items-center gap-x-2 ${metaSize} ${textoMuted}`}>
          <BsFillCalendarEventFill className={`flex-none ${metaIcon} ${iconColor}`} />
          <span className="capitalize">
            {formatDate(reel.evento.fecha, "d 'de' MMMM 'de' yyyy, hh:mm a")}
          </span>
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-3">
        {recinto && (
          <button
            type="button"
            onClick={() => onVerMapa(reel)}
            className={`inline-flex items-center gap-x-2 rounded-lg border font-medium transition-colors ${btnMapaSize} ${
              overlay
                ? "border-white/40 text-white hover:bg-white/15"
                : "border-accentBase text-accentBase hover:bg-accentBase hover:text-neutral"
            }`}
          >
            <FaRegMap /> Ver mapa
          </button>
        )}
        <button
          type="button"
          onClick={() => onCTA(reel)}
          disabled={ctaDeshabilitado}
          className={`inline-flex items-center gap-x-2 rounded-lg bg-accentBase font-semibold text-neutral transition-colors hover:bg-accentLight disabled:cursor-not-allowed disabled:opacity-50 ${btnSize}`}
        >
          {esExterno ? <FiExternalLink /> : <BsTicketPerforatedFill />}
          {ctaDeshabilitado ? "Enlace no disponible" : reel.textoBoton || "Comprar"}
        </button>
      </div>
    </div>
  );
};
