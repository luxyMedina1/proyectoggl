import apiApplication from '../api/apiApplication';
import type {
    AccionTransferencia,
    DevolverBoletoPayload,
    MisBoletosResponse,
    TicketTransfer,
    TipoBoletoTransfer,
    TransferirBoletoPayload,
} from '../types/Transferencias';

const extractMessage = (error: unknown, fallback: string): string => {
    const err = error as { response?: { data?: { message?: string | string[] } } };
    const raw = err?.response?.data?.message;
    if (Array.isArray(raw)) return raw.join('\n');
    return raw || fallback;
};

export const useTransferenciasStore = () => {
    const transferirBoleto = async (
        payload: TransferirBoletoPayload,
    ): Promise<TicketTransfer> => {
        try {
            const { data } = await apiApplication.post<TicketTransfer>(
                '/transferencias',
                payload,
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al transferir el boleto'));
        }
    };

    const devolverBoleto = async (
        payload: DevolverBoletoPayload,
    ): Promise<TicketTransfer> => {
        try {
            const { data } = await apiApplication.post<TicketTransfer>(
                '/transferencias/devolver',
                payload,
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al devolver el boleto'));
        }
    };

    const responderTransferencia = async (
        id: number,
        accion: AccionTransferencia,
    ): Promise<TicketTransfer> => {
        try {
            const { data } = await apiApplication.patch<TicketTransfer>(
                `/transferencias/${id}`,
                { accion },
            );
            return data;
        } catch (error) {
            const fallback =
                accion === 'aceptar'
                    ? 'Error al aceptar la transferencia'
                    : accion === 'rechazar'
                        ? 'Error al rechazar la transferencia'
                        : 'Error al cancelar la transferencia';
            throw new Error(extractMessage(error, fallback));
        }
    };

    const getPendientesRecibidas = async (): Promise<TicketTransfer[]> => {
        try {
            const { data } = await apiApplication.get<TicketTransfer[]>(
                '/transferencias/pendientes/recibidas',
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener transferencias pendientes'));
        }
    };

    const getPendientesEnviadas = async (): Promise<TicketTransfer[]> => {
        try {
            const { data } = await apiApplication.get<TicketTransfer[]>(
                '/transferencias/pendientes/enviadas',
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener transferencias pendientes'));
        }
    };

    const getTransferenciasEnviadas = async (
        page = 1,
        limit = 50,
    ): Promise<TicketTransfer[]> => {
        try {
            const { data } = await apiApplication.get<TicketTransfer[]>(
                '/transferencias/enviadas',
                { params: { page, limit } },
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener transferencias enviadas'));
        }
    };

    const getTransferenciasRecibidas = async (
        page = 1,
        limit = 50,
    ): Promise<TicketTransfer[]> => {
        try {
            const { data } = await apiApplication.get<TicketTransfer[]>(
                '/transferencias/recibidas',
                { params: { page, limit } },
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener transferencias recibidas'));
        }
    };

    const getHistorialBoleto = async (
        tipo: TipoBoletoTransfer,
        boletoId: number,
    ): Promise<TicketTransfer[]> => {
        try {
            const { data } = await apiApplication.get<TicketTransfer[]>(
                `/transferencias/boleto/${tipo}/${boletoId}`,
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener el historial del boleto'));
        }
    };

    const getMisBoletos = async (): Promise<MisBoletosResponse> => {
        try {
            const { data } = await apiApplication.get<MisBoletosResponse>('/boletos/mis');
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al obtener tus boletos'));
        }
    };

    return {
        transferirBoleto,
        devolverBoleto,
        responderTransferencia,
        getPendientesRecibidas,
        getPendientesEnviadas,
        getTransferenciasEnviadas,
        getTransferenciasRecibidas,
        getHistorialBoleto,
        getMisBoletos,
    };
};
