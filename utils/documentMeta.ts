// Metadatos de <head> en tiempo de ejecucion (title, description, Open Graph, canonical).
//
// OJO: los scrapers de WhatsApp, Facebook, Twitter/X, Telegram y Slack NO ejecutan JS,
// asi que esto NO arregla la vista previa al compartir. Sirve para la pestana del
// navegador, para Google (que si renderiza JS) y para dejar el canonical correcto.
// Para la vista previa real hay que inyectar las etiquetas en el HTML que responde el
// servidor: ver docs/metadatos-og-eventos.md.

export interface PageMeta {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: 'website' | 'article';
}

// Marca las etiquetas creadas por este modulo para poder quitarlas sin tocar las de layout.tsx.
const MARCA = 'data-meta-dinamico';

const FALLBACK_TITULO = process.env.NEXT_PUBLIC_TITLE_APP || 'Taquilla Vip';

let nombreSitio = FALLBACK_TITULO;
let descripcionSitio: string | undefined;
let imagenSitio: string | undefined;
let metaPagina: PageMeta | null = null;

const upsertMeta = (atributo: 'name' | 'property', clave: string, valor?: string) => {
    const existente = document.head.querySelector<HTMLMetaElement>(`meta[${atributo}="${clave}"]`);

    if (!valor) {
        if (existente?.hasAttribute(MARCA)) existente.remove();
        else existente?.removeAttribute('content');
        return;
    }

    const etiqueta = existente ?? document.createElement('meta');
    if (!existente) {
        etiqueta.setAttribute(atributo, clave);
        etiqueta.setAttribute(MARCA, 'true');
        document.head.appendChild(etiqueta);
    }
    etiqueta.setAttribute('content', valor);
};

const upsertCanonical = (url?: string) => {
    const existente = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!url) {
        if (existente?.hasAttribute(MARCA)) existente.remove();
        return;
    }

    const etiqueta = existente ?? document.createElement('link');
    if (!existente) {
        etiqueta.rel = 'canonical';
        etiqueta.setAttribute(MARCA, 'true');
        document.head.appendChild(etiqueta);
    }
    etiqueta.href = url;
};

const render = () => {
    const titulo = metaPagina?.title ? `${metaPagina.title} | ${nombreSitio}` : nombreSitio;
    const descripcion = metaPagina?.description ?? descripcionSitio;
    const imagen = metaPagina?.image ?? imagenSitio;
    const url = metaPagina?.url ?? window.location.href;

    document.title = titulo;

    upsertMeta('name', 'description', descripcion);
    upsertMeta('property', 'og:site_name', nombreSitio);
    upsertMeta('property', 'og:type', metaPagina?.type ?? 'website');
    upsertMeta('property', 'og:title', titulo);
    upsertMeta('property', 'og:description', descripcion);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', imagen);
    upsertMeta('name', 'twitter:card', imagen ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', titulo);
    upsertMeta('name', 'twitter:description', descripcion);
    upsertMeta('name', 'twitter:image', imagen);
    upsertCanonical(url);
};

// La marca llega de /configuraciones/detail/1 (ColorContext), despues del primer render.
export const setMetaDeSitio = (datos: {
    nombreMarca?: string | null;
    descripcion?: string | null;
    imagen?: string | null;
}) => {
    nombreSitio = datos.nombreMarca || FALLBACK_TITULO;
    descripcionSitio = datos.descripcion || descripcionSitio;
    imagenSitio = datos.imagen || imagenSitio;
    render();
};

export const applyPageMeta = (meta: PageMeta) => {
    metaPagina = meta;
    render();
};

// Al desmontar la pagina se vuelve al title/meta de la marca.
export const clearPageMeta = () => {
    metaPagina = null;
    render();
};
