import { useEventosStore } from '../../../hooks/useEventosStore';
import { useTransferenciasStore } from '../../../hooks/useTransferenciasStore';
import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { formatDate } from '../../../utils/dateHelpers';
import { rutaEvento } from '../../../utils/eventoSlug';
import { TbTicket } from 'react-icons/tb';
import { FaRegStar } from 'react-icons/fa';
import { GoChevronRight } from 'react-icons/go';
import { MdDateRange, MdViewList, MdGridView } from 'react-icons/md';
import { IoIosArrowRoundBack } from 'react-icons/io';
import Sidebar from './components/Sidebar';
const defaultEventImage = '/event_default.webp';
import { differenceInDays, parseISO, isAfter } from 'date-fns';
import { Link } from '@/utils/nextRouterCompat';
import Loader from '@/publicUi/components/Loader';
import apiApplication from '../../../api/apiApplication';
import TransferirBoletoModal from '../../components/TransferirBoletoModal';
import MultiTransferirModal, { BoletoTransferible } from '../../components/MultiTransferirModal';
import BoletoCard, { BoletoCardData } from './components/BoletoCard';
import BoletoDetalleModal from './components/BoletoDetalleModal';
import DetallesPedidoTab from './components/DetallesPedidoTab';
import MisCityPass from './components/MisCityPass';
import type { TipoBoletoTransfer, TransferenciaPendienteInfo } from '../../../types/Transferencias';

interface Eventos {
    id: number;
    nombre: string;
    imagenPromocion: string;
    fecha: string;
    cantidadBoletos: number;
    cantidadDinero: number;
    recinto?: { nombre?: string };
    ciudad?: { nombre?: string };
    funcionId?: number | null;
    funcionNombre?: string | null;
}

interface Evento {
    id: number;
    nombre: string;
    imagenPromocion: string;
    fecha: string;
    recinto?: { nombre?: string; direccion?: string } | null;
    ciudad?: { nombre?: string } | null;
    fechaCompra?: string;
    direccion?: string;
    metodoPago?: { tipo?: string; ultimosDigitos?: string } | null;
    numeroPedido?: string | number | null;
}

interface Perfil {
    id: number;
    fullName: string;
    email: string;
}

interface BoletoVigente extends BoletoCardData {
    quemadoUUID: string;
    quemadoFlag: boolean;
    ticket?: { id?: number };
    transferenciaPendiente?: TransferenciaPendienteInfo | null;
    esCompradorOriginal?: boolean;
}

interface BoletoTransferido extends BoletoCardData {
    transferido: true;
    transferidoEn: string;
    transferidoA: { id: string; fullName: string; image?: string | null };
}

type Tab = 'mis_boletos' | 'transferidos' | 'detalles';
type FiltroEstado = 'sin_quemar' | 'quemados';
type FiltroTipo = 'todos' | 'generales' | 'numerados' | 'abonos';

