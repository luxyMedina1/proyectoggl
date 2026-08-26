import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import { TbPhotoOff } from "react-icons/tb";
import { ReelMedia as ReelMediaType } from "../types";
import { ReelVideo } from "./ReelVideo";

interface Props {
  media: ReelMediaType[];
  active: boolean; // reel activo en el viewport
  near: boolean; // reel dentro de la ventana de precarga
  muted: boolean;
  // Control externo del carrusel (las flechas de desktop viven fuera del reel,
  // en ReelSlide, para no estorbar sobre el contenido).
  swiperRef?: React.MutableRefObject<SwiperType | null>;
  onSlide?: (index: number) => void;
}

const Imagen = ({ media }: { media: ReelMediaType }) => (
  // object-contain: imagen completa sobre el fondo negro del frame (letterbox),
  // sin recortar ni deformar imágenes de distinta proporción.
  <img src={media.url} alt="" loading="lazy" className="h-full w-full object-contain" />
);

const SinMedia = () => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-darker/90 text-neutral/70">
    <TbPhotoOff className="text-4xl" />
    <p className="text-sm">Sin multimedia</p>
  </div>
);

// Renderiza la multimedia de un reel: pieza única o carrusel horizontal.
// El video reproduce sólo si el reel está activo y su slide está activa.
export const ReelMedia = ({ media, active, near, muted, swiperRef, onSlide }: Props) => {
  const [slide, setSlide] = useState(0);
  const internalSwiper = useRef<SwiperType | null>(null);
  const piezas = [...(media ?? [])].sort((a, b) => a.orden - b.orden);

  if (piezas.length === 0) return <SinMedia />;

  const renderPieza = (m: ReelMediaType, idx: number) => {
    if (m.tipo === "video") {
      // Fuera de la ventana de precarga: sólo el poster (ahorro de datos móviles).
      if (!near) {
        return m.thumbnailUrl ? (
          <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <SinMedia />
        );
      }
      return <ReelVideo media={m} muted={muted} shouldPlay={active && slide === idx} />;
    }
    return <Imagen media={m} />;
  };

  if (piezas.length === 1) {
    return <div className="h-full w-full">{renderPieza(piezas[0], 0)}</div>;
  }

  return (
    <div className="relative h-full w-full">
      <Swiper
        modules={[Pagination]}
        slidesPerView={1}
        pagination={{ clickable: true }}
        onSwiper={(s) => {
          internalSwiper.current = s;
          if (swiperRef) swiperRef.current = s;
        }}
        onSlideChange={(s) => {
          setSlide(s.activeIndex);
          onSlide?.(s.activeIndex);
        }}
        className="reel-swiper h-full w-full"
      >
        {piezas.map((m, idx) => (
          <SwiperSlide key={m.id} className="h-full w-full">
            {renderPieza(m, idx)}
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Indicador de posición 1/3 */}
      <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
        {slide + 1}/{piezas.length}
      </span>
    </div>
  );
};
