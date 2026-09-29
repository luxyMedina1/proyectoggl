// Evento global para refrescar los badges de notificaciones (solicitudes de
// amistad + transferencias pendientes) al instante, sin esperar al polling.
// Lo emiten las páginas tras aceptar/rechazar/cancelar y el socket de
// notificaciones; lo escuchan HeaderLayout, Sidebar y las páginas del perfil.
// `tipo` indica qué notificación lo disparó; sin `tipo` hay que refrescar todo.
export const NOTIF_REFRESH_EVENT = 'notif:refresh';

export const emitNotifRefresh = (tipo?: string) => {
    window.dispatchEvent(new CustomEvent(NOTIF_REFRESH_EVENT, { detail: { tipo } }));
};

export const onNotifRefresh = (handler: (tipo?: string) => void) => {
    const listener = (e: Event) => handler((e as CustomEvent<{ tipo?: string }>).detail?.tipo);
    window.addEventListener(NOTIF_REFRESH_EVENT, listener);
    return () => window.removeEventListener(NOTIF_REFRESH_EVENT, listener);
};

// Con el socket conectado los cambios llegan en vivo (y disparan
// emitNotifRefresh), así que el polling solo corre como respaldo mientras está caído.
let socketConectado = false;

export const setSocketNotifConectado = (conectado: boolean) => {
    socketConectado = conectado;
};

export const pollingDeRespaldo = (fn: () => void, ms: number) => {
    const id = window.setInterval(() => {
        if (!socketConectado) fn();
    }, ms);
    return () => window.clearInterval(id);
};
