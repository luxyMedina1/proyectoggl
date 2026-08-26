import { formatDate } from '../../../../utils/dateHelpers';
import { consultaMaps } from '../../../../utils/mapsHelpers';
import { DireccionMapsLink } from '../../../../components/DireccionMapsLink';
const defaultEventImage = '/event_default.webp';
import { MdDateRange, MdLocationOn } from 'react-icons/md';
import { BsCreditCard } from 'react-icons/bs';

interface BoletoLike {
    id: number;
    precio?: string | number;
    eventoSeccion?: {
        precioEspecial?: string;
        seccion?: { nombre?: string; bloque?: { nombre?: string } };
    };
    asiento?: {
        numero?: string | number;
        fila?: {
            nombre?: string;
            seccion?: { nombre?: string; bloque?: { nombre?: string } };
        };
    };
    categoria?: { nombre?: string };
    ticket?: { id?: number };
}

interface Evento {
    id?: number;
    nombre?: string;
    imagenPromocion?: string;
    fecha?: string;
    fechaCompra?: string;
    direccion?: string;
    recinto?: { nombre?: string; direccion?: string } | null;
    ciudad?: { nombre?: string } | null;
    metodoPago?: { tipo?: string; ultimosDigitos?: string } | null;
    numeroPedido?: string | number | null;
}

interface Props {
    evento: Evento | null;
    perfil: { email?: string | null } | null;
    boletos: BoletoLike[];
}

const DetallesPedidoTab = ({ evento, perfil, boletos }: Props) => {
    const total = boletos.reduce((sum, b) => {
        const p = b.eventoSeccion?.precioEspecial ?? b.precio ?? 0;
        return sum + Number(p);
    }, 0);

    const direccion = evento?.direccion || evento?.recinto?.direccion;
    const lugar = [evento?.recinto?.nombre, evento?.ciudad?.nombre].filter(Boolean).join(', ');
    const numeroPedido = evento?.numeroPedido ?? boletos[0]?.ticket?.id ?? null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Bloque principal */}
            <div className="lg:col-span-2 space-y-4">
                <div className="rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm">
                    <div className="relative">
                        <img
                            src={evento?.imagenPromocion || defaultEventImage}
                            alt={evento?.nombre ?? 'evento'}
                            className="w-full h-48 md:h-56 object-cover"
                            onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = defaultEventImage;
                            }}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 py-3">
                            <h3 className="text-white font-semibold text-lg md:text-xl">
                                Mis boletos - {evento?.nombre ?? 'Evento'}
                            </h3>
                        </div>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="flex items-center gap-2 text-gray-500 text-sm">
                                <MdDateRange className="text-lg" /> Fecha:
                            </p>
                            <p className="font-semibold text-gray-800">
                                {evento?.fecha ? formatDate(evento.fecha, 'dd MMMM yyyy') : '—'}
                            </p>
                        </div>
                        <div>
                            <p className="flex items-center gap-2 text-gray-500 text-sm">
                                <MdLocationOn className="text-lg" /> Dirección:
                            </p>
                            <p className="font-semibold text-gray-800">
                                <DireccionMapsLink consulta={consultaMaps(evento?.recinto?.nombre, direccion, evento?.ciudad?.nombre)}>
                                    {direccion ?? lugar ?? '—'}
                                </DireccionMapsLink>
                            </p>
                        </div>
                        {evento?.fechaCompra && (
                            <div className="md:col-span-2">
                                <p className="flex items-center gap-2 text-gray-500 text-sm">
                                    <MdDateRange className="text-lg" /> Fecha de la compra:
                                </p>
                                <p className="font-semibold text-gray-800">
                                    {formatDate(evento.fechaCompra, "dd 'de' MMMM 'del' yyyy - hh:mm a")}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {evento?.metodoPago && (
                    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4">
                        <h4 className="font-semibold text-gray-800 mb-3">Método de pago</h4>
                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                            <div className="w-12 h-8 bg-blue-700 text-white rounded flex items-center justify-center text-[10px] font-bold">
                                <BsCreditCard className="text-lg" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800 tracking-wider">
                                    **** **** **** {evento.metodoPago.ultimosDigitos ?? '----'}
                                </p>
                                <p className="text-xs text-gray-500 uppercase">{evento.metodoPago.tipo ?? ''}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bloque derecho */}
            <aside className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 h-fit">
                <h4 className="font-semibold text-gray-800 mb-3">Detalles del pedido</h4>

                <div className="mb-3">
                    <p className="text-sm text-gray-500">Enviado al correo electrónico:</p>
                    <p className="font-semibold text-accentBase break-all">{perfil?.email ?? '—'}</p>
                </div>
                <hr className="my-3" />

                <div className="mb-3">
                    <p className="text-sm text-gray-500">Lugar del evento</p>
                    <p className="font-semibold text-gray-800">{lugar || '—'}</p>
                </div>
                <hr className="my-3" />

                <div className="mb-3">
                    <p className="text-sm text-gray-500 mb-1">Total</p>
                    <ul className="space-y-1">
                        {boletos.map((b) => {
                            const esPaseGeneral = !!b.eventoSeccion;
                            const cat = esPaseGeneral ? 'General' : b.categoria?.nombre || 'S/N';
                            const bloque = esPaseGeneral
                                ? b.eventoSeccion?.seccion?.bloque?.nombre
                                : b.asiento?.fila?.seccion?.bloque?.nombre;
                            const sec = esPaseGeneral
                                ? b.eventoSeccion?.seccion?.nombre
                                : b.asiento?.fila?.seccion?.nombre;
                            const asiento = esPaseGeneral
                                ? ''
                                : ` Asiento ${b.asiento?.fila?.nombre ?? ''}${b.asiento?.numero ?? ''}`;
                            const precio = b.eventoSeccion?.precioEspecial ?? b.precio ?? 0;
                            return (
                                <li key={b.id} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">
                                        {cat} B{bloque ?? '-'} S{sec ?? '-'}
                                        {asiento}
                                    </span>
                                    <span className="font-semibold text-gray-800">
                                        ${Number(precio).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <hr className="my-3" />

                <div className="mb-3">
                    <p className="text-sm text-gray-500">Número de pedido</p>
                    <p className="font-semibold text-gray-800">{numeroPedido ?? '—'}</p>
                </div>
                <hr className="my-3" />

                <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800">Total:</span>
                    <span className="font-bold text-accentBase text-lg">
                        ${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </aside>
        </div>
    );
};

export default DetallesPedidoTab;
