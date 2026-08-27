/* eslint-disable @typescript-eslint/no-explicit-any */
// Meta Pixel — capa base (sin React).
//
// En este front conviven VARIOS pixels a la vez: el de la marca (viene en
// /configuraciones/detail/1) y el del promotor del evento que se esta viendo (viene en el
// detalle del evento). Por eso aqui NUNCA se llama fbq('track', ...): esa forma le manda el
// evento a TODOS los pixels inicializados, y el promotor del evento A terminaria viendo las
// ventas del evento B. Todo sale por fbq('trackSingle', pixelId, ...), que apunta a uno solo.
//
// Documentacion completa del flujo: docs/meta-pixel-frontend.md

type Fbq = {
    (...args: unknown[]): void;
    callMethod?: (...args: unknown[]) => void;
    queue: unknown[];
    loaded: boolean;
    version: string;
};

declare global {
    interface Window {
        fbq?: Fbq;
        _fbq?: Fbq;
    }
}

const SRC_FBEVENTS = 'https://connect.facebook.net/en_US/fbevents.js';

// Eventos estandar de Meta. Lo que no este aqui se manda como custom (trackSingleCustom),
// porque fbq rechaza un nombre desconocido en trackSingle.
const EVENTOS_ESTANDAR = new Set([
    'AddPaymentInfo', 'AddToCart', 'AddToWishlist', 'CompleteRegistration', 'Contact',
    'CustomizeProduct', 'Donate', 'FindLocation', 'InitiateCheckout', 'Lead', 'PageView',
    'Purchase', 'Schedule', 'Search', 'StartTrial', 'SubmitApplication', 'Subscribe',
    'ViewContent',
]);

// Pixels a los que ya se les hizo fbq('init'). fbq no tiene "uninit", asi que este set solo
// crece: la baja se maneja con la lista de activos de abajo, no desinicializando.
const inicializados = new Set<string>();

// Pixels de la marca — activos durante toda la sesion.
let pixelsGlobales: string[] = [];

// Pixels de la pagina actual (los del evento). Se REEMPLAZAN en cada navegacion: si no, al
// pasar del evento A al evento B seguiriamos disparandole al pixel del promotor de A.
let pixelsDePagina: string[] = [];

/** Acepta ["123"] o [{ pixelId: "123" }] — el back puede devolver cualquiera de las dos. */
export const normalizarPixelIds = (valor: unknown): string[] => {
    if (!Array.isArray(valor)) return [];
    return valor
        .map((item) => (typeof item === 'string' ? item : item?.pixelId ?? item?.pixel_id))
        .filter((id): id is string => typeof id === 'string' && /^\d{6,}$/.test(id.trim()))
        .map((id) => id.trim());
};

const cargarSnippet = () => {
    if (typeof window === 'undefined' || window.fbq) return;

    const fbq = function (...args: unknown[]) {
        // Cola hasta que fbevents.js termine de cargar; a partir de ahi, llamada directa.
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
    } as unknown as Fbq;

    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    (fbq as any).push = fbq;

    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = SRC_FBEVENTS;
    document.head.appendChild(script);
};

const inicializar = (pixelId: string) => {
    if (inicializados.has(pixelId)) return;
    cargarSnippet();
    window.fbq?.('init', pixelId);
    inicializados.add(pixelId);
    // El PageView inicial del snippet no existe aqui (nunca disparamos 'track' a secas), y un
    // pixel que se inicializa a media navegacion se perderia el de su propia pagina.
    window.fbq?.('trackSingle', pixelId, 'PageView');
};

/** Pixels de la marca. Se llama una vez, cuando carga /configuraciones/detail/1. */
export const activarPixelsGlobales = (valor: unknown) => {
    const ids = normalizarPixelIds(valor);
    if (!ids.length) return;
    pixelsGlobales = ids;
    ids.forEach(inicializar);
};

/** Pixels del evento que se esta viendo. Reemplaza los de la navegacion anterior. */
export const activarPixelsDePagina = (valor: unknown) => {
    const ids = normalizarPixelIds(valor);
    pixelsDePagina = ids;
    ids.forEach(inicializar);
};