function MisComprasPage() {
    const { getMisEventos, getMisBoletos } = useEventosStore();
    const { responderTransferencia, devolverBoleto } = useTransferenciasStore();

    const [eventos, setEventos] = useState<Eventos[]>([]);
    const [boletos, setBoletos] = useState<BoletoVigente[]>([]);
    const [pasesGenerales, setPasesGenerales] = useState<BoletoVigente[]>([]);
    const [transferidos, setTransferidos] = useState<{ asientos: BoletoTransferido[]; pases: BoletoTransferido[] }>({ asientos: [], pases: [] });
    const [showBoletos, setShowBoletos] = useState(false);
    const [eventoIdActual, setEventoIdActual] = useState<number | null>(null);
    const [funcionIdActual, setFuncionIdActual] = useState<number | null>(null);
    const [evento, setEvento] = useState<Evento | null>(null);
    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [tabEventos, setTabEventos] = useState<'proximos' | 'pasados'>('proximos');
    const [vista, setVista] = useState<'grid' | 'lista'>('lista');
    const [cargando, setCargando] = useState(false);
    const [walletActive, setWalletActive] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false });
    const [producto, setProducto] = useState<'eventos' | 'citypass'>('eventos');

    const [tab, setTab] = useState<Tab>('mis_boletos');
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('sin_quemar');
    const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');

    const [transferirState, setTransferirState] = useState<{
        open: boolean;
        tipo: TipoBoletoTransfer;
        boletoId: number;
        descripcion: string;
    }>({ open: false, tipo: 'asiento', boletoId: 0, descripcion: '' });

    const [multiOpen, setMultiOpen] = useState(false);
    const [detalleBoleto, setDetalleBoleto] = useState<BoletoVigente | null>(null);

    useEffect(() => {
        const fetchEventos = async () => {
            try {
                setCargando(true);
                const response = await getMisEventos();
                setEventos(response);
            } catch (error) {
                console.log(error);
            } finally {
                setCargando(false);
            }
        };
        fetchEventos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const cargarPerfil = async () => {
            const { data } = await apiApplication.get('/usuarios/mi_perfil');
            setPerfil(data);
        };
        cargarPerfil();
    }, []);

    useEffect(() => {
        const cargarWallet = async () => {
            const { data } = await apiApplication.get<{ google: boolean; apple: boolean }>('/wallet/is-active');
            setWalletActive(data);
        };
        cargarWallet();
    }, []);

    const refetchBoletosEvento = async () => {
        if (!eventoIdActual) return;
        try {
            setCargando(true);
            const response = await getMisBoletos(eventoIdActual, funcionIdActual);
            setBoletos(response.boletos ?? []);
            setPasesGenerales(response.pasesGenerales ?? []);
            setEvento((prev) => ({
                ...(prev ?? ({} as Evento)),
                ...(response.evento ?? {}),
                id: eventoIdActual,
            }));
            setTransferidos({
                asientos: response.transferidos?.asientos ?? [],
                pases: response.transferidos?.pases ?? [],
            });
        } catch (error) {
            console.log(error);
        } finally {
            setCargando(false);
        }
    };

    const handleGetDetalleBoletos = async (eventoLista: Eventos) => {
        try {
            setShowBoletos(true);
            setCargando(true);
            setTab('mis_boletos');
            setFiltroEstado('sin_quemar');
            setFiltroTipo('todos');
            setEventoIdActual(eventoLista.id);
            setFuncionIdActual(eventoLista.funcionId ?? null);
            const response = await getMisBoletos(eventoLista.id, eventoLista.funcionId);
            setBoletos(response.boletos ?? []);
            setPasesGenerales(response.pasesGenerales ?? []);
            const nombreBase = response.evento?.nombre ?? eventoLista.nombre;
            setEvento({
                ...response.evento,
                id: eventoLista.id,
                nombre: eventoLista.funcionNombre ? `${nombreBase} - ${eventoLista.funcionNombre}` : nombreBase,
                imagenPromocion: response.evento?.imagenPromocion ?? eventoLista.imagenPromocion,
                fecha: response.evento?.fecha ?? eventoLista.fecha,
                recinto: response.evento?.recinto ?? eventoLista.recinto ?? null,
                ciudad: response.evento?.ciudad ?? eventoLista.ciudad ?? null,
            });
            setTransferidos({
                asientos: response.transferidos?.asientos ?? [],
                pases: response.transferidos?.pases ?? [],
            });
        } catch (error) {
            console.log(error);
        } finally {
            setCargando(false);
        }
    };

    const hoy = new Date();
    const eventosProximos = eventos.filter((e) => isAfter(parseISO(e.fecha), hoy));
    const eventosPasados = eventos.filter((e) => !isAfter(parseISO(e.fecha), hoy));

    const renderEventos = (lista: Eventos[]) =>
        lista.map((e, index) => {
            const fechaEvento = parseISO(e.fecha);
            const diasRestantes = differenceInDays(fechaEvento, hoy);
            const mensajeDias =
                diasRestantes > 0
                    ? `Dentro de ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}`
                    : diasRestantes === 0
                        ? '¡Hoy es el evento!'
                        : 'El evento ya pasó';

            return (
                <div key={index} className={`${vista === 'grid' ? 'w-full md:w-1/2 lg:w-1/3 p-2' : 'w-full mb-4'}`}>
                    <div className={`border border-gray-300 bg-white shadow-sm rounded-xl flex flex-col lg:flex-row gap-4 p-2 lg:p-4 ${vista === 'grid' ? 'lg:flex-col' : 'flex-row'}`}>
                        <img
                            className={`object-cover rounded-xl ${vista === 'grid' ? 'w-full max-h-96 aspect-square' : 'w-32 h-32'}`}
                            src={e.imagenPromocion || defaultEventImage}
                            alt="Imagen promocional"
                            onError={(ev) => {
                                ev.currentTarget.onerror = null;
                                ev.currentTarget.src = defaultEventImage;
                            }}
                        />
                        <div className={`${vista === 'grid' ? 'text-center' : 'flex-1'}`}>
                            <h3 className={`text-gray-800 text-lg font-semibold flex flex-wrap items-center justify-between ${vista === 'grid' ? 'flex-col' : 'flex-row mb-2'}`}>
                                {e.funcionNombre ? `${e.nombre} - ${e.funcionNombre}` : e.nombre}
                                {mensajeDias !== 'El evento ya pasó' && (
                                    <Link to={rutaEvento(e, e.funcionId ? { id: e.funcionId, nombre: e.funcionNombre, fecha: e.fecha } : null)} className="text-accentLight font-normal flex items-center gap-2 mt-2 text-base">
                                        Ver evento <GoChevronRight className="text-xl" />
                                    </Link>
                                )}
                            </h3>
                            <div className={`flex flex-wrap ${vista === 'grid' ? 'justify-center' : 'justify-between mb-2'}`}>
                                <p className={`text-gray-600 flex items-center gap-x-2 w-full ${vista === 'grid' ? 'flex-col mt-2' : 'flex-row justify-between'}`}>
                                    <span className="flex flex-wrap items-center gap-x-2 lg:whitespace-nowrap">
                                        <MdDateRange className="text-xl" />
                                        {e.fecha ? formatDate(e.fecha, 'dd MMMM yyyy, hh:mma') : 'Fecha no disponible'}
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm">{mensajeDias}</span>
                                </p>
                            </div>
                            <p className={`text-gray-600 flex items-center gap-x-2 ${vista === 'grid' ? 'flex-col' : 'flex-row'}`}>
                                <span className="flex flex-wrap items-center gap-x-2">
                                    <TbTicket className="text-xl" />
                                    {e.cantidadBoletos} {e.cantidadBoletos === 1 ? 'Boleto' : 'Boletos'}
                                </span>
                                <button onClick={() => handleGetDetalleBoletos(e)} className="text-accentLight ml-1">
                                    detalle de boleto(s)
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            );
        });

    /** Filtrado de la pestaña Mis boletos. */
    const todosVigentes = useMemo<BoletoVigente[]>(() => [...boletos, ...pasesGenerales], [boletos, pasesGenerales]);

    const conteoTipo = useMemo(
        () => ({
            todos: todosVigentes.length,
            generales: pasesGenerales.length,
            numerados: boletos.length,
            abonos: 0,
        }),
        [todosVigentes, pasesGenerales, boletos],
    );

    const conteoEstado = useMemo(() => {
        const pool = todosVigentes;
        return {
            sin_quemar: pool.filter((b) => !b.quemadoFlag).length,
            quemados: pool.filter((b) => !!b.quemadoFlag).length,
        };
    }, [todosVigentes]);

    const boletosFiltrados = useMemo(() => {
        let pool: BoletoVigente[];
        if (filtroTipo === 'generales') pool = pasesGenerales;
        else if (filtroTipo === 'numerados') pool = boletos;
        else if (filtroTipo === 'abonos') pool = [];
        else pool = todosVigentes;
        return pool.filter((b) => (filtroEstado === 'quemados' ? !!b.quemadoFlag : !b.quemadoFlag));
    }, [filtroTipo, filtroEstado, todosVigentes, boletos, pasesGenerales]);

    const transferidosTodos = useMemo(
        () => [...transferidos.asientos, ...transferidos.pases],
        [transferidos],
    );

    const openTransferenciaSimple = (b: BoletoVigente) => {
        const esPaseGeneral = !!b.eventoSeccion;
        const partes: string[] = [];
        if (evento?.nombre) partes.push(evento.nombre);
        if (esPaseGeneral) {
            partes.push('General');
            const bl = b.eventoSeccion?.seccion?.bloque?.nombre;
            const s = b.eventoSeccion?.seccion?.nombre;
            if (bl) partes.push(`B${bl}`);
            if (s) partes.push(`S${s}`);
        } else {
            if (b.categoria?.nombre) partes.push(b.categoria.nombre);
            const fila = b.asiento?.fila?.nombre;
            const num = b.asiento?.numero;
            if (fila || num) partes.push(`${fila ?? ''}${num ?? ''}`);
        }
        setTransferirState({
            open: true,
            tipo: esPaseGeneral ? 'pase' : 'asiento',
            boletoId: b.id,
            descripcion: partes.filter(Boolean).join(' · '),
        });
    };

    const handleDevolver = async (b: BoletoVigente) => {
        if (b.transferenciaPendiente) {
            Swal.fire(
                'Transferencia pendiente',
                'Resuelve la transferencia pendiente antes de devolver el boleto.',
                'info',
            );
            return;
        }
        const confirm = await Swal.fire({
            title: '¿Devolver boleto?',
            text: 'El boleto regresará a su comprador original.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, devolver',
            cancelButtonText: 'No',
            confirmButtonColor: '#d97706',
        });
        if (!confirm.isConfirmed) return;
        try {
            await devolverBoleto({
                tipo: b.eventoSeccion ? 'pase' : 'asiento',
                boletoId: b.id,
            });
            Swal.fire({
                icon: 'success',
                title: 'Boleto devuelto',
                text: 'El boleto volvió a su comprador original.',
                timer: 1800,
                showConfirmButton: false,
            });
            await refetchBoletosEvento();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error al devolver el boleto';
            Swal.fire('No se pudo devolver', mensaje, 'error');
        }
    };

    const handleCancelarPendiente = async (b: BoletoVigente) => {
        const pendiente = b.transferenciaPendiente;
        if (!pendiente) return;
        const destinatario = pendiente.toUser?.fullName ?? 'el destinatario';
        const confirm = await Swal.fire({
            title: '¿Cancelar transferencia?',
            text: `Se cancelará la transferencia pendiente a ${destinatario}.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No',
            confirmButtonColor: '#dc2626',
        });
        if (!confirm.isConfirmed) return;
        try {
            await responderTransferencia(pendiente.id, 'cancelar');
            Swal.fire({
                icon: 'success',
                title: 'Transferencia cancelada',
                timer: 1800,
                showConfirmButton: false,
            });
            await refetchBoletosEvento();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error al cancelar la transferencia';
            Swal.fire('Error', mensaje, 'error');
        }
    };

    const boletosParaMulti: BoletoTransferible[] = useMemo(
        () =>
            todosVigentes
                .filter((b) => !b.quemadoFlag && !b.transferenciaPendiente)
                .map((b) => {
                    const esPaseGeneral = !!b.eventoSeccion;
                    const cat = esPaseGeneral ? 'Asiento General' : `Asiento ${b.categoria?.nombre ?? ''}`.trim();
                    const sec = esPaseGeneral
                        ? b.eventoSeccion?.seccion?.nombre
                        : b.asiento?.fila?.seccion?.nombre;
                    const bl = esPaseGeneral
                        ? b.eventoSeccion?.seccion?.bloque?.nombre
                        : b.asiento?.fila?.seccion?.bloque?.nombre;
                    const asientoStr = esPaseGeneral
                        ? ''
                        : ` · Asiento ${b.asiento?.fila?.nombre ?? ''}${b.asiento?.numero ?? ''}`;
                    return {
                        id: b.id,
                        tipo: (esPaseGeneral ? 'pase' : 'asiento') as TipoBoletoTransfer,
                        titulo: cat || 'Asiento',
                        detalle: `Sección ${sec ?? '-'} · Bloque ${bl ?? '-'}${asientoStr}`,
                        precio: b.eventoSeccion?.precioEspecial ?? b.precio ?? 0,
                    };
                }),
        [todosVigentes],
    );

    const googlePass = async (uuidBoleto: string, esGeneral: boolean) => {
        try {
            const { data } = await apiApplication.get<{ url: string }>('/wallet/google-ticket', {
                params: { uuidBoleto, esGeneral },
            });
            window.open(data.url, '_blank');
        } catch (error) {
            console.error('Error Google Wallet:', error);
        }
    };

    const applePass = (uuidBoleto: string, esGeneral: boolean) => {
        const url = `${apiApplication.defaults.baseURL}/wallet/apple-ticket?uuidBoleto=${encodeURIComponent(uuidBoleto)}&esGeneral=${encodeURIComponent(String(esGeneral))}`;
        window.location.assign(url);
    };

    return (
        <div style={{ backgroundImage: `url('/bg_perfil.svg')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'top', backgroundSize: '100%', paddingTop: '40px' }}>
            {cargando && <Loader />}
            <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
                <div className="grid grid-cols-7 gap-4 items-start mb-5">
                    <Sidebar />
                    <section className="bg-gray-50 shadow-md rounded-xl col-span-7 md:col-span-4 lg:col-span-5 p-4">
                        {producto === 'citypass' ? (
                            <MisCityPass producto={producto} onProducto={setProducto} />
                        ) : !showBoletos ? (
                            <>
                                <h2 className="text-gray-800 text-2xl 2xl:text-3xl font-semibold">Mis compras</h2>
                                <hr className="my-3" />
                                <p className="text-gray-600 mb-8">Aquí puedes consultar los boletos de los eventos que has comprado.</p>

                                <div className="mb-5 inline-flex rounded-xl border border-gray-200 bg-white p-1">
                                    <button
                                        type="button"
                                        className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800"
                                    >
                                        <TbTicket className="text-lg" /> Eventos
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProducto('citypass')}
                                        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-gray-400 hover:text-gray-600"
                                    >
                                        <FaRegStar className="text-lg" /> City Pass
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 items-center gap-4 mb-5">
                                    <div className="col-span-2 lg:col-span-1">
                                        <button
                                            className={`px-4 py-2 ${tabEventos === 'proximos' ? 'border-b-2 border-gray-600 text-gray-700 font-semibold' : 'text-gray-400'}`}
                                            onClick={() => setTabEventos('proximos')}
                                        >
                                            Próximos Eventos <span className="bg-[#f04343ff] rounded-full text-white w-10 inline-block ml-2">{eventosProximos.length}</span>
                                        </button>
                                        <button
                                            className={`px-4 py-2 ${tabEventos === 'pasados' ? 'border-b-2 border-gray-600 text-gray-700 font-semibold' : 'text-gray-400'}`}
                                            onClick={() => setTabEventos('pasados')}
                                        >
                                            Eventos Pasados
                                        </button>
                                    </div>
                                    <div className="col-span-2 lg:col-span-1 flex justify-end gap-4">
                                        <button
                                            className={`p-2 rounded-md ${vista === 'lista' ? 'bg-accentLight text-neutral' : 'bg-gray-200 text-gray-600'}`}
                                            onClick={() => setVista('lista')}
                                        >
                                            <MdViewList className="text-2xl" />
                                        </button>
                                        <button
                                            className={`p-2 rounded-md ${vista === 'grid' ? 'bg-accentLight text-neutral' : 'bg-gray-200 text-gray-600'}`}
                                            onClick={() => setVista('grid')}
                                        >
                                            <MdGridView className="text-2xl" />
                                        </button>
                                    </div>
                                </div>

                                <div className={vista === 'grid' ? 'flex flex-wrap -m-2' : 'flex flex-col'}>
                                    {eventos.length > 0 && (
                                        <>{tabEventos === 'proximos' ? renderEventos(eventosProximos) : renderEventos(eventosPasados)}</>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Header detalle */}
                                <button
                                    type="button"
                                    onClick={() => setShowBoletos(false)}
                                    className="flex items-center text-gray-500 hover:text-gray-700 mb-3"
                                >
                                    <IoIosArrowRoundBack className="text-3xl" /> Regresar
                                </button>

                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-2">
                                    <div className="min-w-0">
                                        <h2 className="text-gray-800 text-xl md:text-2xl 2xl:text-3xl font-semibold leading-tight">
                                            Mis boletos - {evento?.nombre}
                                        </h2>
                                        <p className="text-gray-500 mt-1">Aquí puedes consultar los boletos has comprado.</p>
                                    </div>
                                    {boletosParaMulti.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setMultiOpen(true)}
                                            className="bg-accentBase hover:bg-emphasis text-white font-medium rounded-lg px-5 py-2.5 whitespace-nowrap"
                                        >
                                            Transferir boletos
                                        </button>
                                    )}
                                </div>

                                {/* Tabs */}
                                <nav className="flex items-center gap-6 border-b border-gray-200 mb-4 overflow-x-auto">
                                    {([
                                        ['mis_boletos', 'Mis boletos'],
                                        ['transferidos', 'Boletos transferidos'],
                                        ['detalles', 'Detalles del pedido'],
                                    ] as const).map(([k, label]) => (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => setTab(k)}
                                            className={`pb-3 -mb-px text-sm md:text-base whitespace-nowrap ${tab === k ? 'text-accentBase border-b-2 border-accentBase font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </nav>

                                {/* Contenido por tab */}
                                {tab === 'mis_boletos' && (
                                    <>
                                        {/* Filtros */}
                                        <div className="flex flex-col gap-3 mb-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <FiltroChip
                                                    active={filtroEstado === 'sin_quemar'}
                                                    onClick={() => setFiltroEstado('sin_quemar')}
                                                    label="Sin quemar"
                                                    count={conteoEstado.sin_quemar}
                                                />
                                                <FiltroChip
                                                    active={filtroEstado === 'quemados'}
                                                    onClick={() => setFiltroEstado('quemados')}
                                                    label="Quemados"
                                                    count={conteoEstado.quemados}
                                                />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <FiltroChip
                                                    active={filtroTipo === 'todos'}
                                                    onClick={() => setFiltroTipo('todos')}
                                                    label="Todos"
                                                    count={conteoTipo.todos}
                                                />
                                                <FiltroChip
                                                    active={filtroTipo === 'generales'}
                                                    onClick={() => setFiltroTipo('generales')}
                                                    label="Generales"
                                                    count={conteoTipo.generales}
                                                />
                                                <FiltroChip
                                                    active={filtroTipo === 'numerados'}
                                                    onClick={() => setFiltroTipo('numerados')}
                                                    label="Numerados"
                                                    count={conteoTipo.numerados}
                                                />
                                                {conteoTipo.abonos > 0 && (
                                                    <FiltroChip
                                                        active={filtroTipo === 'abonos'}
                                                        onClick={() => setFiltroTipo('abonos')}
                                                        label="Abonos"
                                                        count={conteoTipo.abonos}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* Grid de boletos */}
                                        {boletosFiltrados.length === 0 ? (
                                            <p className="text-center text-gray-500 py-10">
                                                No hay boletos que coincidan con los filtros.
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                                {boletosFiltrados.map((b) => (
                                                    <BoletoCard
                                                        key={`v-${b.id}`}
                                                        evento={evento}
                                                        boleto={b}
                                                        variant="vigente"
                                                        // onClick={() => setDetalleBoleto(b)} // QR al hacer click deshabilitado
                                                        onTransferir={() => openTransferenciaSimple(b)}
                                                        onDevolver={b.esCompradorOriginal === false ? () => handleDevolver(b) : undefined}
                                                        onCancelarPendiente={() => handleCancelarPendiente(b)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {tab === 'transferidos' && (
                                    <>
                                        {transferidosTodos.length === 0 ? (
                                            <p className="text-center text-gray-500 py-10">
                                                No has transferido ningún boleto de este evento.
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                                {transferidosTodos.map((t) => (
                                                    <BoletoCard
                                                        key={`t-${t.id}`}
                                                        evento={evento}
                                                        boleto={t}
                                                        variant="transferido"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {tab === 'detalles' && (
                                    <DetallesPedidoTab
                                        evento={evento}
                                        perfil={perfil}
                                        boletos={todosVigentes}
                                    />
                                )}
                            </>
                        )}
                    </section>
                </div>
            </div>

            <TransferirBoletoModal
                isOpen={transferirState.open}
                onClose={() => setTransferirState((s) => ({ ...s, open: false }))}
                tipo={transferirState.tipo}
                boletoId={transferirState.boletoId}
                descripcionBoleto={transferirState.descripcion}
                onSuccess={() => refetchBoletosEvento()}
            />

            <MultiTransferirModal
                isOpen={multiOpen}
                onClose={() => setMultiOpen(false)}
                boletos={boletosParaMulti}
                onSuccess={() => refetchBoletosEvento()}
            />

            <BoletoDetalleModal
                isOpen={!!detalleBoleto}
                onClose={() => setDetalleBoleto(null)}
                evento={evento}
                boleto={detalleBoleto}
                walletActive={walletActive}
                onTransferir={() => {
                    if (detalleBoleto) {
                        openTransferenciaSimple(detalleBoleto);
                        setDetalleBoleto(null);
                    }
                }}
                onCancelarPendiente={() => {
                    if (detalleBoleto) {
                        const b = detalleBoleto;
                        setDetalleBoleto(null);
                        handleCancelarPendiente(b);
                    }
                }}
                onGoogleWallet={() => detalleBoleto && googlePass(detalleBoleto.quemadoUUID, !!detalleBoleto.eventoSeccion)}
                onAppleWallet={() => detalleBoleto && applePass(detalleBoleto.quemadoUUID, !!detalleBoleto.eventoSeccion)}
            />
        </div>
    );
}

interface FiltroChipProps {
    active: boolean;
    label: string;
    count: number;
    onClick: () => void;
}

const FiltroChip = ({ active, label, count, onClick }: FiltroChipProps) => (
    <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${active ? 'bg-accentBase text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
    >
        <span>{label}</span>
        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${active ? 'bg-white/20 text-white' : 'bg-accentBase text-white'}`}>
            {count}
        </span>
    </button>
);

export default MisComprasPage;
