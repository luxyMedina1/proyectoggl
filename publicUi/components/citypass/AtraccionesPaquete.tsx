'use client';

import { useState } from 'react';
import { GaleriaModal } from '../GaleriaModal';
import { sanitizeRichText } from '../../../utils/sanitizeHtml';
import type { CityPassAtraccion } from '../../../types/CityPass';

interface Props {
    atracciones: CityPassAtraccion[];
}

// Lista de atracciones incluidas en el paquete. Isla de cliente solo por el modal
// de galería al hacer clic en una tarjeta; el resto del contenido es estático.
export const AtraccionesPaquete = ({ atracciones }: Props) => {
    const [modal, setModal] = useState<{ imagenes: string[]; titulo: string; indice: number } | null>(null);

    const abrirGaleria = (imagenes: string[], titulo: string, indice = 0) => {
        if (!imagenes.length) return;
        setModal({ imagenes, titulo, indice });
    };

    return (
        <>
            <div className="flex flex-col gap-4">
                {atracciones.map((atraccion) => {
                    // Galería propia de la atracción; si no tiene, usa su imagen principal.
                    const imagenesAtraccion = atraccion.galeria.length
                        ? atraccion.galeria.map((g) => g.url)
                        : atraccion.imagenPrincipal
                          ? [atraccion.imagenPrincipal]
                          : [];
                    const clickable = imagenesAtraccion.length > 0;
                    const verGaleria = () =>
                        abrirGaleria(imagenesAtraccion, `Galería de ${atraccion.nombre}`);
                    return (
                        <article
                            key={atraccion.id}
                            onClick={clickable ? verGaleria : undefined}
                            onKeyDown={
                                clickable
                                    ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              verGaleria();
                                          }
                                      }
                                    : undefined
                            }
                            role={clickable ? 'button' : undefined}
                            tabIndex={clickable ? 0 : undefined}
                            title={clickable ? `Ver galería de ${atraccion.nombre}` : undefined}
                            className={`flex items-center gap-4 rounded-2xl border border-gray-200 p-4 ${
                                clickable
                                    ? 'cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accentBase'
                                    : ''
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-gray-900">{atraccion.nombre}</h3>
                                {atraccion.descripcion && (
                                    // La descripción viene con HTML: se respeta el markup y se limita a 3 líneas.
                                    <div
                                        className="citypass-rich-text mt-1 text-sm text-gray-500 line-clamp-3"
                                        dangerouslySetInnerHTML={{
                                            __html: sanitizeRichText(atraccion.descripcion),
                                        }}
                                    />
                                )}
                            </div>
                            {atraccion.imagenPrincipal && (
                                <img
                                    src={atraccion.imagenPrincipal}
                                    alt={atraccion.nombre}
                                    className="h-24 w-32 flex-none rounded-xl object-cover"
                                />
                            )}
                        </article>
                    );
                })}
            </div>

            <GaleriaModal
                imagenes={modal?.imagenes ?? []}
                abierto={modal !== null}
                indiceInicial={modal?.indice ?? 0}
                titulo={modal?.titulo}
                onClose={() => setModal(null)}
            />
        </>
    );
};
