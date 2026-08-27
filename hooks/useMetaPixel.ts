import { useCallback, useEffect } from 'react';
import {
    activarPixelsDePagina,
    limpiarPixelsDePagina,
    rastrear,
    vistaDePagina,
} from '../utils/metaPixel';

// Capa "hook-as-service" del Meta Pixel, igual que useEventosStore/useAuthStore: los
// componentes no tocan window.fbq, llaman a este hook.
//
// Ojo con el reparto de responsabilidades: aqui SOLO viven los eventos que nacen en el
// navegador (PageView, ViewContent, AddToCart). InitiateCheckout y Purchase los dicta el
// backend en la respuesta de la peticion y los dispara el interceptor de
// src/api/apiApplication.ts — asi el monto del navegador y el del servidor no pueden diferir.
// Ver docs/meta-pixel-frontend.md

const MONEDA = 'MXN';

interface ContenidoEvento {
    eventoId: number | string;
    nombre?: string;
    cantidad?: number;
    precioUnitario?: number;
    valor?: number;
}

/** Arma el `custom_data` con la forma de catalogo que espera Meta para un evento/boleto. */
const contenidoDeEvento = ({
    eventoId,
    nombre,
    cantidad = 1,
    precioUnitario,
    valor,
}: ContenidoEvento): Record<string, unknown> => {
    const id = `evento-${eventoId}`;
    const total = valor ?? (precioUnitario != null ? precioUnitario * cantidad : undefined);

    return {
        content_type: 'product',
        content_ids: [id],
        content_name: nombre,
        contents: [{ id, quantity: cantidad, ...(precioUnitario != null && { item_price: precioUnitario }) }],
        num_items: cantidad,
        currency: MONEDA,
        ...(total != null && { value: Number(total.toFixed(2)) }),
    };
};

/**
 * Activa los pixels del evento que se esta viendo mientras la pagina este montada.
 * Al desmontar los quita, para que al navegar del evento A al B no le sigamos mandando
 * eventos al pixel del promotor de A.
 *
 * @param pixels lo que venga en `evento.metaPixels` (acepta string[] o [{pixelId}]).
 */
export const usePixelsDeEvento = (pixels: unknown) => {
    const clave = JSON.stringify(pixels ?? null);

    useEffect(() => {
        activarPixelsDePagina(pixels);
        return () => limpiarPixelsDePagina();
        // `clave` serializa el array: sin esto el efecto se repite en cada render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave]);
};

export const useMetaPixel = () => {
    // useCallback no es un adorno aqui: estas funciones se usan como dependencia de efectos
    // (el ViewContent del detalle de evento). Sin identidad estable el efecto correria en
    // cada render y Meta veria una vista de contenido por cada uno.

    /** Vista del detalle de un evento. */
    const verContenido = useCallback((contenido: ContenidoEvento) => {
        rastrear('ViewContent', contenidoDeEvento(contenido));
    }, []);

    /** Boleto o asiento agregado a la seleccion. */
    const agregarAlCarrito = useCallback((contenido: ContenidoEvento) => {
        rastrear('AddToCart', contenidoDeEvento(contenido));
    }, []);

    return {
        verContenido,
        agregarAlCarrito,
        vistaDePagina,
    };
};
