import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { IoMdCheckmark, IoMdClose } from 'react-icons/io';
import { LuTicket } from 'react-icons/lu';
import { FaRegStar } from 'react-icons/fa';
import Sidebar from './components/Sidebar';
import UserAvatar from '../../../components/UserAvatar';
import Loader from '@/publicUi/components/Loader';
import { useTransferenciasStore } from '../../../hooks/useTransferenciasStore';
import { useCityPassStore } from '../../../hooks/useCityPassStore';
import { formatDate } from '../../../utils/dateHelpers';
import { emitNotifRefresh } from '../../../utils/notifEvents';
import type { AccionTransferencia, TicketTransfer } from '../../../types/Transferencias';
import type { CityPassTransferencia } from '../../../types/CityPass';

const POLL_MS = 30_000;

type Tab = 'recibidas' | 'enviadas';
type Origen = 'evento' | 'citypass';

// Fila unificada para pintar transferencias de eventos y de CityPass en la misma lista.
interface FilaTransfer {
    key: string; // único entre ambas fuentes (origen + id)
    origen: Origen;
    id: number;
    createdAt: string;
    nombre: string; // nombre de la contraparte
    image?: string | null;
    descripcion: string;
    fechaEvento?: string | null;
}

const describeEvento = (t: TicketTransfer) => {
    const evento = t.evento?.nombre ?? 'Evento';
    const funcion = t.funcion?.nombre ? ` · ${t.funcion.nombre}` : '';
    const tipoLabel = t.tipo === 'pase' ? 'Pase general' : 'Asiento';
    const refId = t.eventoAsiento?.id ?? t.paseGeneral?.id;
    return `${evento}${funcion} · ${tipoLabel}${refId ? ` #${refId}` : ''}`;
};

const describeCityPass = (t: CityPassTransferencia) => {
    const paquete = t.boleto?.paquete?.nombre ?? 'CityPass';
    const refId = t.boleto?.id;
    return `${paquete}${refId ? ` · Pase #${refId}` : ''}`;
};

