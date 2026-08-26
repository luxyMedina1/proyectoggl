import { useEffect, useMemo, useState } from 'react';
import { TbTicket } from 'react-icons/tb';
import { FaRegStar, FaRegCreditCard } from 'react-icons/fa';
import { GoChevronRight } from 'react-icons/go';
import { MdViewList, MdGridView, MdLocationOn, MdCalendarMonth, MdSync, MdSwapHoriz, MdCheck, MdClose, MdUndo } from 'react-icons/md';
import { IoIosArrowRoundBack } from 'react-icons/io';
import { HiOutlineTicket } from 'react-icons/hi2';
import Swal from 'sweetalert2';
const defaultEventImage = '/event_default.webp';
import Loader from '@/publicUi/components/Loader';
import { useColorConfig } from '../../../../context/ColorContext';
import { useAuthStore } from '../../../../hooks/useAuthStore';
import { useCityPassStore } from '../../../../hooks/useCityPassStore';
import { formatearDinero } from '../../../helpers/formatearDinero';
import { formatDate } from '../../../../utils/dateHelpers';
import TransferirCityPassModal from '@/publicUi/components/citypass/TransferirCityPassModal';
import type {
    CityPassBoletoDetalle,
    CityPassBoletoTransferido,
    CityPassCompraDetalle,
    CityPassCompraResumen,
    CityPassPaqueteDetalle,
    CityPassTransferencia,
    CityPassTransferenciaBoleto,
} from '../../../../types/CityPass';

interface Props {
    producto: 'eventos' | 'citypass';
    onProducto: (p: 'eventos' | 'citypass') => void;
}

type Vista = 'lista' | 'detalle' | 'atracciones' | 'transferencias';

