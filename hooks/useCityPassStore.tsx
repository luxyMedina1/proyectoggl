import apiApplication from '../api/apiApplication';
import type {
    CheckCargoCityPassResponse,
    CityPassCompraDetalle,
    CityPassCompraResumen,
    CityPassGrupoBoletos,
    CityPassLanding,
    CityPassPaqueteDetalle,
    CityPassTransferencia,
    MakeCargoCityPassBody,
    MakeCargoCityPassResponse,
} from '../types/CityPass';

const extractMessage = (error: unknown, fallback: string): string => {
    const err = error as { response?: { data?: { message?: string | string[] } } };
    const raw = err?.response?.data?.message;
    if (Array.isArray(raw)) return raw.join('\n');
    return raw || fallback;
};

const esNotFound = (error: unknown): boolean =>
    (error as { response?: { status?: number } })?.response?.status === 404;

export const useCityPassStore = () => {
    // Landing público de una ciudad. Devuelve null si la ciudad no existe (404).
    const getLanding = async (ciudadId: number): Promise<CityPassLanding | null> => {
        try {
            const { data } = await apiApplication.get<CityPassLanding>(
                `/citypass/publico/landing?ciudadId=${ciudadId}`,
            );
            return data;
        } catch (error) {
            if (esNotFound(error)) return null;
            throw new Error(extractMessage(error, 'Error al cargar el CityPass'));
        }
    };

    // Detalle de un paquete (pantalla de compra). Devuelve null si no existe (404).
    const getPaquete = async (id: number): Promise<CityPassPaqueteDetalle | null> => {
        try {
            const { data } = await apiApplication.get<CityPassPaqueteDetalle>(
                `/citypass/publico/paquete/${id}`,
            );
            return data;
        } catch (error) {
            if (esNotFound(error)) return null;
            throw new Error(extractMessage(error, 'Error al cargar el paquete'));
        }
    };

    // Crea el cargo Openpay (3DS). Devuelve { cargo, compraId }; usa cargo.payment_method.url para el 3D-Secure.
    const makeCargo = async (
        body: MakeCargoCityPassBody,
    ): Promise<MakeCargoCityPassResponse> => {
        try {
            const { data } = await apiApplication.post<MakeCargoCityPassResponse>(
                '/pagos/citypass/make/cargo',
                body,
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'No se pudo procesar el pago'));
        }
    };

    // Verifica el cargo y emite los boletos. transaccionId = cargo.id.
    const checkCargo = async (
        transaccionId: string,
    ): Promise<CheckCargoCityPassResponse> => {
        try {
            const { data } = await apiApplication.post<CheckCargoCityPassResponse>(
                `/pagos/citypass/check/cargo/${transaccionId}`,
            );
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'No se pudo confirmar el pago'));
        }
    };

    // Compras de CityPass del usuario (una por compra, con el paquete embebido).
    const getMisCompras = async (): Promise<CityPassCompraResumen[]> => {
        try {
            const { data } = await apiApplication.get<CityPassCompraResumen[]>(
                '/citypass/publico/mis-compras',
            );
            return Array.isArray(data) ? data : [];
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al cargar tus CityPass'));
        }
    };

    // Pases que el usuario posee ahora, agrupados por paquete (todos los pases del paquete).
    const getMisBoletos = async (): Promise<CityPassGrupoBoletos[]> => {
        try {
            const { data } = await apiApplication.get<CityPassGrupoBoletos[]>(
                '/citypass/publico/mis-boletos',
            );
            return Array.isArray(data) ? data : [];
        } catch (error) {
            throw new Error(extractMessage(error, 'Error al cargar tus pases'));
        }
    };

    // Detalle de una compra: boletos con accesos, vigencia y QR.
    const getDetalleCompra = async (id: number): Promise<CityPassCompraDetalle | null> => {
        try {
            const { data } = await apiApplication.get<CityPassCompraDetalle>(
                `/citypass/publico/mis-compras/${id}`,
            );
            return data;
        } catch (error) {
            if (esNotFound(error)) return null;
            throw new Error(extractMessage(error, 'Error al cargar el detalle'));
        }
    };

    // Transferir un boleto a un amigo (queda pendiente hasta que lo acepte).
    const transferirBoleto = async (boletoId: number, destinatarioId: string) => {
        try {
            const { data } = await apiApplication.post('/citypass/transferencias', {
                boletoId,
                destinatarioId,
            });
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'No se pudo transferir el boleto'));
        }
    };

    // Normaliza la respuesta de un listado de transferencias (array o { items|data }).
    const listaTransferencias = async (
        ruta: string,
        fallback: string,
    ): Promise<CityPassTransferencia[]> => {
        try {
            const { data } = await apiApplication.get(ruta);
            if (Array.isArray(data)) return data;
            return data?.items ?? data?.data ?? [];
        } catch (error) {
            throw new Error(extractMessage(error, fallback));
        }
    };

    // Transferencias que inició el usuario (para la pestaña "Pases transferidos").
    const getTransferenciasEnviadas = (): Promise<CityPassTransferencia[]> =>
        listaTransferencias('/citypass/transferencias/enviadas', 'Error al cargar transferencias');

    // Transferencias dirigidas al usuario (historial de recibidas).
    const getTransferenciasRecibidas = (): Promise<CityPassTransferencia[]> =>
        listaTransferencias('/citypass/transferencias/recibidas', 'Error al cargar transferencias');

    // Pendientes que envié (puedo cancelar).
    const getPendientesEnviadas = (): Promise<CityPassTransferencia[]> =>
        listaTransferencias('/citypass/transferencias/pendientes/enviadas', 'Error al cargar transferencias');

    // Pendientes para mí (puedo aceptar / rechazar).
    const getPendientesRecibidas = (): Promise<CityPassTransferencia[]> =>
        listaTransferencias('/citypass/transferencias/pendientes/recibidas', 'Error al cargar transferencias');

    // Aceptar / rechazar (destinatario) o cancelar (remitente) una transferencia pendiente.
    const responderTransferencia = async (
        id: number,
        accion: 'aceptar' | 'rechazar' | 'cancelar',
    ) => {
        try {
            const { data } = await apiApplication.patch(`/citypass/transferencias/${id}`, { accion });
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'No se pudo actualizar la transferencia'));
        }
    };

    // Devolver un boleto al comprador original (inmediato, sin aceptación).
    const devolverBoleto = async (boletoId: number) => {
        try {
            const { data } = await apiApplication.post('/citypass/transferencias/devolver', { boletoId });
            return data;
        } catch (error) {
            throw new Error(extractMessage(error, 'No se pudo devolver el boleto'));
        }
    };

    return {
        getLanding,
        getPaquete,
        makeCargo,
        checkCargo,
        getMisCompras,
        getMisBoletos,
        getDetalleCompra,
        transferirBoleto,
        getTransferenciasEnviadas,
        getTransferenciasRecibidas,
        getPendientesEnviadas,
        getPendientesRecibidas,
        responderTransferencia,
        devolverBoleto,
    };
};
