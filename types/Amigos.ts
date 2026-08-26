export type EstadoSolicitudAmistad =
    | 'pendiente'
    | 'aceptada'
    | 'rechazada'
    | 'cancelada';

export type AccionSolicitud = 'aceptar' | 'rechazar' | 'cancelar';

export interface UserMini {
    id: string;
    fullName: string;
    email: string | null;
    telefono: string | null;
    image: string | null;
}

export interface FriendRequest {
    id: number;
    estado: EstadoSolicitudAmistad;
    createdAt: string;
    respondedAt: string | null;
    solicitante?: UserMini;
    destinatario?: UserMini;
}

export interface Amigo {
    friendshipId: number;
    desde: string;
    amigo: UserMini;
}

export interface AceptarSolicitudResponse {
    solicitud: FriendRequest;
    friendship: {
        id: number;
        createdAt: string;
        deletedAt: string | null;
    };
}
