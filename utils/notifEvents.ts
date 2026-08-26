// Evento global para refrescar los badges de notificaciones (solicitudes de
// amistad + transferencias pendientes) al instante, sin esperar al polling.
// Lo emiten las páginas tras aceptar/rechazar/cancelar; lo escuchan HeaderLayout
// y Sidebar para re-consultar los contadores.
export const NOTIF_REFRESH_EVENT = 'notif:refresh';

export const emitNotifRefresh = () => {
    window.dispatchEvent(new Event(NOTIF_REFRESH_EVENT));
};

export const onNotifRefresh = (handler: () => void) => {
    window.addEventListener(NOTIF_REFRESH_EVENT, handler);
    return () => window.removeEventListener(NOTIF_REFRESH_EVENT, handler);
};
