import { TbMoodSad, TbAlertTriangle, TbFilterOff } from "react-icons/tb";

// Skeleton que imita el layout del feed (panel info + reel 9:16 + rail).
export const ReelSkeleton = () => (
  <div className="flex h-full w-full items-stretch justify-center gap-6 px-4 py-6">
    {/* Panel info (desktop) */}
    <div className="hidden w-72 flex-col gap-4 lg:flex">
      <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
      <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
      <div className="h-10 w-3/4 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-4 w-full animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="mt-3 flex gap-3">
        <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
      </div>
    </div>
    {/* Reel */}
    <div className="aspect-[9/16] h-full max-h-[78vh] animate-pulse rounded-2xl bg-gray-200" />
    {/* Rail */}
    <div className="hidden flex-col items-center gap-4 pt-10 lg:flex">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-11 w-11 animate-pulse rounded-full bg-gray-200" />
      ))}
    </div>
  </div>
);

interface EstadoProps {
  tipo: "vacio" | "error" | "sin-resultados";
  onAccion?: () => void;
  accionLabel?: string;
}

const CONTENIDO = {
  vacio: {
    icon: <TbMoodSad />,
    titulo: "Aún no hay reels",
    mensaje: "Cuando se publique contenido, lo verás aquí.",
  },
  error: {
    icon: <TbAlertTriangle />,
    titulo: "No se pudo cargar el contenido",
    mensaje: "Revisa tu conexión e inténtalo de nuevo.",
  },
  "sin-resultados": {
    icon: <TbFilterOff />,
    titulo: "Sin resultados",
    mensaje: "Ningún reel coincide con los filtros seleccionados.",
  },
} as const;

export const EstadoFeed = ({ tipo, onAccion, accionLabel }: EstadoProps) => {
  const c = CONTENIDO[tipo];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-gray-100 text-3xl text-accentBase">
        {c.icon}
      </span>
      <h2 className="text-xl font-bold text-gray-900">{c.titulo}</h2>
      <p className="max-w-sm text-gray-500">{c.mensaje}</p>
      {onAccion && (
        <button
          type="button"
          onClick={onAccion}
          className="mt-2 rounded-lg bg-accentBase px-5 py-2.5 text-sm font-semibold text-neutral transition-colors hover:bg-accentLight"
        >
          {accionLabel ?? "Reintentar"}
        </button>
      )}
    </div>
  );
};
