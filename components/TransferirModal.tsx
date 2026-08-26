import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/utils/nextRouterCompat';
import Swal from 'sweetalert2';
import { IoMdClose } from 'react-icons/io';
import { LuSearch, LuChevronDown, LuChevronUp, LuTicket, LuUsers } from 'react-icons/lu';
import UserAvatar from './UserAvatar';
import { useAmigosStore } from '../hooks/useAmigosStore';
import type { Amigo } from '../types/Amigos';
import type { TipoBoletoTransfer } from '../types/Transferencias';

// Elemento transferible que se muestra en la lista de selección y en el resumen.
// `tipo` es opcional y se devuelve tal cual en `onConfirmar` para que el consumidor
// sepa contra qué endpoint transferir (eventos usa 'asiento'|'pase'; citypass no lo usa).
export interface ItemTransferible {
    id: number;
    titulo: string;
    detalle?: string;
    precio?: number | string;
    tipo?: TipoBoletoTransfer;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    /** Elementos disponibles para transferir. En flujo simple, pasa uno solo. */
    items: ItemTransferible[];
    /** Título del encabezado. Default: "Transferir boletos". */
    titulo?: string;
    /**
     * Si es true y hay elementos, se muestra un primer paso para elegir cuáles
     * transferir ("Seleccionar todos"). Si es false, se transfieren todos los `items`.
     */
    permitirSeleccion?: boolean;
    /** Texto del checkbox de confirmación. */
    confirmacionTexto?: string;
    /** Clase de z-index del overlay (citypass necesita ir por encima del resto). */
    overlayZIndexClass?: string;
    /**
     * Ejecuta la transferencia. Recibe el destinatario y los elementos seleccionados.
     * Debe devolver el mensaje de éxito a mostrar, o lanzar un Error si falla por completo.
     */
    onConfirmar: (destinatario: Amigo, seleccionados: ItemTransferible[]) => Promise<string>;
    onSuccess?: () => void;
}

type Paso = 'seleccion' | 'destinatario' | 'exito';

const TEXTO_CONFIRMACION_DEFAULT =
    'Confirmo que acepto que estos boletos dejarán de ser míos cuando el destinatario acepte la transferencia. Mientras tanto, seguirán en mi cuenta marcados como pendientes y podré cancelar la transferencia.';

