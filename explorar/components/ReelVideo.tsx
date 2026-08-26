import { useEffect, useRef, useState } from "react";
import { IoPlay } from "react-icons/io5";
import { ReelMedia } from "../types";

interface Props {
  media: ReelMedia;
  shouldPlay: boolean; // reel activo y slide activo
  muted: boolean;
  className?: string;
}

// Video de un reel. Reproduce sólo cuando shouldPlay es true (autoplay del
// activo, muteado por defecto). El sonido lo controla el rail de acciones.
export const ReelVideo = ({ media, shouldPlay, muted, className = "" }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cargando, setCargando] = useState(true);
  // Pausa manual del usuario (tap sobre el video). Distinta del autoplay.
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (shouldPlay && !userPaused) {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        // Si el navegador bloquea el autoplay (no debería estando muteado),
        // se silencia el error y queda el poster visible.
        p.catch(() => {});
      }
    } else {
      el.pause();
    }
  }, [shouldPlay, userPaused]);

  // Al salir del reel se descarta la pausa manual: al volver, autoplay otra vez.
  useEffect(() => {
    if (!shouldPlay) setUserPaused(false);
  }, [shouldPlay]);

  // Mantener la prop muted en sync con el elemento (atributo controlado).
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Sólo el reel activo responde al tap; alterna pausa/reanudar.
  const toggle = () => {
    if (shouldPlay) setUserPaused((p) => !p);
  };

  return (
    <div className={`relative h-full w-full bg-black ${className}`}>
      {cargando && media.thumbnailUrl && (
        // Poster mientras carga el primer frame.
        <img
          src={media.thumbnailUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <video
        ref={videoRef}
        className="relative h-full w-full object-cover"
        src={media.url}
        poster={media.thumbnailUrl ?? undefined}
        muted={muted}
        loop
        playsInline
        preload={shouldPlay ? "auto" : "metadata"}
        onLoadedData={() => setCargando(false)}
      />

      {/* Tap sobre el video para pausar/reanudar. El glifo aparece sólo en pausa. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={userPaused ? "Reproducir" : "Pausar"}
        className="absolute inset-0 grid place-items-center focus:outline-none"
      >
        <span
          className={`grid h-16 w-16 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-opacity duration-200 ${
            shouldPlay && userPaused ? "opacity-100" : "opacity-0"
          }`}
        >
          <IoPlay className="ml-1 text-3xl" />
        </span>
      </button>
    </div>
  );
};
