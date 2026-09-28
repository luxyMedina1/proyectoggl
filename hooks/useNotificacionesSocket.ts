import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import apiApplication from '../api/apiApplication';
import { authStorage } from '../utils/authStorage';
import { emitNotifRefresh } from '../utils/notifEvents';
import {
    Notificacion,
    NotificacionesPerdidas,
    guardarUltimoId,
    leerUltimoId,
    planPerdidas,
    rutaPorTipo,
} from '../utils/notificaciones';
import { useAuthStore } from './useAuthStore';

const TOAST_SIN_CONEXION = 'notif-sin-conexion';
// Evita el aviso de "sin conexión" en cortes de un par de segundos que socket.io
// recupera solo.
const ESPERA_AVISO_SIN_CONEXION_MS = 3000;

const socketUrl = () => {
    const base = process.env.NEXT_PUBLIC_URL_BACKEND || window.location.origin;
    return `${base.replace(/\/$/, '')}/notificaciones`;
};

/**
 * Notificaciones en vivo del usuario autenticado (transferencias, amistades,
 * boleto validado, comandas). Al reconectar tras perder internet, el backend
 * reenvía lo ocurrido mientras tanto usando el `ultimoId` guardado.
 *
 * El badge del header sigue siendo el de HeaderLayout: aquí solo se dispara
 * `emitNotifRefresh()` para que se actualice al instante.
 */
export const useNotificacionesSocket = () => {
    const { user, status } = useAuthStore();
    const router = useRouter();
    const email = status === 'authenticated' ? user?.email : undefined;

    useEffect(() => {
        if (!email) return;

        let ultimoId = leerUltimoId(email);
        let cursorEnHandshake: number | undefined;
        // Tras el primer lote ya sabemos qué había: lo que llegue en lotes
        // siguientes es de un corte, aunque el usuario no tuviera cursor (cuenta
        // sin notificaciones previas).
        let yaSincronizo = false;
        let perdioConexion = false;
        let timerSinConexion: number | undefined;
        const vistos = new Set<number>();

        const socket = io(socketUrl(), {
            transports: ['websocket'],
            // Función: socket.io la re-evalúa en cada reconexión, así viaja el
            // token refrescado y el último id recibido.
            auth: (cb) => {
                cursorEnHandshake = ultimoId;
                cb({ token: authStorage.get('token'), ultimoId });
            },
        });

        const avanzarCursor = (id: number) => {
            if (!ultimoId || id > ultimoId) {
                ultimoId = id;
                guardarUltimoId(email, id);
            }
        };

        const abrir = (n: Notificacion) => {
            apiApplication
                .patch('/notificaciones/leidas', { ids: [n.id] })
                .then(() => emitNotifRefresh())
                .catch(() => undefined);
            const ruta = rutaPorTipo(n.tipo);
            if (ruta) router.push(ruta);
        };

        const mostrar = (n: Notificacion) => {
            toast.info(`${n.titulo}: ${n.cuerpo}`, {
                toastId: `notif-${n.id}`,
                onClick: () => abrir(n),
            });
        };

        const registrar = (n: Notificacion) => {
            if (vistos.has(n.id)) return false;
            vistos.add(n.id);
            avanzarCursor(n.id);
            return true;
        };

        socket.on('notificacion', (n: Notificacion) => {
            if (!registrar(n)) return;
            mostrar(n);
            emitNotifRefresh();
        });

        socket.on('notificaciones_perdidas', (lote: NotificacionesPerdidas) => {
            window.clearTimeout(timerSinConexion);
            if (perdioConexion) {
                perdioConexion = false;
                toast.dismiss(TOAST_SIN_CONEXION);
                toast.success('Conexión restablecida', { autoClose: 2000 });
            }

            const nuevas = lote.notificaciones.filter(registrar);
            const { individuales, resumen } = planPerdidas(
                { ...lote, notificaciones: nuevas },
                cursorEnHandshake !== undefined || yaSincronizo,
            );
            yaSincronizo = true;
            individuales.forEach(mostrar);
            if (resumen) toast.info(resumen, { toastId: 'notif-resumen' });

            // Con cursor ya avanzado, el siguiente lote llega con toasts normales.
            cursorEnHandshake = ultimoId;
            if (lote.hayMas) socket.emit('sincronizar', { ultimoId });
            emitNotifRefresh();
        });

        socket.on('disconnect', (reason) => {
            // El backend corta la conexión cuando el token es inválido o venció:
            // una llamada autenticada dispara el refresh del interceptor de axios
            // y luego se reconecta con el token nuevo.
            if (reason === 'io server disconnect') {
                apiApplication
                    .get('/notificaciones/no-leidas')
                    .then(() => socket.connect())
                    .catch(() => undefined);
                return;
            }
            if (reason === 'io client disconnect') return;

            perdioConexion = true;
            window.clearTimeout(timerSinConexion);
            timerSinConexion = window.setTimeout(() => {
                if (socket.connected) return;
                toast.warn('Sin conexión. Te avisaremos de lo que pase mientras tanto.', {
                    toastId: TOAST_SIN_CONEXION,
                    autoClose: false,
                });
            }, ESPERA_AVISO_SIN_CONEXION_MS);
        });

        const alVolverInternet = () => {
            if (!socket.connected) socket.connect();
        };
        window.addEventListener('online', alVolverInternet);

        return () => {
            window.removeEventListener('online', alVolverInternet);
            window.clearTimeout(timerSinConexion);
            toast.dismiss(TOAST_SIN_CONEXION);
            socket.disconnect();
        };
    }, [email, router]);
};
