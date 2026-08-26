import { Fragment } from 'react';
import { formatearDinero } from '../../../eventos/helpers/formatearDinero';
import type { CityPassPaqueteLanding } from '../../../types/CityPass';

interface Props {
    paquetes: CityPassPaqueteLanding[];
    onComprar: (paquete: CityPassPaqueteLanding) => void;
}

// Sección "Elige tu paquete perfecto": una card por paquete con sus precios.
export const PaquetesCityPass = ({ paquetes, onComprar }: Props) => {
    if (!paquetes?.length) return null;

    return (
        <section className="mt-12">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 md:text-3xl">
                Elige tu paquete perfecto
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
                {paquetes.map((paquete) => (
                    <article
                        key={paquete.id}
                        className="flex flex-col rounded-2xl border border-gray-200 p-6 transition-shadow hover:shadow-lg md:p-8"
                    >
                        <h3 className="text-center text-2xl font-bold text-gray-900">
                            {paquete.nombre}
                        </h3>
                        {paquete.textoComplementario && (
                            <p className="mt-2 text-center text-sm text-gray-500">
                                {paquete.textoComplementario}
                            </p>
                        )}

                        <div className="mx-auto my-6 grid w-full max-w-[220px] grid-cols-2 items-center gap-x-4 gap-y-3">
                            {paquete.precios.map((precio) => (
                                <Fragment key={precio.tipoBoletoId}>
                                    <span className="text-right text-gray-500">
                                        {precio.tipoBoleto}
                                    </span>
                                    <span className="text-left text-lg font-bold text-gray-900">
                                        {formatearDinero(precio.precio)}
                                    </span>
                                </Fragment>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => onComprar(paquete)}
                            disabled={!paquete.disponibleVenta}
                            className="mt-auto rounded-lg bg-accentBase py-3 text-center font-semibold text-neutral transition-colors hover:bg-accentLight disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {paquete.disponibleVenta ? 'Comprar paquete' : 'No disponible'}
                        </button>
                    </article>
                ))}
            </div>
        </section>
    );
};
