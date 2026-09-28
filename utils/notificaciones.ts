// Contrato del socket `/notificaciones` del backend (taquillavipbackend-v2,
// docs/integracion/notificaciones). El backend persiste cada notificación y, al
// (re)conectar con `ultimoId`, reenvía todo lo posterior: así el usuario ve lo que
// pasó mientras estuvo sin internet o con la pestaña cerrada.

export type TipoNotificacion =
    | 'transferencia_pendiente'
    | 'transferencia_completada'
    | 'transferencia_rechazada'
    | 'transferencia_cancelada'
    | 'boleto_devuelto'
    | 'boleto_validado'
    | 'solicitud_amistad'
    | 'comanda_estatus'
    | 'comanda_nueva'
    | 'pedido_nuevo';

export interface Notificacion {
    id: number;
    tipo: TipoNotificacion | string;
    titulo: string;
    cuerpo: string;
    data: Record<string, unknown> | null;
    leida: boolean;
    createdAt: string;
}

export interface NotificacionesPerdidas {
    notificaciones: Notificacion[];
    hayMas: boolean;
    noLeidas: number;
}

export const MAX_TOASTS_POR_LOTE = 3;

export const rutaPorTipo = (tipo: string): string | null => {
    if (tipo.startsWith('transferencia_') || tipo === 'boleto_devuelto') {
        return '/perfil/mis_transferencias';
    }
    if (tipo === 'solicitud_amistad') return '/perfil/mis_amigos';
    if (tipo === 'boleto_validado') return '/perfil/mis_compras';
    return null;
};

// Por email (el DTO de sesión no trae id): si otra cuenta entra en el mismo
// navegador no hereda el cursor de la anterior.
const claveUltimoId = (email: string) => `notif:ultimoId:${email}`;

export const leerUltimoId = (email: string): number | undefined => {
    try {
        const n = Number(localStorage.getItem(claveUltimoId(email)));
        return Number.isInteger(n) && n > 0 ? n : undefined;
    } catch {
        return undefined;
    }
};

export const guardarUltimoId = (email: string, id: number) => {
    try {
        localStorage.setItem(claveUltimoId(email), String(id));
    } catch {
        // storage bloqueado (modo privado): se pierde solo el cursor, el backend
        // mandará las no leídas en la próxima conexión.
    }
};

/**
 * Qué mostrar al recibir un lote de `notificaciones_perdidas`.
 * - Sin cursor previo (primera vez en este navegador): solo un resumen de no
 *   leídas, para no inundar de toasts con historial viejo.
 * - Con cursor (reconexión): hasta MAX_TOASTS_POR_LOTE toasts individuales y un
 *   resumen con el resto.
 */
export const planPerdidas = (
    lote: NotificacionesPerdidas,
    teniaCursor: boolean,
): { individuales: Notificacion[]; resumen: string | null } => {
    if (!teniaCursor) {
        return {
            individuales: [],
            resumen:
                lote.noLeidas > 0
                    ? `Tienes ${lote.noLeidas} ${lote.noLeidas === 1 ? 'notificación' : 'notificaciones'} sin leer`
                    : null,
        };
    }

    const individuales = lote.notificaciones.slice(-MAX_TOASTS_POR_LOTE);
    const resto = lote.notificaciones.length - individuales.length;
    return {
        individuales,
        resumen:
            resto > 0
                ? `Y ${resto} ${resto === 1 ? 'notificación más' : 'notificaciones más'} mientras estabas sin conexión`
                : null,
    };
};
