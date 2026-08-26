import { QRCodeCanvas } from 'qrcode.react';
import { IoMdClose } from 'react-icons/io';
import { LuSend, LuSmartphone, LuLock, LuCalendarClock } from 'react-icons/lu';
//import { WalletFooter } from './WalletFooterComponent';
import type { BoletoCardData, BoletoCardEvento } from './BoletoCard';
import { useDynamicQr } from '../../../../hooks/useDynamicQr';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    evento: BoletoCardEvento | null;
    boleto: (BoletoCardData & { quemadoUUID?: string }) | null;
    walletActive?: { google: boolean; apple: boolean };
    onTransferir?: () => void;
    onCancelarPendiente?: () => void;
    onGoogleWallet?: () => void;
    onAppleWallet?: () => void;
}

const BoletoDetalleModal = ({
    isOpen,
    onClose,
    evento,
    boleto,
    //walletActive,
    onTransferir,
    onCancelarPendiente,
    //onGoogleWallet,
    //onAppleWallet,
}: Props) => {
    if (!isOpen || !boleto) return null;

    const quemado = !!boleto.quemadoFlag;
    const qrBloqueado = !!boleto.qrBloqueado;
    const transferenciaPendiente = boleto.transferenciaPendiente ?? null;
    const tienePendiente = !!transferenciaPendiente;
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

    const tipo = esPaseGeneral ? 'pase' : 'asiento';
    // Un QR bloqueado nunca se pide ni se calcula en web: solo vive en la app móvil.
    const useDynamic = !quemado && !qrBloqueado && !boleto.qrEstatico && (boleto.dynamicQr || !boleto.quemadoUUID);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const dyn = useDynamicQr({
        tipo,
        boletoId: boleto.id,
        enabled: !!useDynamic,
    });

    const staticPayload = boleto.quemadoUUID
        ? JSON.stringify({
              quemadoUUID: boleto.quemadoUUID,
              general: esPaseGeneral,
              ...(boleto.funcion && { funcion: boleto.funcion.id }),
          })
        : null;

    const qrValue = useDynamic ? dyn.qrText : staticPayload;
    const showCountdown = useDynamic && dyn.status === 'ready' && dyn.qrText;

    const qrDisponibleDesde = boleto.qrDisponibleDesde ?? null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
                <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">Boleto #{boleto.id}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-700 text-2xl"
                        aria-label="Cerrar"
                    >
                        <IoMdClose />
                    </button>
                </header>

                <div className="overflow-y-auto">
                    <div className="px-4 py-3 bg-gradient-to-r from-[#1c4cadff] to-[#0d2d61ff] text-white">
                        <p className="text-sm font-semibold truncate">
                            {evento?.nombre} {boleto.funcion?.nombre ?? ''}
                        </p>
                    </div>

                    {tienePendiente && !quemado && (
                        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
                            <p className="font-semibold flex items-center gap-1.5">
                                <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
                                    <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 4a.75.75 0 0 0-1.5 0v4.5c0 .2.08.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V6Z" />
                                </svg>
                                Transferencia pendiente
                            </p>
                            <p className="text-xs mt-0.5">
                                Enviada a <b>{transferenciaPendiente?.toUser?.fullName ?? 'usuario'}</b>. El boleto seguirá siendo tuyo hasta que la acepte.
                            </p>
                        </div>
                    )}

                    <div className="py-5 flex flex-col items-center bg-gray-50">
                        {quemado ? (
                            <>
                                <div className="w-[200px] h-[200px] flex flex-col items-center justify-center rounded-xl border-4 border-red-600 bg-red-50 text-red-700 px-4">
                                    <svg viewBox="0 0 24 24" className="w-14 h-14 fill-current mb-2" aria-hidden="true">
                                        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.95 13.536a1 1 0 1 1-1.414 1.414L12 13.414l-3.536 3.536a1 1 0 1 1-1.414-1.414L10.586 12 7.05 8.464A1 1 0 1 1 8.464 7.05L12 10.586l3.536-3.536a1 1 0 1 1 1.414 1.414L13.414 12l3.536 3.536Z" />
                                    </svg>
                                    <p className="text-2xl font-extrabold tracking-widest uppercase -rotate-6 border-2 border-red-600 px-3 py-0.5 rounded">
                                        Quemado
                                    </p>
                                </div>
                                <p className="mt-3 text-sm font-medium text-red-700">Boleto utilizado</p>
                                <p className="text-xs text-gray-500 mt-0.5 text-center px-6">
                                    Este boleto ya fue escaneado y no puede volver a usarse.
                                </p>
                            </>
                        ) : qrBloqueado ? (
                            <div className="w-full px-6 flex flex-col items-center text-center">
                                <div className="relative w-[200px] h-[200px] flex flex-col items-center justify-center rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white">
                                    <span className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm ring-1 ring-indigo-100">
                                        <LuSmartphone className="w-8 h-8 text-indigo-600" aria-hidden="true" />
                                        <span className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white ring-2 ring-white">
                                            <LuLock className="w-3 h-3" aria-hidden="true" />
                                        </span>
                                    </span>
                                    <p className="mt-3 text-sm font-semibold text-gray-800">QR disponible en la app móvil</p>
                                </div>

                                {qrDisponibleDesde && (
                                    <div className="mt-4 w-full max-w-[280px] flex items-center gap-3 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-left">
                                        <LuCalendarClock className="w-5 h-5 text-indigo-600 shrink-0" aria-hidden="true" />
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-indigo-500">Disponible en tu app a partir del</p>
                                            <p className="text-sm font-semibold text-indigo-900">{qrDisponibleDesde}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className={`border-4 ${useDynamic ? 'border-emerald-500' : 'border-blue-500'} rounded-xl p-2 bg-white`}>
                                    {qrValue ? (
                                        <QRCodeCanvas value={qrValue} size={180} />
                                    ) : (
                                        <div className="w-[180px] h-[180px] flex items-center justify-center text-gray-400 text-sm text-center px-3">
                                            {useDynamic && dyn.status === 'loading' && 'Generando QR…'}
                                            {useDynamic && dyn.status === 'expired' && 'Renovando QR…'}
                                            {useDynamic && dyn.status === 'error' && (dyn.error ?? 'Error al cargar QR')}
                                            {!useDynamic && 'Sin QR disponible'}
                                        </div>
                                    )}
                                </div>
                                {showCountdown && (
                                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>QR dinámico · rota en {dyn.secondsLeft}s</span>
                                    </div>
                                )}
                                {!useDynamic && boleto.qrEstatico && (
                                    <p className="mt-3 text-xs text-gray-500">QR estático</p>
                                )}
                            </>
                        )}
                    </div>

                    <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-gray-500 text-xs">Categoría</p>
                            <p className="font-semibold text-gray-800">{categoria}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">Bloque</p>
                            <p className="font-semibold text-gray-800">{bloque ?? '-'}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">Sección</p>
                            <p className="font-semibold text-gray-800">{seccion ?? '-'}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">Asiento</p>
                            <p className="font-semibold text-gray-800">{asientoStr}</p>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-gray-100">
                            <p className="text-gray-500 text-xs">Precio</p>
                            <p className="font-bold text-gray-800 text-lg">{precioStr}</p>
                        </div>
                    </div>

                    {!quemado && tienePendiente && onCancelarPendiente && (
                        <div className="px-4 pb-2">
                            <button
                                type="button"
                                onClick={onCancelarPendiente}
                                className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg py-2 font-medium"
                            >
                                Cancelar transferencia
                            </button>
                        </div>
                    )}

                    {onTransferir && !quemado && !tienePendiente && (
                        <div className="px-4 pb-2">
                            <button
                                type="button"
                                onClick={onTransferir}
                                className="w-full flex items-center justify-center gap-2 border border-accentBase text-accentBase hover:bg-blue-50 rounded-lg py-2 font-medium"
                            >
                                <LuSend /> Transferir a un amigo
                            </button>
                        </div>
                    )}

                   {/*  <WalletFooter
                        onGoogleClick={onGoogleWallet}
                        onAppleClick={onAppleWallet}
                        googleDisabled={!walletActive.google}
                        appleDisabled={!walletActive.apple}
                    /> */}
                </div>
            </div>
        </div>
    );
};

export default BoletoDetalleModal;
