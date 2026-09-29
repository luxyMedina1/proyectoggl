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

export const rutaPorTipo = (tipo: string): string | null => {
    if (tipo.startsWith('transferencia_') || tipo === 'boleto_devuelto') {
        return '/perfil/mis_transferencias';
    }
    if (tipo === 'solicitud_amistad') return '/perfil/mis_amigos';
    if (tipo === 'boleto_validado') return '/perfil/mis_compras';
    return null;
};

// Qué pantalla debe recargarse al llegar una notificación. Sin `tipo` (lote de
// perdidas o refresco manual) se recarga todo.
export const afectaTransferencias = (tipo?: string) =>
    !tipo || tipo.startsWith('transferencia_') || tipo === 'boleto_devuelto';

export const afectaAmigos = (tipo?: string) => !tipo || tipo === 'solicitud_amistad';

// Aceptar una transferencia o recibir una devolución cambia qué boletos tiene el
// usuario; validar uno cambia su estado.
export const afectaCompras = (tipo?: string) =>
    !tipo ||
    tipo === 'boleto_validado' ||
    tipo === 'boleto_devuelto' ||
    tipo === 'transferencia_completada';

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

const plural = (n: number) => (n === 1 ? 'notificación' : 'notificaciones');

/**
 * Qué mostrar al recibir `notificaciones_perdidas` (ya juntados todos los lotes).
 * - Sin cursor previo (primera vez en este navegador): solo un resumen de no
 *   leídas, para no inundar de toasts con historial viejo.
 * - Con cursor o ya sincronizado en esta sesión (reconexión): un solo toast. Si
 *   se perdió una, se muestra tal cual; si fueron varias, un resumen. Las que ya
 *   vienen leídas (se abrieron en otro dispositivo durante el corte) no avisan.
 */
export const planPerdidas = (
    lote: NotificacionesPerdidas,
    esReconexion: boolean,
): { individuales: Notificacion[]; resumen: string | null } => {
    if (!esReconexion) {
        return {
            individuales: [],
            resumen:
                lote.noLeidas > 0
                    ? `Tienes ${lote.noLeidas} ${plural(lote.noLeidas)} sin leer`
                    : null,
        };
    }

    const sinLeer = lote.notificaciones.filter((n) => !n.leida);
    if (sinLeer.length <= 1) return { individuales: sinLeer, resumen: null };
    return {
        individuales: [],
        resumen: `Mientras estabas sin conexión llegaron ${sinLeer.length} ${plural(sinLeer.length)}`,
    };
};
