import { useMemo, useState } from 'react';
import { HiMinusSmall, HiPlusSmall } from 'react-icons/hi2';
import { formatearDinero } from '../../../eventos/helpers/formatearDinero';
import type { CityPassItemCompra, CityPassPrecio } from '../../../types/CityPass';

export interface ResumenCompra {
    total: number;
    items: CityPassItemCompra[];
}

interface Props {
    precios: CityPassPrecio[];
    textoComplementario: string | null;
    disponibleVenta: boolean;
    onComprar: (resumen: ResumenCompra) => void;
}

const precioMXN = (valor: number) => `${formatearDinero(valor)} MXN`;

// Panel de selección de boletos: contador por tipo, total y botón de compra.
export const PaqueteBoletos = ({ precios, textoComplementario, disponibleVenta, onComprar }: Props) => {
    const [cantidades, setCantidades] = useState<Record<number, number>>({});

    const cambiar = (tipoBoletoId: number, delta: number) => {
        setCantidades((prev) => {
            const actual = prev[tipoBoletoId] ?? 0;
            const siguiente = Math.max(0, actual + delta);
            return { ...prev, [tipoBoletoId]: siguiente };
        });
    };

    const total = useMemo(
        () => precios.reduce((acc, p) => acc + (cantidades[p.tipoBoletoId] ?? 0) * p.precio, 0),
        [cantidades, precios],
    );

    const totalBoletos = useMemo(
        () => precios.reduce((acc, p) => acc + (cantidades[p.tipoBoletoId] ?? 0), 0),
        [cantidades, precios],
    );

    const comprar = () => {
        const items = precios
            .map((p) => ({
                tipoBoletoId: p.tipoBoletoId,
                tipoBoleto: p.tipoBoleto,
                cantidad: cantidades[p.tipoBoletoId] ?? 0,
                precio: p.precio,
            }))
            .filter((i) => i.cantidad > 0);
        onComprar({ total, items });
    };

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            {textoComplementario && (
                <p className="mb-4 text-base font-semibold text-accentBase">{textoComplementario}</p>
            )}

            <p className="mb-3 font-bold text-gray-900">Elige tus boletos:</p>

            <div className="flex flex-col gap-3">
                {precios.map((precio) => {
                    const cantidad = cantidades[precio.tipoBoletoId] ?? 0;
                    return (
                        <div key={precio.tipoBoletoId} className="rounded-xl border border-gray-200 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-700">{precio.tipoBoleto}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => cambiar(precio.tipoBoletoId, -1)}
                                        disabled={cantidad === 0}
                                        aria-label={`Quitar ${precio.tipoBoleto}`}
                                        className="grid h-8 w-8 place-items-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
                                    >
                                        <HiMinusSmall className="text-xl" />
                                    </button>
                                    <span className="w-6 text-center tabular-nums text-gray-900">{cantidad}</span>
                                    <button
                                        type="button"
                                        onClick={() => cambiar(precio.tipoBoletoId, 1)}
                                        aria-label={`Agregar ${precio.tipoBoleto}`}
                                        className="grid h-8 w-8 place-items-center rounded-md bg-accentBase text-white transition hover:bg-accentLight active:scale-95"
                                    >
                                        <HiPlusSmall className="text-xl" />
                                    </button>
                                </div>
                            </div>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{precioMXN(precio.precio)}</p>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 flex items-center justify-between">
                <span className="text-gray-600">Tu precio:</span>
                <span className="text-lg font-bold text-gray-900">{precioMXN(total)}</span>
            </div>

            <button
                type="button"
                onClick={comprar}
                disabled={!disponibleVenta || totalBoletos === 0}
                className="mt-4 w-full rounded-lg bg-accentBase py-3 text-center font-semibold text-neutral transition-colors hover:bg-accentLight disabled:cursor-not-allowed disabled:opacity-50"
            >
                {disponibleVenta ? 'Comprar ahora' : 'No disponible'}
            </button>
        </div>
    );
};
