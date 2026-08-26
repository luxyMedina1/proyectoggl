import { useRef, useState } from "react";
import type { Swiper as SwiperType } from "swiper";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { Reel } from "../types";
import { ReelMedia } from "./ReelMedia";
import { ReelInfoPanel } from "./ReelInfoPanel";
import { ReelActionRail } from "./ReelActionRail";

interface Props {
  reel: Reel;
  idx: number;
  activeIndex: number;
  muted: boolean;
  filtrosOpen: boolean;
  filtrosCount: number;
  hasPrev: boolean;
  hasNext: boolean;
  registerRef: (el: HTMLElement | null) => void;
  onCTA: (reel: Reel) => void;
  onVerMapa: (reel: Reel) => void;
  onLike: (reel: Reel) => void;
  onToggleMute: () => void;
  onToggleFiltros: () => void;
  onPrev: () => void;
  onNext: () => void;
}

// Flecha de carrusel para desktop, ubicada FUERA del reel (en el hueco lateral)
// para no tapar el contenido.
const FlechaCarrusel = ({
  lado,
  disabled,
  onClick,
}: {
  lado: "izq" | "der";
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={lado === "izq" ? "Imagen anterior" : "Imagen siguiente"}
    className="hidden h-11 w-11 flex-none place-items-center self-center rounded-full bg-white text-gray-700 shadow-md ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-30 lg:grid"
  >
    {lado === "izq" ? <IoChevronBack className="text-2xl" /> : <IoChevronForward className="text-2xl" />}
  </button>
);

// Un reel a pantalla completa dentro del feed con scroll-snap.
// Mobile: media full-bleed + info y rail superpuestos (carrusel por swipe + puntos).
// Desktop: media en tarjeta 9:16, flechas de carrusel a los costados (fuera del
// reel) y rail de acciones al lado; la info va en el panel lateral.
export const ReelSlide = ({
  reel,
  idx,
  activeIndex,
  muted,
  filtrosOpen,
  filtrosCount,
  hasPrev,
  hasNext,
  registerRef,
  onCTA,
  onVerMapa,
  onLike,
  onToggleMute,
  onToggleFiltros,
  onPrev,
  onNext,
}: Props) => {
  const active = idx === activeIndex;
  const near = Math.abs(idx - activeIndex) <= 1;

  const carouselRef = useRef<SwiperType | null>(null);
  const [caroSlide, setCaroSlide] = useState(0);
  const total = reel.media?.length ?? 0;
  const tieneCarrusel = total > 1;

  const rail = (variant: "side" | "overlay") => (
    <ReelActionRail
      reel={reel}
      variant={variant}
      muted={muted}
      hasPrev={hasPrev}
      hasNext={hasNext}
      filtrosOpen={filtrosOpen}
      filtrosCount={filtrosCount}
      onPrev={onPrev}
      onNext={onNext}
      onLike={() => onLike(reel)}
      onToggleMute={onToggleMute}
      onToggleFiltros={onToggleFiltros}
    />
  );

  return (
    <section
      ref={registerRef}
      data-index={idx}
      className="relative flex h-full w-full snap-start snap-always items-center justify-center"
    >
      <div className="flex h-full w-full items-center justify-center gap-2 lg:gap-3">
        {/* Flecha izquierda (desktop, fuera del reel) */}
        {tieneCarrusel && (
          <FlechaCarrusel
            lado="izq"
            disabled={caroSlide === 0}
            onClick={() => carouselRef.current?.slidePrev()}
          />
        )}

        {/* Frame de media */}
        <div className="relative h-full w-full overflow-hidden bg-black lg:h-auto lg:aspect-[9/16] lg:max-h-[82vh] lg:w-auto lg:rounded-2xl lg:shadow-2xl">
          <ReelMedia
            media={reel.media}
            active={active}
            near={near}
            muted={muted}
            swiperRef={carouselRef}
            onSlide={setCaroSlide}
          />

          {/* Overlays sólo mobile */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent lg:hidden" />
          {/* pb amplio: deja libre la franja inferior para que se vean los puntos del carrusel */}
          <div className="absolute inset-x-0 bottom-0 z-10 px-4 pt-4 pb-14 lg:hidden">
            <div className="pointer-events-auto pr-16">
              <ReelInfoPanel reel={reel} variant="overlay" onCTA={onCTA} onVerMapa={onVerMapa} />
            </div>
          </div>
          <div className="absolute bottom-24 right-3 z-20 lg:hidden">{rail("overlay")}</div>
        </div>

        {/* Flecha derecha (desktop, fuera del reel) */}
        {tieneCarrusel && (
          <FlechaCarrusel
            lado="der"
            disabled={caroSlide >= total - 1}
            onClick={() => carouselRef.current?.slideNext()}
          />
        )}

        {/* Rail al costado (desktop) */}
        <div className="hidden self-center lg:flex">{rail("side")}</div>
      </div>
    </section>
  );
};
