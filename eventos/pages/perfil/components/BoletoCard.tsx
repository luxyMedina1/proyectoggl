import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LuSmartphone } from 'react-icons/lu';
import { formatDate } from '../../../../utils/dateHelpers';
const defaultEventImage = '/event_default.webp';
const logoEmpresa = '/logo.png';
import type { QrSeed } from '../../../../utils/dynamicQr';
import type { TransferenciaPendienteInfo } from '../../../../types/Transferencias';

export interface BoletoCardEvento {
    nombre?: string;
    imagenPromocion?: string;
    fecha?: string;
}

export interface BoletoCardData {
    id: number;
    funcion?: { id: number; fecha?: string; nombre?: string } | null;
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
    precio?: string | number;
    quemadoFlag?: boolean;
    transferidoEn?: string;
    transferidoA?: { id: string; fullName: string; image?: string | null };
    dynamicQr?: QrSeed | null;
    qrEstatico?: boolean;
    /** El backend bloquea el QR en web: solo se mostrará en la app móvil. */
    qrBloqueado?: boolean;
    /** Fecha (ISO) a partir de la cual el QR estará disponible en la app móvil. */
    qrDisponibleDesde?: string | null;
    transferenciaPendiente?: TransferenciaPendienteInfo | null;
}

interface Props {
    evento: BoletoCardEvento | null;
    boleto: BoletoCardData;
    variant: 'vigente' | 'transferido';
    onTransferir?: () => void;
    onDevolver?: () => void;
    onCancelarPendiente?: () => void;
    onClick?: () => void;
    selectable?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}

const fechaCabecera = (evento: BoletoCardEvento | null, funcion?: BoletoCardData['funcion']) => {
    const fuente = funcion?.fecha ?? evento?.fecha;
    if (!fuente) return { dia: '—', completa: '—' };
    try {
        const d = new Date(fuente);
        const dia = `${format(d, 'EEEE', { locale: es })} ${format(d, 'hh:mm a').toUpperCase()}`;
        const completa = format(d, "MMM dd, yyyy", { locale: es });
        return { dia, completa };
    } catch {
        return { dia: '—', completa: '—' };
    }
};

