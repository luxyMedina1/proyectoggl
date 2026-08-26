import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import { IoClose, IoChevronBack, IoChevronForward } from 'react-icons/io5';

interface Props {
    imagenes: string[];
    abierto: boolean;
    onClose: () => void;
    titulo?: string;
    indiceInicial?: number;
}

// Modal reutilizable para ver fotos en grande (carrusel horizontal con vecinas parciales).
export const GaleriaModal = ({
    imagenes,
    abierto,
    onClose,
    titulo = 'Galería',
    indiceInicial = 0,
}: Props) => {
    const [swiper, setSwiper] = useState<SwiperClass | null>(null);

    // Cerrar con Escape, navegar con flechas y bloquear el scroll del fondo.
    useEffect(() => {
        if (!abierto) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') swiper?.slidePrev();
            if (e.key === 'ArrowRight') swiper?.slideNext();
        };
        document.addEventListener('keydown', onKey);
        const overflowPrevio = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflowPrevio;
        };
    }, [abierto, onClose, swiper]);

    if (!abierto || !imagenes?.length) return null;

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
        >
            <div
                className="relative w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Encabezado */}
                <div className="flex items-center justify-between px-5 py-4">
                    <h2 className="text-lg font-bold text-gray-800 md:text-xl">{titulo}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar galería"
                        className="grid h-9 w-9 place-items-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                    >
                        <IoClose className="text-2xl" />
                    </button>
                </div>

                {/* Carrusel */}
                <div className="relative px-2 pb-6 md:px-4">
                    <Swiper
                        onSwiper={setSwiper}
                        initialSlide={indiceInicial}
                        centeredSlides
                        spaceBetween={16}
                        slidesPerView={1.15}
                        breakpoints={{
                            768: { slidesPerView: 1.8, spaceBetween: 20 },
                            1024: { slidesPerView: 2.2, spaceBetween: 24 },
                        }}
                    >
                        {imagenes.map((url, i) => (
                            <SwiperSlide key={`${url}-${i}`}>
                                <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100">
                                    <img
                                        src={url}
                                        alt={`${titulo} ${i + 1}`}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>

                    {imagenes.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={() => swiper?.slidePrev()}
                                aria-label="Anterior"
                                className="absolute left-1 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-gray-700 shadow-md transition hover:bg-gray-100"
                            >
                                <IoChevronBack className="text-xl" />
                            </button>
                            <button
                                type="button"
                                onClick={() => swiper?.slideNext()}
                                aria-label="Siguiente"
                                className="absolute right-1 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-gray-700 shadow-md transition hover:bg-gray-100"
                            >
                                <IoChevronForward className="text-xl" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