export const limpiarPixelsDePagina = () => {
    pixelsDePagina = [];
};

/** Marca + evento actual, sin repetidos. Un pixel puede estar en las dos listas. */
export const pixelsActivos = (): string[] => [...new Set([...pixelsGlobales, ...pixelsDePagina])];

export const hayPixels = () => pixelsActivos().length > 0;

interface OpcionesEvento {
    /** El id que comparten navegador y servidor. Sin esto Meta cuenta la conversion dos veces. */
    eventID?: string;
    /** A que pixels mandarlo. Por defecto, todos los activos de la pagina. */
    pixelIds?: string[];
}

export const rastrear = (
    nombreEvento: string,
    datos: Record<string, unknown> = {},
    opciones: OpcionesEvento = {},
) => {
    const objetivos = opciones.pixelIds?.length ? opciones.pixelIds : pixelsActivos();
    // Sin objetivos no se hace nada — y el snippet de fbq ni se descarga. No se valida
    // `window.fbq` aqui a proposito: `inicializar` lo crea si hace falta, y si validaramos
    // antes perderiamos el Purchase que llega en la respuesta del back cuando el usuario
    // vuelve de 3DS y la config de marca todavia no habia cargado.
    if (!objetivos.length) return;

    const metodo = EVENTOS_ESTANDAR.has(nombreEvento) ? 'trackSingle' : 'trackSingleCustom';
    const extra = opciones.eventID ? { eventID: opciones.eventID } : undefined;

    objetivos.forEach((pixelId) => {
        // Un pixel que llega en la respuesta del back (ej. al confirmar el cargo despues de
        // 3DS) puede no estar inicializado todavia en esta carga de pagina.
        inicializar(pixelId);
        if (extra) window.fbq?.(metodo, pixelId, nombreEvento, datos, extra);
        else window.fbq?.(metodo, pixelId, nombreEvento, datos);
    });
};

export const vistaDePagina = () => rastrear('PageView');

// --- Atribucion que viaja al backend -----------------------------------------------------

const leerCookie = (nombre: string): string | undefined => {
    if (typeof document === 'undefined') return undefined;
    const match = document.cookie.match(new RegExp(`(^|;\\s*)${nombre}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : undefined;
};

export const nuevoEventId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback para navegadores sin randomUUID (Safari < 15.4, y http:// en local).
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

export interface AtribucionMeta {
    eventId: string;
    fbp?: string;
    fbc?: string;
    eventSourceUrl?: string;
}

/**
 * Lo que se le adjunta al backend para que su llamada a la Conversions API tenga el mismo
 * `event_id` que la del navegador y las cookies de atribucion de Meta.
 *
 * `_fbp` la crea el propio pixel; `_fbc` solo existe si el usuario llego con `?fbclid=...`
 * en la URL (es el clic en el anuncio). Sin `_fbc` el match quality baja bastante.
 */
export const datosAtribucion = (): AtribucionMeta => ({
    eventId: nuevoEventId(),
    fbp: leerCookie('_fbp'),
    fbc: leerCookie('_fbc'),
    eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
});

// --- Guardas de duplicado ----------------------------------------------------------------

const CLAVE_EMITIDOS = 'meta_eventos_emitidos';

/**
 * Evita repetir un evento con el mismo `event_id` si el usuario refresca la pagina de
 * confirmacion o si React vuelve a montar (StrictMode). El backend tambien es idempotente,
 * pero esto ahorra el disparo del lado navegador. sessionStorage, no local: si el usuario
 * abre otra pestana y compra de nuevo, ahi si es una conversion distinta.
 */
export const yaSeEmitio = (clave: string): boolean => {
    try {
        const previos: string[] = JSON.parse(sessionStorage.getItem(CLAVE_EMITIDOS) ?? '[]');
        if (previos.includes(clave)) return true;
        sessionStorage.setItem(CLAVE_EMITIDOS, JSON.stringify([...previos.slice(-19), clave]));
        return false;
    } catch {
        // Modo incognito estricto o storage lleno: preferimos disparar de mas (Meta deduplica
        // por event_id de todos modos) a perder la conversion.
        return false;
    }
};
