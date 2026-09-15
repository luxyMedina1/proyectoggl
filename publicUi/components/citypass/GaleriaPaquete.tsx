'use client';

import { useState } from 'react';
import { BsInstagram } from 'react-icons/bs';
import { GaleriaModal } from '../GaleriaModal';
import type { CityPassPaqueteDetalle } from '../../../types/CityPass';

interface Props {
    galeria: CityPassPaqueteDetalle['galeria'];
}

// Mosaico de fotos del paquete (distinto de `GaleriaCityPass`, que es el de la
// landing: layout en grid de 2/4 columnas y alt por atracción). Isla de cliente
// solo por el modal; el resto es estático.
export const GaleriaPaquete = ({ galeria }: Props) => {
    const [modal, setModal] = useState<{ indice: number } | null>(null);

    if (!galeria.length) return null;

    const urls = galeria.map((img) => img.url);

    return (
        <section className="mt-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 md:text-3xl">
                Galería del paquete
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {galeria.map((img, i) => (
                    <button
                        type="button"
                        key={`${img.url}-${i}`}
                        onClick={() => setModal({ indice: i })}
                        aria-label={`Ver foto ${i + 1} en grande`}
                        className="group relative aspect-[3/4] overflow-hidden rounded-2xl"
                    >
                        <img
                            src={img.url}
                            alt={img.atraccionNombre || `Foto ${i + 1}`}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute right-3 top-3 text-white drop-shadow-lg">
                            <BsInstagram className="text-xl" />
                        </span>
                    </button>
                ))}
            </div>

            <GaleriaModal
                imagenes={urls}
                abierto={modal !== null}
                indiceInicial={modal?.indice ?? 0}
                titulo="Galería del paquete"
                onClose={() => setModal(null)}
            />
        </section>
    );
};
