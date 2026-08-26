import apiApplication from "../api/apiApplication";
import { idNumericoDeSlug, resolverSlugEnLista, type EventoResuelto } from "../utils/eventoSlug";

export const useEventosStore = () => {

    const getListaEventos = async () => {
        try {
            const { data } = await apiApplication.get('/eventos/get_all_select?tipoDispositivo=web');
            return data;
        } catch (error) {
            throw new Error('Error al obtener la lista de eventos');
        }
    }

    const getFilasSeccion = async (idEvento: string, idSeccion: string, funcionId?: string | null) => {
        try {
            const url = `/eventos/${idEvento}/${idSeccion}/filas_por_seccion${funcionId ? `/${funcionId}` : ''}`;
            const { data } = await apiApplication.get(url);
            return data;
        } catch (error) {
            throw new Error('Error al obtener la lista de eventos');
        }
    }

    // Resuelve el slug de la URL (`tuff-riders`, `sky-fest-laguna-7-matutino`) a los ids
    // que necesitan el resto de los endpoints. La fuente de verdad es el back, que es quien
    // guarda el slug y quien lo usa para armar los QR.
    // TODO(slug): quitar el fallback contra el listado publico cuando GET /eventos/slug/:slug
    // este desplegado (hoy responde 404 porque la ruta no existe todavia).
    const resolverSlugEvento = async (slug: string): Promise<EventoResuelto | null> => {
        // TODO(slug): compatibilidad con los QR ya impresos que apuntan a /eventos/1084.
        const idNumerico = idNumericoDeSlug(slug);
        if (idNumerico) return { eventoId: idNumerico, funcionId: null };

        try {
            const { data } = await apiApplication.get(`/eventos/slug/${encodeURIComponent(slug)}`);
            if (data?.eventoId == null) throw new Error('Respuesta sin eventoId');
            return {
                eventoId: String(data.eventoId),
                funcionId: data.funcionId != null ? String(data.funcionId) : null,
            };
        } catch {
            const response = await getListaEventos();
            return resolverSlugEnLista(slug, response?.eventosFiltrados ?? []);
        }
    };

    const getDetalleEventos = async (id: string) => {
        try {
            const { data } = await apiApplication.get(`/eventos/${id}/detalle`);
            return data;
        } catch (error) {
            throw new Error('Error al obtener la lista de eventos');
        }
    }

    const getDetalleEventoSecciones = async (id: string, funcion?: any) => {
        try {
            const { data } = await apiApplication.get(`/eventos/${id}/detalle_seccion/false/web/${funcion}`);
            return data;
        } catch (error) {
            throw error;
        }
    }

    const getDetalleAbono = async (id: string) => {
        try {
            const { data } = await apiApplication.get(`/abonos/${id}`);
            return data;
        } catch (error) {
            throw new Error('Error al obtener la lista de abonos');
        }
    }

    const reservarAbono = async (abonoId: string, payload: any) =>{
        try {
            const { data } = await apiApplication.post(`/abonos/${abonoId}/reservar`, payload);
            return data;
        } catch (error: any) {
            if (error?.response?.data?.noDisponibles || error?.response?.data?.completo === false) {
                return error.response.data;
            }
            const mensaje = error?.response?.data?.message || 'Error al reservar el evento';
            throw new Error(mensaje);
        }
    }

    const comprarAbono = async (payload: any) =>{
        try {
                const { data } = await apiApplication.post(`/pagos/make/cargo_abono`, payload);
                return data;
            } catch (error) {
                throw new Error('Error al procesar el abono');
            }
    }

    const checkCargoAbono = async (transaccionId: string) => {
        try {
            const { data } = await apiApplication.post(`/pagos/check/cargo_abono/${transaccionId}`);
            return data;
        } catch (error) {
            throw new Error('Error al verificar el cargo del abono');
        }
    }

    const reservar = async (email:string, asientos: number[], eventoId: string, funcionId?: string) =>{
        try {
            const { data } = await apiApplication.post(`/eventos/${eventoId}/reservar`,
                {
                    userEmail:email,
                    asientosReserva:asientos,
                    funcion: funcionId
                }
            );
            return data;
        } catch (error: any) {
            const mensaje = error?.response?.data?.message || 'Error al reservar el evento';
            throw new Error(mensaje);
        }
    }

    const reservarInvitado = async (asientos: number[], eventoId: string, nombre: string, correo: string, funcion?: string | null) =>{
        try {
                const { data } = await apiApplication.post(`/eventos/${eventoId}/reservarInvitado`, {asientosReserva:asientos, nombre, correo, funcion} );
                return data;
            } catch (error: any) {
                throw new Error(error?.response?.data?.message || 'Error al reservar el evento');
            }
    }

    const reservarGeneral = async (asientos: number, eventoId:string, seccionId: number) =>{
        try {
                const { data } = await apiApplication.post(`/eventos/${eventoId}/reservar_generales`, { cantidadAsientos:asientos , seccionId:seccionId } );
                return data;
            } catch (error: any) {
                throw new Error(error?.response?.data?.message || 'Error al reservar el evento');
            }
    }

    const cancelar = async (reservaId: string, eventoId: string, esGeneral = false) =>{
        try {
                const { data } = await apiApplication.post(`/eventos/${eventoId}/cancelar`, {reservaId, esGeneral});
                return data;
            } catch (error) {
                throw new Error('Error al reservar el evento');
            }
    }

    const comprar = async (reservaId: string, eventoId: string, metodoPago: string) =>{
        try {
                const { data } = await apiApplication.post(`/eventos/${eventoId}/vender`, {reservaId, metodoPago});
                return data;
            } catch (error) {
                throw new Error('Error al reservar el evento');
            }
    }

    const getMisEventos = async () => {
        try {
            const { data } = await apiApplication.get('/eventos/mis_eventos');
            return data;
        } catch (error) {
            throw new Error('Error al obtener la lista de eventos');
        }
    }

    const getMisBoletos = async (id: number, funcionId?: number | null) => {
        try {
            const { data } = await apiApplication.get(`/eventos/mis_eventos/${id}`, {
                params: funcionId != null ? { funcionId } : undefined,
            });
            return data;
        } catch (error) {
            throw new Error('Error al obtener la lista de boletos');
        }
    }


    const getAbonoBuilderState = () => {
        const state = localStorage.getItem('abonoBuilder');
        return state ? JSON.parse(state) : null;
    }

    const setAbonoBuilderState = (state: any) => {
        localStorage.setItem('abonoBuilder', JSON.stringify(state));
    }

    const clearAbonoBuilderState = () => {
        localStorage.removeItem('abonoBuilder');
    }

    return {
        getListaEventos,
        resolverSlugEvento,
        getDetalleEventos,
        getDetalleEventoSecciones,
        getFilasSeccion,
        reservar,
        reservarInvitado,
        reservarGeneral,
        cancelar,
        comprar,
        getMisEventos,
        getMisBoletos,
        getDetalleAbono,
        reservarAbono,
        comprarAbono,
        checkCargoAbono,
        getAbonoBuilderState,
        setAbonoBuilderState,
        clearAbonoBuilderState
    }
}
