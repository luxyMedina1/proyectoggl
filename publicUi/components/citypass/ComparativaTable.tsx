import type { CityPassComparativa } from '../../../types/CityPass';

interface Props {
    comparativa: CityPassComparativa;
}

const textoVisita = (n: number) => `Visita ${n} ${n === 1 ? 'atracción' : 'atracciones'}`;

// Tabla "Detalle de los paquetes": matriz atracción (fila) × paquete (columna).
export const ComparativaTable = ({ comparativa }: Props) => {
    if (!comparativa?.paquetes?.length || !comparativa?.atracciones?.length) return null;

    return (
        <section className="mt-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 md:text-3xl">
                Detalle de los paquetes
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse">
                    <thead>
                        <tr>
                            <th className="w-1/3" />
                            {comparativa.paquetes.map((paquete) => (
                                <th key={paquete.id} className="px-4 pb-6 align-top text-center">
                                    <span className="block text-base font-bold text-gray-900 md:text-lg">
                                        {paquete.nombre}
                                    </span>
                                    <span className="block text-xs font-normal text-gray-500 md:text-sm">
                                        {textoVisita(paquete.atraccionesIncluidas)}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {comparativa.atracciones.map((fila) => (
                            <tr key={fila.atraccionId}>
                                <td className="py-5 pr-4 font-bold text-gray-900">{fila.nombre}</td>
                                {fila.incluida.map((incluida, j) => (
                                    <td key={comparativa.paquetes[j]?.id ?? j} className="py-5 text-center">
                                        <span
                                            className={`inline-block h-7 w-7 rounded-full ${
                                                incluida
                                                    ? 'bg-accentBase'
                                                    : 'border-2 border-gray-300 bg-white'
                                            }`}
                                            aria-label={incluida ? 'Incluida' : 'No incluida'}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};
