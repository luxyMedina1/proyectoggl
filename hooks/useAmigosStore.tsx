import apiApplication from '../api/apiApplication';
import type {
    AccionSolicitud,
    AceptarSolicitudResponse,
    Amigo,
    FriendRequest,
} from '../types/Amigos';

const extractMessage = (error: unknown, fallback: string): string => {
    const err = error as { response?: { data?: { message?: string | string[] } } };
    const raw = err?.response?.data?.message;
    if (Array.isArray(raw)) return raw.join('\n');
    return raw || fallback;
};

export const useAmigosStore = () => {
    // El destinatario se identifica por teléfono (match exacto contra el del registro).
    // Debe enviarse en formato E.164: con código de país y `+`, sin espacios/guiones/paréntesis.
    const enviarSolicitud = async (telefono: string): Promise<FriendRequest> => {
        try {
            const { data } = await apiApplication.post<FriendRequest>(
                '/amigos/solicitudes',
                { telefono: telefono.trim() },
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al enviar la solicitud'));
        }
    };

    const getSolicitudesRecibidas = async (): Promise<FriendRequest[]> => {
        try {
            const { data } = await apiApplication.get<FriendRequest[]>(
                '/amigos/solicitudes/recibidas',
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener solicitudes recibidas'));
        }
    };

    const getSolicitudesEnviadas = async (): Promise<FriendRequest[]> => {
        try {
            const { data } = await apiApplication.get<FriendRequest[]>(
                '/amigos/solicitudes/enviadas',
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener solicitudes enviadas'));
        }
    };

    const responderSolicitud = async (
        id: number,
        accion: AccionSolicitud,
    ): Promise<AceptarSolicitudResponse | { solicitud: FriendRequest }> => {
        try {
            const { data } = await apiApplication.patch(
                `/amigos/solicitudes/${id}`,
                { accion },
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al responder la solicitud'));
        }
    };

    const getAmigos = async (): Promise<Amigo[]> => {
        try {
            const { data } = await apiApplication.get<Amigo[]>('/amigos');
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener la lista de amigos'));
        }
    };

    const eliminarAmistad = async (friendshipId: number): Promise<{ ok: boolean }> => {
        try {
            const { data } = await apiApplication.delete<{ ok: boolean }>(
                `/amigos/${friendshipId}`,
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al eliminar la amistad'));
        }
    };

    return {
        enviarSolicitud,
        getSolicitudesRecibidas,
        getSolicitudesEnviadas,
        responderSolicitud,
        getAmigos,
        eliminarAmistad,
    };
};
