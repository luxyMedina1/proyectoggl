import { useState } from 'react';
import { BsInstagram } from 'react-icons/bs';
import { GaleriaModal } from '../GaleriaModal';
import type { CityPassGaleriaItem } from '../../../types/CityPass';

interface Props {
    galeria: CityPassGaleriaItem[];
    ciudad: string;
}

// Galería tipo mosaico con badge de Instagram. Al hacer clic se abre el modal para verla en grande.
export const GaleriaCityPass = ({ galeria, ciudad }: Props) => {
    const [modalAbierto, setModalAbierto] = useState(false);
    const [indice, setIndice] = useState(0);

    if (!galeria?.length) return null;

    const ordenada = [...galeria].sort((a, b) => a.orden - b.orden);
    const urls = ordenada.map((img) => img.url);

    const abrirEn = (i: number) => {
        setIndice(i);
        setModalAbierto(true);
    };

    return (
        <section className="mt-16 mb-8">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 md:text-3xl">
                Déjate sorprender por la belleza de {ciudad}
            </h2>
            <div className="columns-2 gap-4 md:columns-4">
                {ordenada.map((img, i) => (
                    <button
                        type="button"
                        key={`${img.url}-${i}`}
                        onClick={() => abrirEn(i)}
                        aria-label={`Ver foto ${i + 1} en grande`}
                        className="group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-2xl"
                    >
                        <img
                            src={img.url}
                            alt={`${ciudad} ${i + 1}`}
                            loading="lazy"
                            className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute right-3 top-3 text-white drop-shadow-lg">
                            <BsInstagram className="text-xl" />
                        </span>
                    </button>
                ))}
            </div>

            <GaleriaModal
                imagenes={urls}
                abierto={modalAbierto}
                indiceInicial={indice}
                titulo={`Galería de ${ciudad}`}
                onClose={() => setModalAbierto(false)}
            />
        </section>
    );
};
