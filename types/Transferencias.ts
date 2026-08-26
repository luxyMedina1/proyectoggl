import type { UserMini } from './Amigos';

export type TipoBoletoTransfer = 'asiento' | 'pase';

export type EstadoTransferencia =
    | 'pendiente'
    | 'completada'
    | 'rechazada'
    | 'cancelada'
    | 'revertida';

export type AccionTransferencia = 'aceptar' | 'rechazar' | 'cancelar';

export interface TransferenciaPendienteInfo {
    id: number;
    createdAt: string;
    toUser: UserMini | null;
}

export interface TicketTransfer {
    id: number;
    tipo: TipoBoletoTransfer;
    estado: EstadoTransferencia;
    createdAt: string;
    respondedAt: string | null;
    eventoAsiento: { id: number } | null;
    paseGeneral: { id: number } | null;
    fromUser?: UserMini;
    toUser?: UserMini;
    evento: { id: number; nombre?: string } | null;
    funcion: { id: number; nombre?: string; fecha?: string } | null;
}

export interface MiBoletoAsiento {
    id: number;
    estado: string;
    quemadoUUID: string;
    quemadoFlag: boolean;
    evento: {
        id: number;
        nombre?: string;
        imagenBoleto?: string;
        imagenPromocion?: string;
        fecha?: string;
    } | null;
    funcion: { id: number; nombre?: string; fecha?: string } | null;
    asiento?: {
        numero?: string | number;
        fila?: {
            nombre?: string;
            seccion?: {
                nombre?: string;
                bloque?: { nombre?: string };
            };
        };
    };
    categoria?: { nombre?: string };
    ticket: { id: number };
    propietarioActual: { id: string } | null;
    transferenciaPendiente: TransferenciaPendienteInfo | null;
}

export interface MiBoletoPase {
    id: number;
    quemadoUUID: string;
    quemadoFlag: boolean;
    evento: {
        id: number;
        nombre?: string;
        imagenBoleto?: string;
        imagenPromocion?: string;
        fecha?: string;
    } | null;
    funcion: { id: number; nombre?: string; fecha?: string } | null;
    ticket: { id: number };
    propietarioActual: { id: string } | null;
    transferenciaPendiente: TransferenciaPendienteInfo | null;
}

export interface MisBoletosResponse {
    asientos: MiBoletoAsiento[];
    pases: MiBoletoPase[];
}

export interface TransferirBoletoPayload {
    tipo: TipoBoletoTransfer;
    boletoId: number;
    destinatarioId: string;
}

export interface DevolverBoletoPayload {
    tipo: TipoBoletoTransfer;
    boletoId: number;
}
