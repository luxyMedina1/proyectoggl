import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { LuPhone, LuUserPlus, LuTrash2 } from 'react-icons/lu';
import { IoMdCheckmark, IoMdClose } from 'react-icons/io';
import Sidebar from './components/Sidebar';
import UserAvatar from '../../../components/UserAvatar';
import Loader from '@/publicUi/components/Loader';
import { CountryCodeSelect } from '../../../auth/components/CountryCodeSelect';
import { CountryCode, DEFAULT_COUNTRY } from '../../../data/countryCodes';
import { useAmigosStore } from '../../../hooks/useAmigosStore';
import { emitNotifRefresh } from '../../../utils/notifEvents';
import type { Amigo, FriendRequest } from '../../../types/Amigos';

const onlyDigits = (s: string) => s.replace(/\D+/g, '');

const POLL_MS = 30_000;

const MisAmigosPage = () => {
    const {
        enviarSolicitud,
        getSolicitudesRecibidas,
        getSolicitudesEnviadas,
        responderSolicitud,
        getAmigos,
        eliminarAmistad,
    } = useAmigosStore();

    const [amigos, setAmigos] = useState<Amigo[]>([]);
    const [recibidas, setRecibidas] = useState<FriendRequest[]>([]);
    const [enviadas, setEnviadas] = useState<FriendRequest[]>([]);
    const [cargando, setCargando] = useState(false);
    const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
    const [telefono, setTelefono] = useState('');
    const [enviando, setEnviando] = useState(false);

    // Teléfono normalizado a E.164 (formato del registro): +<código><dígitos>, sin separadores.
    const telefonoE164 = useMemo(
        () => `+${country.dialCode}${onlyDigits(telefono)}`,
        [country, telefono],
    );
    const telefonoValido = onlyDigits(telefono).length >= 7;
    const telefonoDisplay = useMemo(() => {
        const d = onlyDigits(telefono);
        if (d.length <= 3) return d;
        if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
        return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    }, [telefono]);

    const cargarTodo = async () => {
        try {
            setCargando(true);
            const [a, r, e] = await Promise.all([
                getAmigos(),
                getSolicitudesRecibidas(),
                getSolicitudesEnviadas(),
            ]);
            setAmigos(a);
            setRecibidas(r);
            setEnviadas(e);
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error inesperado';
            Swal.fire('Error', mensaje, 'error');
        } finally {
            setCargando(false);
        }
    };

    // Mount-only: carga inicial. Las fns del hook se re-crean cada render,
    // así que NO van en deps; usarlas dispararía un loop infinito.
    useEffect(() => {
        cargarTodo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Polling solicitudes recibidas (cada 30 s).
    useEffect(() => {
        const id = window.setInterval(async () => {
            try {
                const r = await getSolicitudesRecibidas();
                setRecibidas(r);
            } catch {
                // silencioso
            }
        }, POLL_MS);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleEnviar = async () => {
        if (!telefonoValido) {
            Swal.fire('Atención', 'Ingresa un número de teléfono válido.', 'info');
            return;
        }
        try {
            setEnviando(true);
            await enviarSolicitud(telefonoE164);
            setTelefono('');
            await cargarTodo();
            Swal.fire({
                icon: 'success',
                title: 'Solicitud enviada',
                text: 'Si el número está registrado, recibirá tu solicitud de amistad.',
                timer: 2500,
                showConfirmButton: false,
            });
        } catch (error) {
            // El backend valida usuario inexistente, agregarte a ti mismo,
            // que ya sean amigos o que exista una solicitud pendiente.
            const mensaje = error instanceof Error ? error.message : 'Error al enviar la solicitud';
            Swal.fire('Error', mensaje, 'error');
        } finally {
            setEnviando(false);
        }
    };

    const handleAceptar = async (solicitud: FriendRequest) => {
        try {
            await responderSolicitud(solicitud.id, 'aceptar');
            await cargarTodo();
            emitNotifRefresh();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error al aceptar';
            Swal.fire('Error', mensaje, 'error');
        }
    };

    const handleRechazar = async (solicitud: FriendRequest) => {
        try {
            await responderSolicitud(solicitud.id, 'rechazar');
            await cargarTodo();
            emitNotifRefresh();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error al rechazar';
            Swal.fire('Error', mensaje, 'error');
        }
    };

    const handleCancelar = async (solicitud: FriendRequest) => {
        const confirm = await Swal.fire({
            title: '¿Cancelar solicitud?',
            text: `Se cancelará la solicitud enviada a ${solicitud.destinatario?.fullName ?? 'este usuario'}.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No',
        });
        if (!confirm.isConfirmed) return;
        try {
            await responderSolicitud(solicitud.id, 'cancelar');
            await cargarTodo();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error al cancelar';
            Swal.fire('Error', mensaje, 'error');
        }
    };

    const handleEliminarAmigo = async (amigo: Amigo) => {
        const confirm = await Swal.fire({
            title: '¿Quitar amigo?',
            text: `${amigo.amigo.fullName} dejará de ser tu amigo.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, quitar',
            cancelButtonText: 'No',
            confirmButtonColor: '#dc2626',
        });
        if (!confirm.isConfirmed) return;
        try {
            await eliminarAmistad(amigo.friendshipId);
            await cargarTodo();
        } catch (error) {
            const mensaje = error instanceof Error ? error.message : 'Error al eliminar';
            Swal.fire('Error', mensaje, 'error');
        }
    };

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
                        <h2 className="text-gray-800 text-2xl 2xl:text-3xl font-semibold">Amigos</h2>
                        <hr className="my-3" />

                        {/* Input + Enviar solicitud */}
                        <div className="mb-6">
                            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                                <div className="w-full sm:w-40">
                                    <CountryCodeSelect value={country} onChange={setCountry} />
                                </div>
                                <div className="flex items-center gap-2 flex-1">
                                    <LuPhone className="text-gray-400 text-xl" />
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        value={telefonoDisplay}
                                        onChange={(e) => setTelefono(onlyDigits(e.target.value).slice(0, 15))}
                                        placeholder="Número de teléfono del amigo"
                                        className="flex-1 outline-none bg-transparent text-gray-700 placeholder-gray-400 py-2"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleEnviar();
                                            }
                                        }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleEnviar}
                                    disabled={!telefonoValido || enviando}
                                    className="bg-accentBase hover:bg-emphasis text-white font-medium rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <LuUserPlus className="text-lg" />
                                    {enviando ? 'Enviando…' : 'Enviar solicitud'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 ml-1">
                                Selecciona el código de país e ingresa el número completo de tu amigo. Si está
                                registrado con ese teléfono, recibirá tu solicitud de amistad.
                            </p>
                        </div>

                        {/* Solicitudes recibidas */}
                        {recibidas.length > 0 && (
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <h3 className="text-gray-700 font-medium">Solicitudes pendientes</h3>
                                    <span className="bg-accentBase text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[24px] text-center">
                                        {recibidas.length}
                                    </span>
                                </div>
                                <ul className="space-y-3">
                                    {recibidas.map((s) => (
                                        <li
                                            key={s.id}
                                            className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <UserAvatar
                                                    nombre={s.solicitante?.fullName || '?'}
                                                    image={s.solicitante?.image}
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-800 truncate">
                                                        {s.solicitante?.fullName}
                                                    </p>
                                                    <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                                                        <LuPhone className="text-xs" />
                                                        {s.solicitante?.telefono || s.solicitante?.email || ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 sm:justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRechazar(s)}
                                                    className="border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-1"
                                                >
                                                    <IoMdClose /> Rechazar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAceptar(s)}
                                                    className="bg-accentBase hover:bg-emphasis text-white rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-1"
                                                >
                                                    <IoMdCheckmark /> Aceptar
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Lista amigos + enviadas */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <h3 className="text-gray-700">Aquí puedes ver tus amigos.</h3>
                                <span className="bg-accentBase text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[24px] text-center">
                                    {amigos.length}
                                </span>
                            </div>

                            {enviadas.length === 0 && amigos.length === 0 ? (
                                <p className="text-gray-500 text-sm py-6 text-center">
                                    Aún no tienes amigos. Ingresa el teléfono de alguien para enviar tu primera solicitud.
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {enviadas.map((s) => (
                                        <li
                                            key={`enviada-${s.id}`}
                                            className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <UserAvatar
                                                    nombre={s.destinatario?.fullName || '?'}
                                                    image={s.destinatario?.image}
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-800 truncate">
                                                        {s.destinatario?.fullName}
                                                    </p>
                                                    <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                                                        <LuPhone className="text-xs" />
                                                        {s.destinatario?.telefono || s.destinatario?.email || ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 sm:justify-end flex-wrap">
                                                <span className="bg-amber-100 text-amber-700 text-xs font-medium rounded-full px-3 py-1">
                                                    Pendiente de aceptar
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancelar(s)}
                                                    className="border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg px-3 py-2 text-sm font-medium"
                                                >
                                                    Cancelar solicitud
                                                </button>
                                            </div>
                                        </li>
                                    ))}

                                    {amigos.map((a) => (
                                        <li
                                            key={`amigo-${a.friendshipId}`}
                                            className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <UserAvatar
                                                    nombre={a.amigo.fullName}
                                                    image={a.amigo.image}
                                                />
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-800 truncate">
                                                        {a.amigo.fullName}
                                                    </p>
                                                    <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                                                        <LuPhone className="text-xs" />
                                                        {a.amigo.telefono || a.amigo.email || ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex sm:justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEliminarAmigo(a)}
                                                    className="border border-gray-300 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-1"
                                                >
                                                    <LuTrash2 /> Quitar
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default MisAmigosPage;
