"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { GoChevronLeft, GoChevronRight } from "react-icons/go";
import { rutaEvento } from "../../utils/eventoSlug";

// Port del HeroHome de v2 (549f804 + aec7044). Diferencias con el original:
// - next/link y next/image (`fill` + `preload`: es el elemento LCP de la home).
// - El slide visible se deriva de `activeEvent` en vez de llevar un índice propio:
//   EventosView conserva el evento activo por id cuando se vuelve a pedir la lista,
//   y con un índice interno que se reinicia a 0 el texto y el banner se desfasaban.

type EventoRuta = Parameters<typeof rutaEvento>[0];

// Estructura mínima del evento que necesita el Hero. El componente es genérico
// sobre T para conservar el tipo concreto en los callbacks.
type HeroEvento = EventoRuta & {
  id: number;
  nombre: string;
  imagenBanner?: string;
  imagenPromocion?: string;
  artista?: { nombre?: string } | null;
  recinto?: { nombre?: string } | null;
};

interface HeroHomeProps<T extends HeroEvento> {
  /** Lista de eventos que alimenta el banner. Solo se usan los 3 primeros. */
  eventos: T[];
  /** Evento actualmente visible. */
  activeEvent: T | null;
  /** Actualiza el evento activo al cambiar de banner. */
  onActiveEventChange: (evento: T) => void;
  /** Handler de click para el botón "Ver entradas" (abre modal multifunción, etc.). */
  onVerClick: (e: React.MouseEvent, evento: T) => void;
}

const MAX_SLIDES = 3;
const AUTOPLAY_MS = 5000;
const IMAGEN_FALLBACK = "/event_default.webp";

/**
 * Hero de la Home. Carrusel propio (sin Swiper).
 *
 * - Desktop (lg+): fila. Bloque azul de texto a la izquierda y banner a la derecha.
 *   Flechas ‹ › fuera del Hero, en el margen blanco a cada lado + autoplay.
 * - Mobile: columna. Bloque azul arriba y banner debajo en 16:9. Sin flechas ni swipe.
 *
 * El alto del banner lo fija el contenedor (aspecto en mobile / h-80 en desktop), nunca
 * la imagen: no hay saltos al rotar entre banners de proporciones distintas (0 CLS).
 */
export const HeroHome = <T extends HeroEvento>({
  eventos,
  activeEvent,
  onActiveEventChange,
  onVerClick,
}: HeroHomeProps<T>) => {
  const slides = eventos.slice(0, MAX_SLIDES);
  const hayEventos = slides.length > 0;
  const index = Math.max(0, slides.findIndex((e) => e.id === activeEvent?.id));
  const slideActual: T | undefined = slides[index];
  const conNavegacion = slides.length > 1;

  const irA = (siguiente: number) => {
    if (!hayEventos) return;
    onActiveEventChange(slides[(siguiente + slides.length) % slides.length]);
  };

  // Autoplay: un timeout por slide, así un click en las flechas reinicia la cuenta.
  useEffect(() => {
    if (!conNavegacion) return;
    const timer = setTimeout(() => irA(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, eventos, conNavegacion]);

  const banner = slideActual?.imagenBanner || slideActual?.imagenPromocion || IMAGEN_FALLBACK;

  return (
    <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 mt-8">
      {/* Contenedor relativo: las flechas se anclan a sus bordes, quedando en el
          espacio blanco lateral (padding del container), no sobre el Hero. */}
      <div className="relative">
        {conNavegacion && (
          <button
            type="button"
            onClick={() => irA(index - 1)}
            aria-label="Evento anterior"
            className="hidden lg:flex items-center justify-center absolute -left-6 2xl:-left-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-neutral shadow-md text-emphasis hover:bg-gray-100 transition-colors z-10"
          >
            <GoChevronLeft className="text-2xl" />
          </button>
        )}

        <div className="w-full flex flex-col lg:flex-row lg:h-80 bg-emphasis rounded-2xl overflow-hidden">
          <div className="w-full lg:w-1/2 flex flex-col justify-center gap-1 px-4 pt-5 pb-4 lg:p-8">
            <h2 className="text-2xl md:text-3xl lg:text-5xl text-neutral font-bold lg:mb-2">
              {slideActual ? slideActual.artista?.nombre || slideActual.nombre : "Próximamente"}
            </h2>
            <h3 className="text-lg md:text-xl lg:text-3xl text-neutral font-semibold lg:mb-2">
              {slideActual ? slideActual.recinto?.nombre : "Eventos en breve"}
            </h3>
            {slideActual ? (
              <Link
                href={rutaEvento(slideActual)}
                onClick={(e) => onVerClick(e, slideActual)}
                className="mt-2 lg:mt-4 text-gray-50 border border-gray-200 inline-block w-fit px-3 py-2 md:px-4 md:py-3 rounded-lg text-sm md:text-lg hover:bg-neutral hover:text-accentBase transition-colors"
              >
                Ver entradas
              </Link>
            ) : (
              <p className="mt-1 md:mt-4 text-gray-200 text-sm md:text-lg">
                Mantente atento para nuevos eventos.
              </p>
            )}
          </div>

          <div className="relative w-full lg:w-1/2 aspect-[16/9] lg:aspect-auto lg:h-full bg-emphasis">
            {/* Elemento LCP de la home: `preload` pone el <link rel="preload"> en el <head>
                y Next le pasa `fetchPriority` a ese link (lo que pide Lighthouse). */}
            <Image
              src={banner}
              alt={slideActual?.nombre || "Eventos próximamente"}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              preload
              fetchPriority="high"
              className="object-cover"
            />
          </div>
        </div>

        {conNavegacion && (
          <button
            type="button"
            onClick={() => irA(index + 1)}
            aria-label="Siguiente evento"
            className="hidden lg:flex items-center justify-center absolute -right-6 2xl:-right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-neutral shadow-md text-emphasis hover:bg-gray-100 transition-colors z-10"
          >
            <GoChevronRight className="text-2xl" />
          </button>
        )}
      </div>
    </div>
  );
};

export default HeroHome;