const BoletoCard = ({
    evento,
    boleto,
    variant,
    onTransferir,
    onDevolver,
    onCancelarPendiente,
    onClick,
    selectable = false,
    selected = false,
    onToggleSelect,
}: Props) => {
    const esPaseGeneral = !!boleto.eventoSeccion;
    const categoria = esPaseGeneral ? 'General' : boleto.categoria?.nombre || 'S/N';
    const bloque = esPaseGeneral
        ? boleto.eventoSeccion?.seccion?.bloque?.nombre
        : boleto.asiento?.fila?.seccion?.bloque?.nombre;
    const seccion = esPaseGeneral
        ? boleto.eventoSeccion?.seccion?.nombre
        : boleto.asiento?.fila?.seccion?.nombre;
    const asientoStr = esPaseGeneral
        ? '-'
        : `${boleto.asiento?.fila?.nombre ?? ''}${boleto.asiento?.numero ?? ''}` || '-';
    const precio = esPaseGeneral
        ? boleto.eventoSeccion?.precioEspecial ?? boleto.precio
        : boleto.precio;
    const precioStr = precio != null ? `$${Number(precio).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

    const { dia, completa } = fechaCabecera(evento, boleto.funcion);
    const transferido = variant === 'transferido';
    const quemado = !!boleto.quemadoFlag;
    const transferenciaPendiente = boleto.transferenciaPendiente ?? null;
    const tienePendiente = !!transferenciaPendiente;
    const qrBloqueado = !!boleto.qrBloqueado;
    const qrDisponibleDesde = boleto.qrDisponibleDesde ?? null;

    const cabeceraGradient = 'bg-gradient-to-r from-[#1c4cadff] to-[#0d2d61ff]';

    return (
        <article
            className={`relative rounded-2xl overflow-hidden shadow-sm border bg-white flex flex-col h-full ${quemado ? 'border-red-200 opacity-90' : tienePendiente ? 'border-amber-200' : 'border-gray-200'} ${selectable && !quemado && !tienePendiente ? 'cursor-pointer' : ''} ${selected ? 'ring-2 ring-accentBase' : ''}`}
            onClick={() => {
                if (selectable && onToggleSelect) onToggleSelect();
                else if (onClick) onClick();
            }}
        >
            {/* Cabecera tipo strip */}
            <header className={`${cabeceraGradient} px-3 py-2 flex items-center justify-between text-white`}>
                <img src={logoEmpresa} alt={process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVIP"} className="h-5 w-auto" />
                <div className="text-right leading-tight">
                    <p className="text-[10px] uppercase tracking-wide opacity-80">{dia}</p>
                    <p className="text-xs font-semibold capitalize">{completa}</p>
                </div>
            </header>

            {/* Imagen + overlay con info */}
            <div className="relative">
                <img
                    className={`w-full aspect-[4/3] object-cover ${quemado ? 'grayscale opacity-60' : ''}`}
                    src={evento?.imagenPromocion || defaultEventImage}
                    alt={evento?.nombre ?? 'evento'}
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = defaultEventImage;
                    }}
                />
                {quemado && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span className="border-4 border-red-600 text-red-600 bg-white/85 px-6 py-2 rounded-md text-2xl font-extrabold tracking-widest uppercase -rotate-12 shadow-md">
                            Quemado
                        </span>
                    </div>
                )}
                {tienePendiente && !quemado && (
                    <div className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shadow flex items-center gap-1">
                        <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current" aria-hidden="true">
                            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 4a.75.75 0 0 0-1.5 0v4.5c0 .2.08.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V6Z" />
                        </svg>
                        Pendiente
                    </div>
                )}
                {selectable && (
                    <div className="absolute top-2 left-2">
                        <span
                            className={`inline-flex w-6 h-6 rounded-md border-2 ${selected ? 'bg-accentBase border-accentBase text-white' : 'bg-white border-gray-300'} items-center justify-center`}
                        >
                            {selected && (
                                <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                                    <path d="M7.629 13.671 4.146 10.19l1.414-1.415 2.07 2.07 6.71-6.71 1.414 1.414z" />
                                </svg>
                            )}
                        </span>
                    </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pt-10 pb-3 text-white">
                    <h5 className="text-sm font-bold uppercase leading-tight line-clamp-2">
                        {evento?.nombre}
                    </h5>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px]">
                        <div>
                            <p className="opacity-70">Categoría:</p>
                            <p className="font-semibold text-xs truncate">{categoria}</p>
                        </div>
                        <div>
                            <p className="opacity-70">Bloque:</p>
                            <p className="font-semibold text-xs">{bloque ?? '-'}</p>
                        </div>
                        <div>
                            <p className="opacity-70">Sección:</p>
                            <p className="font-semibold text-xs">{seccion ?? '-'}</p>
                        </div>
                        <div>
                            <p className="opacity-70">Asiento:</p>
                            <p className="font-semibold text-xs">{asientoStr}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="px-3 py-3 flex items-center justify-between gap-2 bg-white">
                {quemado ? (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-1.5 text-sm font-semibold min-w-0 flex-1">
                        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current shrink-0" aria-hidden="true">
                            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm3.707 10.293a1 1 0 1 1-1.414 1.414L10 11.414l-2.293 2.293a1 1 0 1 1-1.414-1.414L8.586 10 6.293 7.707a1 1 0 0 1 1.414-1.414L10 8.586l2.293-2.293a1 1 0 1 1 1.414 1.414L11.414 10l2.293 2.293Z" />
                        </svg>
                        <span className="truncate">Boleto utilizado</span>
                    </div>
                ) : tienePendiente ? (
                    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-1.5 min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-amber-600 leading-tight">Transferencia pendiente a:</p>
                            <p className="text-sm font-semibold truncate">
                                {transferenciaPendiente?.toUser?.fullName ?? 'Usuario'}
                            </p>
                        </div>
                        {onCancelarPendiente && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCancelarPendiente();
                                }}
                                className="border border-red-300 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg px-3 py-1.5 transition"
                            >
                                Cancelar transferencia
                            </button>
                        )}
                    </div>
                ) : transferido ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 min-w-0 flex-1">
                        <p className="text-[10px] text-gray-500 leading-tight">Transferido a:</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">
                            {boleto.transferidoA?.fullName ?? 'Usuario'}
                        </p>
                        {boleto.transferidoEn && (
                            <p className="text-[10px] text-gray-400">
                                {formatDate(boleto.transferidoEn, 'dd MMM yyyy, hh:mm a')}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        {qrBloqueado && (
                            <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-1.5">
                                <LuSmartphone className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                                <div className="min-w-0 leading-tight">
                                    <p className="text-xs font-semibold">QR disponible en la app móvil</p>
                                    {qrDisponibleDesde && (
                                        <p className="text-[10px] text-indigo-500 mt-0.5">Desde {qrDisponibleDesde}</p>
                                    )}
                                </div>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTransferir?.();
                            }}
                            className="border border-accentBase text-accentBase hover:bg-blue-50 text-sm font-medium rounded-lg px-4 py-2 transition"
                        >
                            Transferir boleto
                        </button>
                        {onDevolver && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDevolver();
                                }}
                                className="border border-amber-400 text-amber-700 hover:bg-amber-50 text-sm font-medium rounded-lg px-4 py-2 transition"
                            >
                                Devolver boleto
                            </button>
                        )}
                    </div>
                )}
                <span className="text-lg font-bold text-gray-800 whitespace-nowrap">{precioStr}</span>
            </footer>
        </article>
    );
};

export default BoletoCard;