const ProductoTabs = ({ producto, onProducto }: Props) => (
    <div className="mb-5 inline-flex rounded-xl border border-gray-200 bg-white p-1">
        <button
            type="button"
            onClick={() => onProducto('eventos')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${producto === 'eventos' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
        >
            <TbTicket className="text-lg" /> Eventos
        </button>
        <button
            type="button"
            onClick={() => onProducto('citypass')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${producto === 'citypass' ? 'bg-accentBase/10 text-accentBase' : 'text-gray-400 hover:text-gray-600'}`}
        >
            <FaRegStar className="text-lg" /> City Pass
        </button>
    </div>
);

const usadosDe = (b: CityPassBoletoDetalle) => b.accesos.filter((a) => a.quemado).length;
const boletoDisponible = (b: CityPassBoletoDetalle) => b.accesos.some((a) => !a.quemado);

const vigenciaTexto = (b: CityPassBoletoDetalle): string => {
    if (!b.vigenciaIniciada || b.diasRestantes === null) return 'Vigencia no iniciada';
    if (b.diasRestantes <= 0) return 'Caducado';
    return `Quedan ${b.diasRestantes} ${b.diasRestantes === 1 ? 'día' : 'días'}`;
};

const MisCityPass = ({ producto, onProducto }: Props) => {
    const { config } = useColorConfig();
    const { user } = useAuthStore();
    const {
        getMisCompras,
        getDetalleCompra,
        getPaquete,
        getPendientesRecibidas,
        getPendientesEnviadas,
        responderTransferencia,
        devolverBoleto,
    } = useCityPassStore();

    const [vista, setVista] = useState<Vista>('lista');
    const [cargando, setCargando] = useState(false);

    // Bandeja de transferencias pendientes (globales, no atadas a una compra)
    const [recibidasPend, setRecibidasPend] = useState<CityPassTransferencia[]>([]);
    const [enviadasPend, setEnviadasPend] = useState<CityPassTransferencia[]>([]);

    // Lista (mis-compras: una card por compra)
    const [compras, setCompras] = useState<CityPassCompraResumen[]>([]);
    const [subTab, setSubTab] = useState<'activos' | 'pasados'>('activos');
    const [vistaLista, setVistaLista] = useState<'lista' | 'galeria'>('lista');

    // Detalle (pases de esa compra)
    const [compra, setCompra] = useState<CityPassCompraDetalle | null>(null);
    const [paquete, setPaquete] = useState<CityPassPaqueteDetalle | null>(null);
    const [detalleTab, setDetalleTab] = useState<'pases' | 'transferidos' | 'detalles'>('pases');
    const [filtroEstado, setFiltroEstado] = useState<'disponibles' | 'quemados'>('disponibles');
    const [filtroTipo, setFiltroTipo] = useState<string>('todos');

    // Atracciones
    const [boletoSel, setBoletoSel] = useState<CityPassBoletoDetalle | null>(null);

    // Transferencia
    const [transferBoletoId, setTransferBoletoId] = useState<number | null>(null);

    useEffect(() => {
        const cargar = async () => {
            try {
                setCargando(true);
                const [comprasData, rec, env] = await Promise.all([
                    getMisCompras(),
                    getPendientesRecibidas().catch(() => []),
                    getPendientesEnviadas().catch(() => []),
                ]);
                setCompras(comprasData);
                setRecibidasPend(rec);
                setEnviadasPend(env);
            } catch (error) {
                console.error(error);
            } finally {
                setCargando(false);
            }
        };
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const recargarInbox = async () => {
        const [rec, env] = await Promise.all([
            getPendientesRecibidas().catch(() => []),
            getPendientesEnviadas().catch(() => []),
        ]);
        setRecibidasPend(rec);
        setEnviadasPend(env);
    };

    const abrirDetalle = async (compraId: number, paqueteId: number) => {
        try {
            setCargando(true);
            setDetalleTab('pases');
            setFiltroEstado('disponibles');
            setFiltroTipo('todos');
            const [det, paq] = await Promise.all([
                getDetalleCompra(compraId),
                getPaquete(paqueteId).catch(() => null),
            ]);
            setCompra(det);
            setPaquete(paq);
            setVista('detalle');
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error al cargar el detalle';
            Swal.fire('Error', mensaje, 'error');
        } finally {
            setCargando(false);
        }
    };

    const recargarDetalle = async () => {
        if (!compra) return;
        setCompra(await getDetalleCompra(compra.id));
    };

    // Refresca todo lo que una acción de transferencia puede afectar.
    const refrescarTrasAccion = async () => {
        setCompras(await getMisCompras());
        await recargarInbox();
        if (compra) await recargarDetalle();
    };

    // Aceptar / rechazar / cancelar una transferencia pendiente.
    const responder = async (id: number, accion: 'aceptar' | 'rechazar' | 'cancelar') => {
        const copy = {
            aceptar: { title: '¿Aceptar transferencia?', text: 'El pase pasará a ser tuyo.', btn: 'Aceptar', ok: 'Transferencia aceptada' },
            rechazar: { title: '¿Rechazar transferencia?', text: 'El pase seguirá con quien lo envió.', btn: 'Rechazar', ok: 'Transferencia rechazada' },
            cancelar: { title: '¿Cancelar transferencia?', text: 'Se cancelará el envío del pase.', btn: 'Sí, cancelar', ok: 'Transferencia cancelada' },
        }[accion];
        const res = await Swal.fire({
            title: copy.title,
            text: copy.text,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: copy.btn,
            cancelButtonText: 'Volver',
            confirmButtonColor: accion === 'aceptar' ? '#16a34a' : '#dc2626',
        });
        if (!res.isConfirmed) return;
        try {
            setCargando(true);
            await responderTransferencia(id, accion);
            await refrescarTrasAccion();
            Swal.fire('Listo', copy.ok, 'success');
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'No se pudo actualizar la transferencia';
            Swal.fire('Error', mensaje, 'error');
        } finally {
            setCargando(false);
        }
    };

    // Devolver un boleto al comprador original (solo dueño actual que no es el comprador).
    const devolver = async (boletoId: number) => {
        const res = await Swal.fire({
            title: '¿Devolver el pase?',
            text: 'Regresará al comprador original de inmediato.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Devolver',
            cancelButtonText: 'Volver',
            confirmButtonColor: '#dc2626',
        });
        if (!res.isConfirmed) return;
        try {
            setCargando(true);
            await devolverBoleto(boletoId);
            await refrescarTrasAccion();
            Swal.fire('Listo', 'El pase fue devuelto al comprador original', 'success');
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'No se pudo devolver el boleto';
            Swal.fire('Error', mensaje, 'error');
        } finally {
            setCargando(false);
        }
    };

    // ---- Lista: una card por compra ----
    const activos = useMemo(() => compras.filter((c) => c.vigente), [compras]);
    const pasados = useMemo(() => compras.filter((c) => !c.vigente), [compras]);
    const itemsVista = subTab === 'activos' ? activos : pasados;
    const listos = itemsVista.filter((c) => c.accesosUsados === 0);
    const enProgreso = itemsVista.filter((c) => c.accesosUsados > 0);

    const renderCard = (compra: CityPassCompraResumen) => {
        const grid = vistaLista === 'galeria';
        return (
            <div key={compra.id} className={`rounded-2xl border border-accentBase/40 bg-white p-3 shadow-sm ${grid ? '' : 'mb-4'}`}>
                <div className={`flex gap-4 ${grid ? 'flex-col' : 'flex-col sm:flex-row'}`}>
                    <img
                        src={compra.paquete.imagenPrincipal || defaultEventImage}
                        alt={compra.paquete.nombre}
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultEventImage; }}
                        className={`rounded-xl object-cover ${grid ? 'h-40 w-full' : 'h-28 w-full sm:h-28 sm:w-32'}`}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="text-lg font-bold text-gray-900">
                                CityPass {compra.paquete.ciudad?.nombre} · {compra.paquete.nombre}
                            </h3>
                            <button
                                type="button"
                                onClick={() => abrirDetalle(compra.id, compra.paquete.id)}
                                className="flex items-center gap-1 text-sm font-medium text-accentBase hover:underline"
                            >
                                Ver CityPass <GoChevronRight />
                            </button>
                        </div>
                        <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                            <MdCalendarMonth className="text-lg" />
                            Vigencia: {compra.validezDias} {compra.validezDias === 1 ? 'Día' : 'Días'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="flex items-center gap-2 text-sm text-gray-600">
                                <TbTicket className="text-lg" />
                                {compra.boletosCount} {compra.boletosCount === 1 ? 'pase' : 'pases'}
                                <button onClick={() => abrirDetalle(compra.id, compra.paquete.id)} className="text-accentBase hover:underline">
                                    detalle del pase
                                </button>
                            </p>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                                {compra.atraccionesCount} atracciones
                            </span>
                        </div>
                        <p className="mt-2 text-right text-gray-500">
                            Total: <span className="text-xl font-bold text-gray-900">{formatearDinero(compra.total)}</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    const renderLista = () => (
        <>
            <h2 className="text-2xl font-semibold text-gray-800 2xl:text-3xl">Mis compras</h2>
            <hr className="my-3" />
            <p className="mb-6 text-gray-600">Aquí puedes consultar los boletos que has comprado.</p>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <ProductoTabs producto={producto} onProducto={onProducto} />
                <button
                    type="button"
                    onClick={() => setVista('transferencias')}
                    className="relative flex items-center gap-2 rounded-xl border border-accentBase/40 bg-white px-4 py-2 text-sm font-semibold text-accentBase transition-colors hover:bg-accentBase/10"
                >
                    <MdSwapHoriz className="text-lg" /> Transferencias
                    {recibidasPend.length > 0 && (
                        <span className="ml-1 rounded-full bg-[#f04343] px-2 text-xs font-bold text-white">{recibidasPend.length}</span>
                    )}
                </button>
            </div>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => setSubTab('activos')}
                        className={`px-1 pb-1 font-semibold ${subTab === 'activos' ? 'border-b-2 border-gray-700 text-gray-800' : 'text-gray-400'}`}
                    >
                        CityPass activos <span className="ml-1 rounded-full bg-[#f04343] px-2 text-sm text-white">{activos.length}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubTab('pasados')}
                        className={`px-1 pb-1 ${subTab === 'pasados' ? 'border-b-2 border-gray-700 font-semibold text-gray-800' : 'text-gray-400'}`}
                    >
                        Ver CityPass pasados
                    </button>
                </div>
                <div className="flex overflow-hidden rounded-lg border border-gray-200">
                    <button
                        type="button"
                        onClick={() => setVistaLista('lista')}
                        className={`flex items-center gap-1 px-3 py-2 text-sm ${vistaLista === 'lista' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}
                    >
                        <MdViewList className="text-lg" /> Ver en lista
                    </button>
                    <button
                        type="button"
                        onClick={() => setVistaLista('galeria')}
                        className={`flex items-center gap-1 px-3 py-2 text-sm ${vistaLista === 'galeria' ? 'bg-gray-100 text-gray-800' : 'text-gray-400'}`}
                    >
                        <MdGridView className="text-lg" /> Ver en galería
                    </button>
                </div>
            </div>

            {itemsVista.length === 0 ? (
                <p className="py-10 text-center text-gray-500">No tienes CityPass {subTab === 'activos' ? 'activos' : 'pasados'}.</p>
            ) : subTab === 'pasados' ? (
                <div className={vistaLista === 'galeria' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : ''}>
                    {itemsVista.map(renderCard)}
                </div>
            ) : (
                <>
                    {listos.length > 0 && (
                        <>
                            <h3 className="mb-2 text-lg font-semibold text-gray-800">Listo para usarse</h3>
                            <div className={vistaLista === 'galeria' ? 'mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : ''}>
                                {listos.map(renderCard)}
                            </div>
                        </>
                    )}
                    {enProgreso.length > 0 && (
                        <>
                            <h3 className="mb-2 mt-2 text-lg font-semibold text-gray-800">Más CityPass</h3>
                            <div className={vistaLista === 'galeria' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : ''}>
                                {enProgreso.map(renderCard)}
                            </div>
                        </>
                    )}
                </>
            )}
        </>
    );

    // ---- Detalle (pases de la compra) ----
    const precioTipo = (tipoBoletoId?: number) =>
        paquete?.precios.find((p) => p.tipoBoletoId === tipoBoletoId)?.precio ?? 0;

    // Pases que sigo poseyendo (o con transferencia en proceso): tab "Mis Pases".
    const boletosPropios = useMemo(() => compra?.boletos ?? [], [compra]);
    // Pases que ya transferí a alguien más (los manda el back en su propia propiedad): tab "Pases transferidos".
    const boletosTransferidos = useMemo(() => compra?.transferidos ?? [], [compra]);

    const tiposDisponibles = useMemo(() => {
        const set = new Map<string, number>();
        boletosPropios.forEach((b) => {
            const n = b.tipoBoleto?.nombre ?? 'Boleto';
            set.set(n, (set.get(n) ?? 0) + 1);
        });
        return Array.from(set.entries());
    }, [boletosPropios]);

    const boletosFiltrados = useMemo(
        () =>
            boletosPropios.filter((b) => {
                const estadoOk = filtroEstado === 'quemados' ? !boletoDisponible(b) : boletoDisponible(b);
                const tipoOk = filtroTipo === 'todos' || (b.tipoBoleto?.nombre ?? 'Boleto') === filtroTipo;
                return estadoOk && tipoOk;
            }),
        [boletosPropios, filtroEstado, filtroTipo],
    );

    const indiceEnTipo = (b: CityPassBoletoDetalle) => {
        const mismos = (compra?.boletos ?? []).filter((x) => (x.tipoBoleto?.nombre ?? '') === (b.tipoBoleto?.nombre ?? ''));
        return mismos.findIndex((x) => x.id === b.id) + 1;
    };

    const disponiblesCount = boletosPropios.filter(boletoDisponible).length;
    const quemadosCount = boletosPropios.filter((b) => !boletoDisponible(b)).length;

    const renderDetalle = () => {
        if (!compra) return null;
        const ciudad = compra.paquete.ciudad?.nombre ?? '';

        // Card de un pase (misma en "Mis Pases" y en "Pases transferidos").
        const renderBoletoCard = (b: CityPassBoletoDetalle) => {
            const total = b.accesos.length;
            const usados = usadosDe(b);
            const t = b.transferencia ?? null;
            const enProceso = t?.estado === 'en_proceso';
            // Durante "en_proceso" el remitente sigue siendo el dueño actual: puede cancelar.
            const soyRemitente = enProceso && !!t?.transferId && b.esPropietarioActual !== false;
            const puedeTransferir = !t && (b.puedeTransferir ?? boletoDisponible(b));
            const puedeDevolver = !t && (b.puedeDevolver ?? false);
            return (
                <div key={b.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between bg-gradient-to-r from-accentBase to-emphasis px-3 py-2 text-neutral">
                        {config?.logoMarca ? (
                            <img src={config.logoMarca} alt="logo" className="h-5 w-auto object-contain" />
                        ) : <span className="text-sm font-bold">CityPass</span>}
                        <span className="text-right text-[11px] leading-tight">
                            Vigencia: {compra.validezDias} Días<br />
                            <b>{vigenciaTexto(b)}</b>
                        </span>
                    </div>
                    <div className="relative h-40 bg-emphasis">
                        <img src={compra.paquete.imagenPrincipal || defaultEventImage} alt={compra.paquete.nombre} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/40" />
                        <div className="absolute inset-x-0 bottom-0 p-3">
                            <p className="text-sm font-bold uppercase text-white drop-shadow">
                                CITYPASS {ciudad} · {compra.paquete.nombre}
                            </p>
                            <div className="mt-1 grid grid-cols-4 gap-1 text-[11px] text-white/90">
                                <div><span className="block text-white/60">Tipo</span>{b.tipoBoleto?.nombre ?? '-'}</div>
                                <div><span className="block text-white/60">Atracc.</span>{total}</div>
                                <div><span className="block text-white/60">Usados</span>{usados}/{total}</div>
                                <div><span className="block text-white/60">Disp.</span>{total - usados}</div>
                            </div>
                        </div>
                    </div>
                    {t && (
                        <div className="px-3 pt-3">
                            <TransferBadge t={t} esComprador={compra.esComprador !== false} />
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 p-3">
                        <button
                            type="button"
                            onClick={() => { setBoletoSel(b); setVista('atracciones'); }}
                            className="flex-1 rounded-lg border border-accentBase px-2 py-1 text-xs font-medium text-accentBase transition-colors hover:bg-accentBase hover:text-white"
                        >
                            Atracciones
                        </button>
                        {soyRemitente && t?.transferId ? (
                            <button
                                type="button"
                                onClick={() => responder(t.transferId as number, 'cancelar')}
                                className="flex-1 rounded-lg border border-red-500 px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500 hover:text-white"
                            >
                                Cancelar
                            </button>
                        ) : (
                            <>
                                {puedeTransferir && (
                                    <button
                                        type="button"
                                        onClick={() => setTransferBoletoId(b.id)}
                                        className="flex-1 rounded-lg border border-accentBase px-2 py-1 text-xs font-medium text-accentBase transition-colors hover:bg-accentBase hover:text-white"
                                    >
                                        Transferir
                                    </button>
                                )}
                                {puedeDevolver && (
                                    <button
                                        type="button"
                                        onClick={() => devolver(b.id)}
                                        className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-amber-500 px-2 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500 hover:text-white"
                                    >
                                        <MdUndo className="text-sm" /> Devolver
                                    </button>
                                )}
                            </>
                        )}
                        <p className="shrink-0 whitespace-nowrap text-base font-bold text-gray-900">{formatearDinero(precioTipo(b.tipoBoleto?.id))}</p>
                    </div>
                </div>
            );
        };

        // Card de un pase ya transferido (shape reducido: sin accesos ni QR).
        const renderTransferidoCard = (b: CityPassBoletoTransferido) => (
            <div key={b.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between bg-gradient-to-r from-accentBase to-emphasis px-3 py-2 text-neutral">
                    {config?.logoMarca ? (
                        <img src={config.logoMarca} alt="logo" className="h-5 w-auto object-contain" />
                    ) : <span className="text-sm font-bold">CityPass</span>}
                    <span className="text-right text-[11px] leading-tight">
                        Vigencia: {compra.validezDias} Días<br />
                        <b>Transferido</b>
                    </span>
                </div>
                <div className="relative h-40 bg-emphasis">
                    <img src={compra.paquete.imagenPrincipal || defaultEventImage} alt={compra.paquete.nombre} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="text-sm font-bold uppercase text-white drop-shadow">
                            CITYPASS {ciudad} · {compra.paquete.nombre}
                        </p>
                        <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-white/90">
                            <div><span className="block text-white/60">Tipo</span>{b.tipoBoleto?.nombre ?? '-'}</div>
                            <div><span className="block text-white/60">Atracc.</span>{paquete?.atraccionesCount ?? '-'}</div>
                            <div><span className="block text-white/60">Pase</span>#{b.id}</div>
                        </div>
                    </div>
                </div>
                <div className="px-3 pt-3">
                    <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600">
                        <MdSwapHoriz className="flex-none text-base" />
                        <span>Transferido a {b.transferidoA?.nombre ?? 'un amigo'}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                    <span className="text-xs text-gray-400">
                        {b.fecha ? new Date(b.fecha).toLocaleDateString('es-MX', { dateStyle: 'medium' }) : ''}
                    </span>
                    <p className="shrink-0 whitespace-nowrap text-base font-bold text-gray-900">{formatearDinero(precioTipo(b.tipoBoleto?.id))}</p>
                </div>
            </div>
        );

        return (
            <>
                <button type="button" onClick={() => setVista('lista')} className="mb-2 flex items-center text-gray-500 hover:text-gray-700">
                    <IoIosArrowRoundBack className="text-3xl" /> Regresar
                </button>
                <h2 className="text-xl font-semibold leading-tight text-gray-800 md:text-2xl 2xl:text-3xl">
                    Mis pases - CityPass {ciudad} · {compra.paquete.nombre}
                </h2>
                <p className="mt-1 text-gray-500">Aquí puedes consultar los boletos que has comprado.</p>

                <nav className="my-4 flex items-center gap-6 overflow-x-auto overflow-y-hidden border-b border-gray-200">
                    {([
                        ['pases', 'Mis Pases'],
                        ['transferidos', 'Pases transferidos'],
                        ['detalles', 'Detalles del CityPass'],
                    ] as const).map(([k, label]) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setDetalleTab(k)}
                            className={`-mb-px whitespace-nowrap pb-3 text-sm md:text-base ${detalleTab === k ? 'border-b-2 border-accentBase font-semibold text-accentBase' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {label}
                        </button>
                    ))}
                </nav>

                {detalleTab === 'pases' && (
                    <>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <Chip active={filtroEstado === 'disponibles'} onClick={() => setFiltroEstado('disponibles')} label="Disponibles" count={disponiblesCount} />
                            <Chip active={filtroEstado === 'quemados'} onClick={() => setFiltroEstado('quemados')} label="Quemados" count={quemadosCount} />
                            <span className="mx-1 h-6 w-px bg-gray-200" />
                            <Chip active={filtroTipo === 'todos'} onClick={() => setFiltroTipo('todos')} label="Todos" count={compra.boletos.length} />
                            {tiposDisponibles.map(([nombre, n]) => (
                                <Chip key={nombre} active={filtroTipo === nombre} onClick={() => setFiltroTipo(nombre)} label={nombre} count={n} />
                            ))}
                        </div>

                        {boletosFiltrados.length === 0 ? (
                            <p className="py-10 text-center text-gray-500">No hay pases que coincidan con los filtros.</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {boletosFiltrados.map(renderBoletoCard)}
                            </div>
                        )}
                    </>
                )}

                {detalleTab === 'transferidos' && (
                    boletosTransferidos.length === 0 ? (
                        <p className="py-10 text-center text-gray-500">No has transferido pases de este CityPass.</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {boletosTransferidos.map(renderTransferidoCard)}
                        </div>
                    )
                )}

                {detalleTab === 'detalles' && (
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="space-y-6 lg:col-span-2">
                            {/* Banner del paquete */}
                            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                                <div className="relative h-44">
                                    <img
                                        src={compra.paquete.imagenPrincipal || defaultEventImage}
                                        alt={compra.paquete.nombre}
                                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = defaultEventImage; }}
                                        className="h-full w-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                    <h3 className="absolute bottom-3 left-4 right-4 text-2xl font-bold text-white drop-shadow">
                                        CityPass {ciudad} · {compra.paquete.nombre}
                                    </h3>
                                </div>
                                <div className="grid gap-4 p-4 sm:grid-cols-3">
                                    <div className="flex items-start gap-2">
                                        <MdCalendarMonth className="mt-0.5 flex-none text-xl text-gray-400" />
                                        <div><p className="text-sm text-gray-500">Vigencia:</p><p className="font-medium text-gray-800">{compra.validezDias} Días</p></div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <MdLocationOn className="mt-0.5 flex-none text-xl text-gray-400" />
                                        <div><p className="text-sm text-gray-500">Ciudad:</p><p className="font-medium text-gray-800">{ciudad || '-'}</p></div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <MdCalendarMonth className="mt-0.5 flex-none text-xl text-gray-400" />
                                        <div><p className="text-sm text-gray-500">Fecha de la compra:</p><p className="font-medium text-gray-800">{formatDate(compra.fecha, "d 'de' MMMM 'del' yyyy")}</p></div>
                                    </div>
                                </div>
                            </div>

                            {/* Método de pago */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <h3 className="mb-3 font-bold text-gray-800">Método de pago</h3>
                                <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
                                    {compra.tarjeta ? (
                                        <>
                                            <TarjetaLogo marca={compra.tarjeta.marca} className="h-8 w-12 flex-none" />
                                            <div>
                                                <p className="font-medium tracking-wider text-gray-800">{enmascararTarjeta(compra.tarjeta.numero)}</p>
                                                <p className="text-sm text-gray-500">{compra.tarjeta.marca?.toUpperCase()}</p>
                                                {/* Descomentar para mostrar tipo y banco:
                                                <p className="text-sm text-gray-500">
                                                    {tipoTarjetaLabel(compra.tarjeta.tipo)}{compra.tarjeta.banco ? ` · ${compra.tarjeta.banco}` : ''}
                                                </p>
                                                */}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <FaRegCreditCard className="flex-none text-3xl text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-800">Pago con tarjeta</p>
                                                <p className="text-sm text-gray-500">Openpay</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Detalles del pedido */}
                        <div className="lg:col-span-1">
                            <div className="rounded-2xl border border-gray-200 bg-white p-5">
                                <h3 className="mb-4 text-xl font-bold text-gray-800">Detalles del pedido</h3>
                                <div className="divide-y divide-gray-100 text-sm">
                                    <div className="pb-3">
                                        <p className="text-gray-500">Enviado al correo electrónico:</p>
                                        <p className="font-semibold text-accentBase">{user?.email ?? '-'}</p>
                                    </div>
                                    <div className="py-3">
                                        <p className="text-gray-500">Total de pases comprados:</p>
                                        <p className="font-semibold text-gray-800">{compra.boletos.length} {compra.boletos.length === 1 ? 'Pase' : 'Pases'}</p>
                                    </div>
                                    <div className="py-3">
                                        <p className="text-gray-500">Atracciones por pase:</p>
                                        <p className="font-semibold text-gray-800">{paquete?.atraccionesCount ?? compra.boletos[0]?.accesos.length ?? 0} Atracciones</p>
                                    </div>
                                    <div className="py-3">
                                        <p className="mb-1 text-gray-500">Total</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-700">{compra.paquete.nombre}</span>
                                            <span className="font-semibold text-gray-900">{formatearDinero(compra.total)}</span>
                                        </div>
                                    </div>
                                    <div className="py-3">
                                        <p className="text-gray-500">Número de pedido</p>
                                        <p className="text-gray-700">{compra.id}</p>
                                    </div>
                                    <div className="flex items-center justify-between pt-3">
                                        <span className="text-lg font-bold text-gray-800">Total:</span>
                                        <span className="text-2xl font-bold text-accentBase">{formatearDinero(compra.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    };

    // ---- Atracciones ----
    const renderAtracciones = () => {
        if (!compra || !boletoSel) return null;
        const ciudad = compra.paquete.ciudad?.nombre ?? '';
        const idx = indiceEnTipo(boletoSel);
        const total = boletoSel.accesos.length;
        const disponibles = boletoSel.accesos.filter((a) => !a.quemado).length;

        return (
            <>
                <button type="button" onClick={() => setVista('detalle')} className="mb-3 flex items-center text-gray-500 hover:text-gray-700">
                    <IoIosArrowRoundBack className="text-3xl" /> Regresar
                </button>
                <h2 className="text-xl font-semibold leading-tight text-gray-800 md:text-2xl">
                    Atracciones - CityPass {ciudad} · {compra.paquete.nombre} - {boletoSel.tipoBoleto?.nombre} #{idx}
                </h2>
                <p className="mb-4 text-gray-500">Consulta las atracciones disponibles para este pase.</p>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                            <h3 className="mb-3 font-semibold text-gray-800">Atracciones</h3>
                            <div className="flex flex-col gap-3">
                                {boletoSel.accesos.map((acceso) => {
                                    const info = paquete?.atracciones.find((a) => a.id === acceso.atraccionId);
                                    return (
                                        <div key={acceso.atraccionId} className="flex gap-4 rounded-xl border border-gray-200 p-3">
                                            <img
                                                src={info?.imagenPrincipal || defaultEventImage}
                                                alt={acceso.nombre}
                                                className="h-24 w-28 flex-none rounded-lg object-cover"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-gray-900">{acceso.nombre}</h4>
                                                <p className={`mb-1 flex items-center gap-1 text-sm font-medium ${acceso.quemado ? 'text-red-500' : 'text-green-600'}`}>
                                                    <HiOutlineTicket /> {acceso.quemado ? 'Usado' : 'Disponible'}
                                                </p>
                                                {info?.direccion && (
                                                    <p className="flex items-start gap-1 text-sm text-gray-500">
                                                        <MdLocationOn className="mt-0.5 flex-none" />
                                                        <span className="line-clamp-2">{info.direccion}</span>
                                                    </p>
                                                )}
                                                <p className="flex items-start gap-1 text-sm text-gray-500">
                                                    <MdCalendarMonth className="mt-0.5 flex-none" />
                                                    <span>Horario: {acceso.horario || 'Horario desconocido'}</span>
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-1">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center lg:sticky lg:top-24">
                            <p className="text-left text-sm font-semibold text-gray-800">CityPass {ciudad} · {compra.paquete.nombre}</p>
                            <p className="mb-3 text-left text-sm text-gray-500">{boletoSel.tipoBoleto?.nombre} #{idx}</p>
                            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                <div className="h-full rounded-full bg-accentBase" style={{ width: `${total ? (disponibles / total) * 100 : 0}%` }} />
                            </div>
                            <p className="text-4xl font-bold text-gray-900">{disponibles}/{total}</p>
                            <p className="text-gray-500">Atracciones disponibles</p>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    // ---- Bandeja de transferencias (recibidas / enviadas pendientes) ----
    const renderTransferencias = () => {
        const fecha = (s: string) => new Date(s).toLocaleDateString('es-MX', { dateStyle: 'medium' });
        const nombrePase = (t: CityPassTransferencia) => t.boleto?.paquete?.nombre ?? `Pase #${t.boleto?.id ?? ''}`;
        return (
            <>
                <button type="button" onClick={() => setVista('lista')} className="mb-2 flex items-center text-gray-500 hover:text-gray-700">
                    <IoIosArrowRoundBack className="text-3xl" /> Regresar
                </button>
                <h2 className="text-xl font-semibold text-gray-800 md:text-2xl 2xl:text-3xl">Transferencias</h2>
                <p className="mt-1 text-gray-500">Acepta o rechaza pases que te enviaron y cancela los que enviaste.</p>

                <h3 className="mb-3 mt-6 flex items-center text-lg font-semibold text-gray-800">
                    Recibidas
                    {recibidasPend.length > 0 && (
                        <span className="ml-2 rounded-full bg-[#f04343] px-2 text-sm text-white">{recibidasPend.length}</span>
                    )}
                </h3>
                {recibidasPend.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-gray-400">No tienes transferencias por aceptar.</p>
                ) : (
                    <ul className="grid gap-3">
                        {recibidasPend.map((t) => (
                            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
                                <div className="min-w-0">
                                    <p className="font-medium text-gray-800">{t.fromUser?.fullName ?? 'Un amigo'} te quiere transferir un pase</p>
                                    <p className="text-sm text-gray-500">{nombrePase(t)} · {fecha(t.createdAt)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => responder(t.id, 'aceptar')} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700">
                                        <MdCheck /> Aceptar
                                    </button>
                                    <button type="button" onClick={() => responder(t.id, 'rechazar')} className="flex items-center gap-1 rounded-lg border border-red-500 px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500 hover:text-white">
                                        <MdClose /> Rechazar
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <h3 className="mb-3 mt-8 text-lg font-semibold text-gray-800">En proceso de transferencia</h3>
                {enviadasPend.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-gray-400">No tienes transferencias en proceso.</p>
                ) : (
                    <ul className="grid gap-3">
                        {enviadasPend.map((t) => (
                            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
                                <div className="min-w-0">
                                    <p className="flex items-center gap-2 font-medium text-amber-700">
                                        <MdSync className="flex-none" /> En proceso de transferencia a {t.toUser?.fullName ?? 'un amigo'}
                                    </p>
                                    <p className="text-sm text-gray-500">{nombrePase(t)} · {fecha(t.createdAt)}</p>
                                </div>
                                <button type="button" onClick={() => responder(t.id, 'cancelar')} className="flex items-center gap-1 rounded-lg border border-red-500 px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500 hover:text-white">
                                    <MdClose /> Cancelar
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </>
        );
    };

    return (
        <>
            {cargando && <Loader />}
            {vista === 'lista' && renderLista()}
            {vista === 'detalle' && renderDetalle()}
            {vista === 'atracciones' && renderAtracciones()}
            {vista === 'transferencias' && renderTransferencias()}

            <TransferirCityPassModal
                isOpen={transferBoletoId !== null}
                boletoId={transferBoletoId ?? 0}
                descripcion={compra ? `CityPass ${compra.paquete.ciudad?.nombre ?? ''} · ${compra.paquete.nombre}` : undefined}
                onClose={() => setTransferBoletoId(null)}
                onSuccess={async () => { await recargarDetalle(); await recargarInbox(); }}
            />
        </>
    );
};

// Enmascara el número dejando solo los últimos 4, agrupado en bloques de 4: **** **** **** 1234
const enmascararTarjeta = (numero: string) => {
    const limpio = (numero ?? '').replace(/\s+/g, '');
    const last4 = limpio.slice(-4);
    const masked = '*'.repeat(Math.max(0, limpio.length - 4)) + last4;
    return masked.replace(/(.{4})/g, '$1 ').trim();
};

// Tipo y banco de la tarjeta (descomentar cuando se muestren):
// const tipoTarjetaLabel = (tipo?: string) => {
//     const t = (tipo ?? '').toLowerCase();
//     if (t.includes('debit')) return 'Débito';
//     if (t.includes('credit')) return 'Crédito';
//     return '';
// };

// Logos de marca (SVG). Fallback a un icono genérico si no reconoce la marca.
const TarjetaLogo = ({ marca, className }: { marca?: string | null; className?: string }) => {
    const m = (marca ?? '').toLowerCase();
    if (m.includes('visa')) {
        return (
            <svg viewBox="0 0 48 32" className={className} xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="32" rx="4" fill="#ffffff" stroke="#e5e7eb" />
                <text x="24" y="21" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700" fontStyle="italic" fill="#1A1F71">VISA</text>
            </svg>
        );
    }
    if (m.includes('master')) {
        return (
            <svg viewBox="0 0 48 32" className={className} xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="32" rx="4" fill="#ffffff" stroke="#e5e7eb" />
                <circle cx="20" cy="16" r="8" fill="#EB001B" />
                <circle cx="28" cy="16" r="8" fill="#F79E1B" fillOpacity="0.85" />
            </svg>
        );
    }
    if (m.includes('amex') || m.includes('american')) {
        return (
            <svg viewBox="0 0 48 32" className={className} xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="32" rx="4" fill="#2E77BC" />
                <text x="24" y="20" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8.5" fontWeight="700" fill="#ffffff">AMEX</text>
            </svg>
        );
    }
    return <FaRegCreditCard className={className ?? 'text-3xl text-gray-400'} />;
};

// Etiqueta de estado de transferencia dentro de la card del boleto.
const TransferBadge = ({ t, esComprador }: { t: CityPassTransferenciaBoleto; esComprador: boolean }) => {
    if (t.estado === 'en_proceso') {
        return (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                <MdSync className="flex-none text-base" />
                <span>En proceso de transferencia{t.para?.nombre ? ` a ${t.para.nombre}` : ''}</span>
            </div>
        );
    }
    const texto = esComprador
        ? `Transferido a ${t.para?.nombre ?? 'un amigo'}`
        : `Te lo transfirió ${t.de?.nombre ?? 'un amigo'}`;
    return (
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600">
            <MdSwapHoriz className="flex-none text-base" />
            <span>{texto}</span>
        </div>
    );
};

const Chip = ({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${active ? 'bg-accentBase text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
    >
        <span>{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-white/20 text-white' : 'bg-white text-gray-600'}`}>{count}</span>
    </button>
);

export default MisCityPass;