const formatPrecio = (precio: number | string) =>
    `$${Number(precio).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;

/**
 * Modal reutilizable de transferencia (eventos y citypass). Implementa el flujo del
 * diseño: selección opcional de boletos → selección de destinatario con resumen y
 * confirmación → pantalla de éxito. El consumidor sólo aporta los `items` y la
 * lógica de `onConfirmar`.
 */
const TransferirModal = ({
    isOpen,
    onClose,
    items,
    titulo = 'Transferir boletos',
    permitirSeleccion = false,
    confirmacionTexto = TEXTO_CONFIRMACION_DEFAULT,
    overlayZIndexClass = 'z-50',
    onConfirmar,
    onSuccess,
}: Props) => {
    const { getAmigos } = useAmigosStore();
    const conSeleccion = permitirSeleccion && items.length > 0;

    const [paso, setPaso] = useState<Paso>(conSeleccion ? 'seleccion' : 'destinatario');
    const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
    const [amigos, setAmigos] = useState<Amigo[]>([]);
    const [filtroAmigo, setFiltroAmigo] = useState('');
    const [amigoSeleccionado, setAmigoSeleccionado] = useState<Amigo | null>(null);
    const [resumenAbierto, setResumenAbierto] = useState(false);
    const [confirmado, setConfirmado] = useState(false);
    const [cargandoAmigos, setCargandoAmigos] = useState(false);
    const [transfiriendo, setTransfiriendo] = useState(false);
    const [resultadoMsg, setResultadoMsg] = useState('');

    // Reset total al cerrar.
    useEffect(() => {
        if (!isOpen) {
            setPaso(conSeleccion ? 'seleccion' : 'destinatario');
            setSeleccionados(new Set());
            setAmigoSeleccionado(null);
            setFiltroAmigo('');
            setResumenAbierto(false);
            setConfirmado(false);
            setResultadoMsg('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Carga de amigos al llegar al paso de destinatario.
    useEffect(() => {
        if (!isOpen || paso !== 'destinatario') return;
        const cargar = async () => {
            try {
                setCargandoAmigos(true);
                setAmigos(await getAmigos());
            } catch (error) {
                const m = error instanceof Error ? error.message : 'Error al cargar amigos';
                Swal.fire('Error', m, 'error');
            } finally {
                setCargandoAmigos(false);
            }
        };
        cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, paso]);

    const amigosFiltrados = useMemo(() => {
        const q = filtroAmigo.trim().toLowerCase();
        if (!q) return amigos;
        return amigos.filter((a) => {
            const u = a.amigo;
            return (
                (u.fullName || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.telefono || '').toLowerCase().includes(q)
            );
        });
    }, [amigos, filtroAmigo]);

    // Sin paso de selección todos los items van; con paso, sólo los marcados.
    const itemsSeleccionados = useMemo(
        () => (conSeleccion ? items.filter((i) => seleccionados.has(i.id)) : items),
        [items, seleccionados, conSeleccion],
    );

    const toggleItem = (id: number) => {
        setSeleccionados((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSeleccionarTodos = () => {
        if (seleccionados.size === items.length) setSeleccionados(new Set());
        else setSeleccionados(new Set(items.map((i) => i.id)));
    };

    const irADestinatario = () => {
        if (seleccionados.size === 0) {
            Swal.fire('Atención', 'Selecciona al menos un boleto.', 'info');
            return;
        }
        setPaso('destinatario');
    };

    const ejecutarTransferencia = async () => {
        if (!amigoSeleccionado) return;
        try {
            setTransfiriendo(true);
            const msg = await onConfirmar(amigoSeleccionado, itemsSeleccionados);
            setResultadoMsg(msg);
            setPaso('exito');
            onSuccess?.();
        } catch (error) {
            const m = error instanceof Error ? error.message : 'No se pudo completar la transferencia.';
            Swal.fire('Error', m, 'error');
        } finally {
            setTransfiriendo(false);
        }
    };

    if (!isOpen) return null;

    const resumenLinea = (i: ItemTransferible) =>
        i.detalle ? `${i.titulo} — ${i.detalle}` : i.titulo;

    return (
        <div className={`fixed inset-0 bg-black/50 ${overlayZIndexClass} flex items-center justify-center p-4`}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
                <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800">{titulo}</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl" aria-label="Cerrar">
                        <IoMdClose />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {/* PASO — selección de boletos */}
                    {paso === 'seleccion' && (
                        <>
                            {items.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-8">
                                    No tienes boletos transferibles. Es posible que ya estén en una transferencia pendiente.
                                </p>
                            ) : (
                                <>
                                    <label className="flex items-center justify-between cursor-pointer mb-3 px-2 py-2 bg-gray-50 rounded-lg">
                                        <span className="font-medium text-gray-700">Seleccionar todos</span>
                                        <span
                                            onClick={(e) => {
                                                e.preventDefault();
                                                toggleSeleccionarTodos();
                                            }}
                                            className={`inline-flex w-6 h-6 rounded-md border-2 ${seleccionados.size === items.length && items.length > 0 ? 'bg-accentBase border-accentBase text-white' : 'bg-white border-gray-300'} items-center justify-center`}
                                        >
                                            {seleccionados.size === items.length && items.length > 0 && (
                                                <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                                                    <path d="M7.629 13.671 4.146 10.19l1.414-1.415 2.07 2.07 6.71-6.71 1.414 1.414z" />
                                                </svg>
                                            )}
                                        </span>
                                    </label>

                                    <ul className="space-y-2">
                                        {items.map((i) => {
                                            const checked = seleccionados.has(i.id);
                                            return (
                                                <li key={`${i.tipo ?? 'item'}-${i.id}`}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleItem(i.id)}
                                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border ${checked ? 'border-accentBase bg-blue-50/30' : 'border-gray-200 bg-white'} text-left hover:bg-gray-50 transition`}
                                                    >
                                                        <span className={`inline-flex w-6 h-6 rounded-md border-2 flex-shrink-0 ${checked ? 'bg-accentBase border-accentBase text-white' : 'bg-white border-gray-300'} items-center justify-center`}>
                                                            {checked && (
                                                                <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                                                                    <path d="M7.629 13.671 4.146 10.19l1.414-1.415 2.07 2.07 6.71-6.71 1.414 1.414z" />
                                                                </svg>
                                                            )}
                                                        </span>
                                                        <span className="w-10 h-10 rounded-lg bg-blue-50 text-accentBase flex items-center justify-center flex-shrink-0">
                                                            <LuTicket className="text-xl" />
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-gray-800 truncate">{i.titulo}</p>
                                                            {i.detalle && <p className="text-xs text-gray-500 truncate">{i.detalle}</p>}
                                                        </div>
                                                        {i.precio !== undefined && (
                                                            <div className="text-right">
                                                                <p className="font-semibold text-gray-800">{formatPrecio(i.precio)}</p>
                                                                <p className="text-[10px] text-gray-500">MXN</p>
                                                            </div>
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </>
                            )}
                        </>
                    )}

                    {/* PASO — selección de destinatario */}
                    {paso === 'destinatario' && (
                        <>
                            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 mb-3">
                                <LuSearch className="text-gray-400" />
                                <input
                                    type="text"
                                    value={filtroAmigo}
                                    onChange={(e) => setFiltroAmigo(e.target.value)}
                                    placeholder="Buscar amigo"
                                    className="flex-1 bg-transparent outline-none text-sm text-gray-700"
                                />
                            </div>

                            {cargandoAmigos ? (
                                <p className="text-gray-500 text-sm text-center py-6">Cargando amigos...</p>
                            ) : amigos.length === 0 ? (
                                <div className="text-center py-8">
                                    <LuUsers className="mx-auto text-4xl text-gray-300 mb-3" />
                                    <p className="text-gray-600 mb-3">Aún no tienes amigos para transferir.</p>
                                    <Link
                                        to="/perfil/mis_amigos"
                                        onClick={onClose}
                                        className="inline-block bg-accentBase hover:bg-emphasis text-white px-4 py-2 rounded-lg text-sm font-medium"
                                    >
                                        Agregar amigo
                                    </Link>
                                </div>
                            ) : (
                                <ul className="space-y-2 mb-4">
                                    {amigosFiltrados.map((a) => {
                                        const checked = amigoSeleccionado?.amigo.id === a.amigo.id;
                                        return (
                                            <li key={a.friendshipId}>
                                                <button
                                                    type="button"
                                                    onClick={() => setAmigoSeleccionado(a)}
                                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border ${checked ? 'border-accentBase' : 'border-gray-200'} bg-white hover:bg-gray-50 text-left transition`}
                                                >
                                                    <UserAvatar nombre={a.amigo.fullName} image={a.amigo.image} size={40} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-gray-800 truncate">{a.amigo.fullName}</p>
                                                        <p className="text-xs text-gray-500 truncate">{a.amigo.email || a.amigo.telefono || ''}</p>
                                                    </div>
                                                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${checked ? 'border-accentBase' : 'border-gray-300'} flex items-center justify-center`}>
                                                        {checked && <span className="w-2.5 h-2.5 rounded-full bg-accentBase" />}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                    {amigosFiltrados.length === 0 && (
                                        <li className="text-center text-gray-400 text-sm py-4">Sin coincidencias</li>
                                    )}
                                </ul>
                            )}

                            {itemsSeleccionados.length > 0 && (
                                <div className="border border-gray-200 rounded-xl mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setResumenAbierto((v) => !v)}
                                        className="w-full flex items-center justify-between px-4 py-3 font-semibold text-gray-800"
                                    >
                                        <span>Resumen de selección</span>
                                        {resumenAbierto ? <LuChevronUp /> : <LuChevronDown />}
                                    </button>
                                    {resumenAbierto && (
                                        <ul className="px-4 pb-3 space-y-1 text-sm">
                                            {itemsSeleccionados.map((i) => (
                                                <li key={`r-${i.tipo ?? 'item'}-${i.id}`} className="flex justify-between gap-2">
                                                    <span className="text-gray-700 truncate">{resumenLinea(i)}</span>
                                                    {i.precio !== undefined && (
                                                        <span className="font-semibold text-gray-800 whitespace-nowrap">{formatPrecio(i.precio)}</span>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={confirmado}
                                    onChange={(e) => setConfirmado(e.target.checked)}
                                    className="mt-1 accent-accentBase"
                                />
                                <span className="text-xs text-gray-700 leading-relaxed">{confirmacionTexto}</span>
                            </label>
                        </>
                    )}

                    {/* PASO — éxito */}
                    {paso === 'exito' && (
                        <div className="text-center py-6">
                            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
                                <svg viewBox="0 0 20 20" className="w-8 h-8 fill-current">
                                    <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 4a.75.75 0 0 0-1.5 0v4.5c0 .2.08.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V6Z" />
                                </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800 mb-2">Transferencia enviada</h4>
                            <p className="text-sm text-gray-600 whitespace-pre-line">{resultadoMsg}</p>
                            <p className="text-xs text-gray-500 mt-3">
                                Mientras está pendiente, el boleto seguirá en tu cuenta marcado como "transferencia pendiente".
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer acciones */}
                <footer className="border-t border-gray-100 px-5 py-4 flex items-center justify-between gap-3">
                    {paso === 'seleccion' && (
                        <>
                            <button type="button" onClick={onClose} className="text-gray-600 font-medium px-4 py-2 hover:text-gray-800">
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={irADestinatario}
                                disabled={seleccionados.size === 0}
                                className="bg-accentBase hover:bg-emphasis text-white font-medium rounded-lg px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continuar
                            </button>
                        </>
                    )}
                    {paso === 'destinatario' && (
                        <>
                            <button type="button" onClick={onClose} className="text-gray-600 font-medium px-4 py-2 hover:text-gray-800">
                                Cancelar
                            </button>
                            <div className="flex items-center gap-2">
                                {conSeleccion && (
                                    <button
                                        type="button"
                                        onClick={() => setPaso('seleccion')}
                                        className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg px-5 py-2"
                                    >
                                        Regresar
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={ejecutarTransferencia}
                                    disabled={!amigoSeleccionado || !confirmado || transfiriendo}
                                    className="bg-accentBase hover:bg-emphasis text-white font-medium rounded-lg px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {transfiriendo ? 'Transfiriendo...' : 'Transferir'}
                                </button>
                            </div>
                        </>
                    )}
                    {paso === 'exito' && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="ml-auto bg-accentBase hover:bg-emphasis text-white font-medium rounded-lg px-6 py-2"
                        >
                            Cerrar
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default TransferirModal;