const MisTransferenciasPage = () => {
    const {
        getPendientesRecibidas,
        getPendientesEnviadas,
        responderTransferencia,
    } = useTransferenciasStore();
    const {
        getPendientesRecibidas: getCpRecibidas,
        getPendientesEnviadas: getCpEnviadas,
        responderTransferencia: responderCpTransferencia,
    } = useCityPassStore();

    const [tab, setTab] = useState<Tab>('recibidas');
    const [recibidas, setRecibidas] = useState<FilaTransfer[]>([]);
    const [enviadas, setEnviadas] = useState<FilaTransfer[]>([]);
    const [cargando, setCargando] = useState(false);
    const [accionKey, setAccionKey] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        // Eventos y CityPass viven en tablas/endpoints distintos: se piden por separado
        // y se combinan. Si una fuente falla, la otra igual se muestra.
        const [evRec, evEnv, cpRec, cpEnv] = await Promise.all([
            getPendientesRecibidas().catch(() => [] as TicketTransfer[]),
            getPendientesEnviadas().catch(() => [] as TicketTransfer[]),
            getCpRecibidas().catch(() => [] as CityPassTransferencia[]),
            getCpEnviadas().catch(() => [] as CityPassTransferencia[]),
        ]);

        const mapEv = (t: TicketTransfer, contraparte: 'from' | 'to'): FilaTransfer => {
            const u = contraparte === 'from' ? t.fromUser : t.toUser;
            return {
                key: `ev-${t.id}`,
                origen: 'evento',
                id: t.id,
                createdAt: t.createdAt,
                nombre: u?.fullName ?? 'Usuario',
                image: u?.image,
                descripcion: describeEvento(t),
                fechaEvento: t.funcion?.fecha ?? null,
            };
        };
        const mapCp = (t: CityPassTransferencia, contraparte: 'from' | 'to'): FilaTransfer => {
            const u = contraparte === 'from' ? t.fromUser : t.toUser;
            return {
                key: `cp-${t.id}`,
                origen: 'citypass',
                id: t.id,
                createdAt: t.createdAt,
                nombre: u?.fullName ?? 'Usuario',
                image: u?.image,
                descripcion: describeCityPass(t),
                fechaEvento: null,
            };
        };

        const ordenar = (a: FilaTransfer, b: FilaTransfer) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

        setRecibidas(
            [...evRec.map((t) => mapEv(t, 'from')), ...cpRec.map((t) => mapCp(t, 'from'))].sort(ordenar),
        );
        setEnviadas(
            [...evEnv.map((t) => mapEv(t, 'to')), ...cpEnv.map((t) => mapCp(t, 'to'))].sort(ordenar),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cargarTodo = useCallback(async () => {
        try {
            setCargando(true);
            await cargar();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error al cargar transferencias';
            Swal.fire('Error', mensaje, 'error');
        } finally {
            setCargando(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        cargarTodo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const id = window.setInterval(() => {
            cargar().catch(() => {
                // silencioso
            });
        }, POLL_MS);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ejecutar = async (fila: FilaTransfer, accion: AccionTransferencia) => {
        const titulos: Record<AccionTransferencia, string> = {
            aceptar: '¿Aceptar transferencia?',
            rechazar: '¿Rechazar transferencia?',
            cancelar: '¿Cancelar transferencia?',
        };
        const textos: Record<AccionTransferencia, string> = {
            aceptar: 'El boleto pasará a ser tuyo.',
            rechazar: 'El boleto se quedará con el remitente.',
            cancelar: 'La transferencia se cancelará y el boleto seguirá siendo tuyo.',
        };
        const exitoTitulo: Record<AccionTransferencia, string> = {
            aceptar: 'Boleto recibido',
            rechazar: 'Transferencia rechazada',
            cancelar: 'Transferencia cancelada',
        };

        const confirm = await Swal.fire({
            title: titulos[accion],
            text: textos[accion],
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'No',
            confirmButtonColor: accion === 'aceptar' ? '#023E8A' : '#dc2626',
        });
        if (!confirm.isConfirmed) return;

        try {
            setAccionKey(fila.key);
            if (fila.origen === 'citypass') {
                await responderCpTransferencia(fila.id, accion);
            } else {
                await responderTransferencia(fila.id, accion);
            }
            Swal.fire({
                icon: 'success',
                title: exitoTitulo[accion],
                timer: 1800,
                showConfirmButton: false,
            });
            await cargar();
            emitNotifRefresh();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error al responder la transferencia';
            Swal.fire('Error', mensaje, 'error');
        } finally {
            setAccionKey(null);
        }
    };

    const lista = useMemo(() => (tab === 'recibidas' ? recibidas : enviadas), [tab, recibidas, enviadas]);

    return (
        <div
            style={{
                backgroundImage: `url('/bg_perfil.svg')`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'top',
                backgroundSize: '100%',
                paddingTop: '40px',
            }}
        >
            {cargando && <Loader />}
            <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
                <div className="grid grid-cols-7 gap-4 items-start mb-5">
                    <Sidebar />
                    <section className="bg-gray-50 shadow-md rounded-xl col-span-7 md:col-span-4 lg:col-span-5 p-4">
                        <h2 className="text-gray-800 text-2xl 2xl:text-3xl font-semibold">Transferencias</h2>
                        <hr className="my-3" />
                        <p className="text-gray-600 mb-4">
                            Aquí puedes aceptar o rechazar las transferencias que te enviaron, y cancelar las que enviaste si aún no las aceptan.
                        </p>

                        <nav className="flex items-center gap-6 border-b border-gray-200 mb-4 overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setTab('recibidas')}
                                className={`pb-3 -mb-px text-sm md:text-base whitespace-nowrap flex items-center gap-2 ${tab === 'recibidas' ? 'text-accentBase border-b-2 border-accentBase font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Recibidas
                                {recibidas.length > 0 && (
                                    <span className="bg-accentBase text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[24px] text-center">
                                        {recibidas.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setTab('enviadas')}
                                className={`pb-3 -mb-px text-sm md:text-base whitespace-nowrap flex items-center gap-2 ${tab === 'enviadas' ? 'text-accentBase border-b-2 border-accentBase font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Enviadas
                                {enviadas.length > 0 && (
                                    <span className="bg-gray-300 text-gray-700 text-xs font-semibold rounded-full px-2 py-0.5 min-w-[24px] text-center">
                                        {enviadas.length}
                                    </span>
                                )}
                            </button>
                        </nav>

                        {lista.length === 0 ? (
                            <p className="text-center text-gray-500 py-10">
                                {tab === 'recibidas'
                                    ? 'No tienes transferencias por aceptar.'
                                    : 'No tienes transferencias enviadas pendientes.'}
                            </p>
                        ) : (
                            <ul className="space-y-3">
                                {lista.map((t) => {
                                    const ocupado = accionKey === t.key;
                                    return (
                                        <li
                                            key={t.key}
                                            className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-3"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <UserAvatar nombre={t.nombre || '?'} image={t.image ?? undefined} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-gray-800 truncate">
                                                        {t.nombre}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {tab === 'recibidas' ? 'Te envió un boleto' : 'Le enviaste un boleto'}
                                                    </p>
                                                </div>
                                                {t.origen === 'citypass' && (
                                                    <span className="bg-accentBase/10 text-accentBase text-[10px] font-semibold rounded-full px-2 py-0.5 flex items-center gap-1">
                                                        <FaRegStar /> City Pass
                                                    </span>
                                                )}
                                                <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full px-2 py-0.5">
                                                    Pendiente
                                                </span>
                                            </div>

                                            <div className="flex items-start gap-2 text-sm text-gray-700">
                                                <LuTicket className="text-accentBase text-lg mt-0.5 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="truncate">{t.descripcion}</p>
                                                    {t.fechaEvento && (
                                                        <p className="text-xs text-gray-500">
                                                            {formatDate(t.fechaEvento, "dd MMM yyyy, hh:mm a")}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
                                                <p className="text-[11px] text-gray-400">
                                                    Enviada el {formatDate(t.createdAt, "dd MMM yyyy, hh:mm a")}
                                                </p>
                                                {tab === 'recibidas' ? (
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => ejecutar(t, 'rechazar')}
                                                            disabled={ocupado}
                                                            className="border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                                                        >
                                                            <IoMdClose /> Rechazar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => ejecutar(t, 'aceptar')}
                                                            disabled={ocupado}
                                                            className="bg-accentBase hover:bg-emphasis text-white rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                                                        >
                                                            <IoMdCheckmark /> Aceptar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => ejecutar(t, 'cancelar')}
                                                        disabled={ocupado}
                                                        className="border border-red-300 text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
                                                    >
                                                        Cancelar
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default MisTransferenciasPage;
