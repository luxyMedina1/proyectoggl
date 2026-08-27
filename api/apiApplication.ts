import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { authStorage } from '../utils/authStorage';
import { datosAtribucion, normalizarPixelIds, rastrear, yaSeEmitio } from '../utils/metaPixel';

const getBackendUrl = () => {
    let uri = '';
    const url = process.env.NEXT_PUBLIC_URL_BACKEND;
    if (!url) {
        console.warn('Backend URL not set in .env. Using default.')
        uri = '/api/v1'//poner segun el context path de la aplicacion en produccion
    } else {
        uri = url+'/api/v1'
    }
    return uri
}

const apiApplication = axios.create({
    baseURL: getBackendUrl()
})

const SKIP_REFRESH_URLS = [
    '/auth/refresh-token',
    '/auth/otp/send',
    '/auth/otp/resend',
    '/auth/otp/validate',
    '/auth/login',
    '/auth/register',
    '/auth/google',
    '/auth/apple/verify',
];

const shouldSkipRefresh = (url?: string) => {
    if (!url) return true;
    return SKIP_REFRESH_URLS.some((u) => url.includes(u));
};

// --- Meta Pixel / Conversions API --------------------------------------------------------
//
// Rutas donde el backend necesita la atribucion de Meta para su llamada server-side: el
// `event_id` que comparte con el navegador (sin el, Meta cuenta la conversion dos veces) y
// las cookies _fbp/_fbc. Se inyecta aqui y no en cada componente para que no se escape
// ningun flujo — eventos, abonos, conferencias y citypass pasan todos por esta instancia.
//
// OJO: el backend tiene que aceptar el campo `meta` ANTES de que esto salga a produccion.
// Si su ValidationPipe corre con forbidNonWhitelisted, rechazaria el pago con 400.
const RUTAS_ATRIBUCION_META: RegExp[] = [
    /\/reservar(_generales|Invitado)?(\/|\?|$)/,     // eventos y abonos
    /\/pagos\/(citypass\/)?(make|check)\//,           // cargos: normales, abono, conferencia, citypass
    /\/eventos\/[^/]+\/gratis/,                       // boletos sin costo
];

const esCuerpoAmpliable = (valor: unknown): valor is Record<string, unknown> => {
    if (valor === undefined || valor === null) return true;
    if (typeof valor !== 'object' || Array.isArray(valor)) return false;
    // FormData (alta de conferencias) y binarios se mandan tal cual.
    return !(valor instanceof FormData) && !(valor instanceof Blob) && !(valor instanceof ArrayBuffer)
        && !(typeof URLSearchParams !== 'undefined' && valor instanceof URLSearchParams);
};

const necesitaAtribucion = (config: { method?: string; url?: string }) =>
    (config.method ?? 'get').toLowerCase() === 'post'
    && RUTAS_ATRIBUCION_META.some((ruta) => ruta.test(config.url ?? ''));

apiApplication.interceptors.request.use((config) => {
    const token = authStorage.get('token');
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    const isRefresh = config.url?.includes('/auth/refresh-token');
    if (token && !isRefresh) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (apiKey) {
        config.headers['x-api-key'] = apiKey;
    }
    if (necesitaAtribucion(config) && esCuerpoAmpliable(config.data)) {
        // Copia, no mutacion: el payload original vive en el estado del componente.
        config.data = { ...(config.data ?? {}), meta: datosAtribucion() };
    }
    return config;
})

interface RetriableConfig extends AxiosRequestConfig {
    _retry?: boolean;
}

let refreshInFlight: Promise<string> | null = null;

const performRefresh = async (): Promise<string> => {
    const resetToken = authStorage.get('resetToken');
    if (!resetToken) throw new Error('No reset token');
    const persist = authStorage.isPersistent();
    const { data } = await apiApplication.post('/auth/refresh-token', { resetToken });
    if (!data?.token) throw new Error('Refresh failed');
    authStorage.set('token', data.token, persist);
    if (data.refreshToken) authStorage.set('resetToken', data.refreshToken, persist);
    return data.token;
};

/**
 * El backend decide QUE evento se manda y con que monto; el navegador solo lo replica.
 * Asi el `value` del lado navegador no puede diferir del que la Conversions API ya reporto,
 * y la pagina de confirmacion no tiene que adivinar si el cargo realmente quedo pagado.
 *
 * Contrato (mismo objeto en la respuesta de reservar / check-cargo):
 *   meta: { emitir: true, evento: "Purchase", eventId: "<uuid>", pixelIds: ["123"], datos: {...} }
 *
 * `emitir: false` (o ausente) = no dispares nada: o no se pago, o ya se habia contado.
 */
interface EventoMetaDeRespuesta {
    emitir?: boolean;
    evento?: string;
    eventId?: string;
    pixelIds?: unknown;
    datos?: Record<string, unknown>;
}

const emitirEventosDeRespuesta = (data: unknown) => {
    try {
        const meta = (data as { meta?: EventoMetaDeRespuesta } | null | undefined)?.meta;
        if (!meta || typeof meta !== 'object') return;

        if (meta.emitir !== true) {
            return;
        }
        if (!meta.evento || !meta.eventId) return;
        // El usuario puede refrescar la pagina de confirmacion, o React remontarla en StrictMode.
        if (yaSeEmitio(`${meta.eventId}:${meta.evento}`)) return;

        rastrear(meta.evento, meta.datos ?? {}, {
            eventID: meta.eventId,
            pixelIds: normalizarPixelIds(meta.pixelIds),
        });
    } catch (e) {
        // El tracking jamas debe tumbar la respuesta de un pago.
        console.error('[meta] no se pudo emitir el evento del pixel', e);
    }
};

apiApplication.interceptors.response.use(
    (response) => {
        emitirEventosDeRespuesta(response?.data);
        return response;
    },
    async (error: AxiosError) => {
        const original = error.config as RetriableConfig | undefined;
        if (!error.response || !original) return Promise.reject(error);
        if (error.response.status !== 401) return Promise.reject(error);
        if (original._retry) return Promise.reject(error);
        if (shouldSkipRefresh(original.url)) return Promise.reject(error);
        if (!authStorage.get('resetToken')) return Promise.reject(error);

        original._retry = true;
        try {
            if (!refreshInFlight) {
                refreshInFlight = performRefresh().finally(() => {
                    refreshInFlight = null;
                });
            }
            const newToken = await refreshInFlight;
            original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
            return apiApplication(original);
        } catch (e) {
            authStorage.clearAuth();
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
                window.location.href = '/auth/login';
            }
            return Promise.reject(e);
        }
    }
);

export default apiApplication;
