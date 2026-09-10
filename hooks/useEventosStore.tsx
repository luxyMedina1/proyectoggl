import type { AxiosRequestConfig } from "axios";
import apiApplication from "../api/apiApplication";
import { idNumericoDeSlug, resolverSlugEnLista, type EventoResuelto } from "../utils/eventoSlug";
import { cuerpoDeErrorApi, mensajeDeErrorApi } from "../utils/apiError";
import type { CargoAbonoBody, ReservarAbonoBody } from "../types/Abono";

// Config que fuerza frescura en las peticiones de DISPONIBILIDAD de asientos (Req 26.3).
// `cache: "no-store"` es la instrucción explícita del diseño (respetada por el adaptador
// fetch de axios); las cabeceras `Cache-Control`/`Pragma` la refuerzan para el adaptador
// XHR y cualquier caché intermedia. Un mapa de asientos servido de caché vendería el mismo
// asiento dos veces, así que este payload NUNCA debe servirse de una respuesta cacheada.
export const SIN_CACHE_DISPONIBILIDAD: AxiosRequestConfig & { cache: "no-store" } = {
    cache: "no-store",
    headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
    },
};

export const useEventosStore = () => {

    const getListaEventos = async () => {
        try {
            const { data } = await apiApplication.get('/eventos/get_all_select?tipoDispositivo=web');
            return data;
        } catch {
            throw new Error('Error al obtener la lista de eventos');
        }
    }

    const getFilasSeccion = async (idEvento: string, idSeccion: string, funcionId?: string | null) => {
        try {
            const url = `/eventos/${idEvento}/${idSeccion}/filas_por_seccion${funcionId ? `/${funcionId}` : ''}`;
            const { data } = await apiApplication.get(url);
            return data;
        } catch {
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

    // `config` permite forzar `cache: "no-store"` cuando este payload se usa como fuente de
    // disponibilidad de asientos (Req 26.3). Ver SIN_CACHE_DISPONIBILIDAD.
    const getDetalleEventos = async (id: string, config?: AxiosRequestConfig) => {
        try {
            const { data } = await apiApplication.get(`/eventos/${id}/detalle`, config);
            return data;
        } catch {
            throw new Error('Error al obtener la lista de eventos');
        }
    }

    // El detalle por sección trae `secciones[].asientosDisponibles`: es la disponibilidad de
    // asientos que ve el comprador. Debe pedirse siempre fresca (Req 26.3), de ahí el `config`
    // con SIN_CACHE_DISPONIBILIDAD que le pasa la vista al montar.
    const getDetalleEventoSecciones = async (
        id: string,
        funcion?: string | number | null,
        config?: AxiosRequestConfig,
    ) => {
        try {
            const { data } = await apiApplication.get(`/eventos/${id}/detalle_seccion/false/web/${funcion}`, config);
            return data;
        } catch (error) {
            throw error;
        }
    }

    const getDetalleAbono = async (id: string) => {
        try {
            const { data } = await apiApplication.get(`/abonos/${id}`);
            return data;
        } catch {
            throw new Error('Error al obtener la lista de abonos');
        }
    }

    const reservarAbono = async (abonoId: string, payload: ReservarAbonoBody) =>{
        try {
            const { data } = await apiApplication.post(`/abonos/${abonoId}/reservar`, payload);
            return data;
        } catch (error) {
            const cuerpo = cuerpoDeErrorApi(error);
            if (cuerpo?.noDisponibles || cuerpo?.completo === false) {
                return cuerpo;
            }
            throw new Error(mensajeDeErrorApi(error, 'Error al reservar el evento'));
        }
    }

    const comprarAbono = async (payload: CargoAbonoBody) =>{
        try {
                const { data } = await apiApplication.post(`/pagos/make/cargo_abono`, payload);
                return data;
            } catch {
                throw new Error('Error al procesar el abono');
            }
    }

    const checkCargoAbono = async (transaccionId: string) => {
        try {
            const { data } = await apiApplication.post(`/pagos/check/cargo_abono/${transaccionId}`);
            return data;
        } catch {
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
        } catch (error) {
            throw new Error(mensajeDeErrorApi(error, 'Error al reservar el evento'));
        }
    }

    const reservarInvitado = async (asientos: number[], eventoId: string, nombre: string, correo: string, funcion?: string | null) =>{
        try {
                const { data } = await apiApplication.post(`/eventos/${eventoId}/reservarInvitado`, {asientosReserva:asientos, nombre, correo, funcion} );
                return data;
            } catch (error) {
                throw new Error(mensajeDeErrorApi(error, 'Error al reservar el evento'));
            }
    }

    const reservarGeneral = async (asientos: number, eventoId:string, seccionId: number) =>{
        try {
                const { data } = await apiApplication.post(`/eventos/${eventoId}/reservar_generales`, { cantidadAsientos:asientos , seccionId:seccionId } );
                return data;
            } catch (error) {
                throw new Error(mensajeDeErrorApi(error, 'Error al reservar el evento'));
            }
    }

    const cancelar = async (reservaId: string, eventoId: string, esGeneral = false) =>{
        try {
                const { data } = await apiApplication.post(`/eventos/${eventoId}/cancelar`, {reservaId, esGeneral});
                return data;
            } catch {
                throw new Error('Error al reservar el evento');
            }
    }

    const comprar = async (reservaId: string, eventoId: string, metodoPago: string) =>{
        try {
                const { data } = await apiApplication.post(`/eventos/${eventoId}/vender`, {reservaId, metodoPago});
                return data;
            } catch {
                throw new Error('Error al reservar el evento');
            }
    }

    const getMisEventos = async () => {
        try {
            const { data } = await apiApplication.get('/eventos/mis_eventos');
            return data;
        } catch {
            throw new Error('Error al obtener la lista de eventos');
        }
    }

    const getMisBoletos = async (id: number, funcionId?: number | null) => {
        try {
            const { data } = await apiApplication.get(`/eventos/mis_eventos/${id}`, {
                params: funcionId != null ? { funcionId } : undefined,
            });
            return data;
        } catch {
            throw new Error('Error al obtener la lista de boletos');
        }
    }


    const getAbonoBuilderState = () => {
        const state = localStorage.getItem('abonoBuilder');
        return state ? JSON.parse(state) : null;
    }

    const setAbonoBuilderState = (state: unknown) => {
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
