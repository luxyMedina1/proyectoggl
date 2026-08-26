import { slugify } from './slugify';
import { formatDate } from './dateHelpers';

// Datos minimos para armar la URL de un evento. El listado, el detalle, mis compras y los
// reels devuelven formas distintas del evento, asi que todo es opcional salvo el id (que
// solo se usa como ultimo recurso si el evento no trae nombre).
export interface EventoSlugInput {
    id: number | string;
    slug?: string | null;
    nombre?: string | null;
    artista?: { nombre?: string | null } | null;
}

// Funcion de un evento multifecha. Es lo que diferencia una fecha de otra en la URL.
export interface FuncionSlugInput {
    id?: number | string;
    nombre?: string | null;
    fecha?: string | null;
}

export interface EventoListaSlug extends EventoSlugInput {
    funciones?: FuncionSlugInput[] | null;
}

// Lo que la pagina necesita para pedirle los datos al back.
export interface EventoResuelto {
    eventoId: string;
    funcionId: string | null;
}

// Base del slug: solo el nombre del evento (o del artista). A proposito NO lleva recinto,
// ciudad, fecha del evento ni id: alargan la URL y se lee mal al compartirla.
// Si el back agrega una columna `slug` propia, esa gana.
export const slugBaseEvento = (evento: EventoSlugInput): string =>
    slugify(evento.slug || evento.nombre || evento.artista?.nombre || '');

// Sufijo de la funcion: dia del mes + nombre de la funcion si tiene.
// `7-matutino`, o `7` cuando la funcion no tiene nombre.
// El dia pasa por formatDate para respetar NEXT_PUBLIC_TIMEZONE (nunca la TZ del navegador).
export const sufijoFuncion = (funcion?: FuncionSlugInput | null): string => {
    if (!funcion) return '';

    const dia = funcion.fecha ? formatDate(funcion.fecha, 'd') : '';
    const diaValido = /^\d{1,2}$/.test(dia) ? dia : '';

    return [diaValido, funcion.nombre ? slugify(funcion.nombre) : '']
        .filter(Boolean)
        .join('-');
};

// `tuff-riders` (fecha unica) o `sky-fest-laguna-7-matutino` (funcion de un multifecha).
export const buildEventoSlug = (
    evento: EventoSlugInput,
    funcion?: FuncionSlugInput | null,
): string => {
    const slug = [slugBaseEvento(evento), sufijoFuncion(funcion)].filter(Boolean).join('-');
    // Sin nombre no hay slug posible; se cae al id para que el enlace no quede roto.
    return slug || String(evento.id ?? '');
};

// TODO(slug): compatibilidad temporal con los QR ya impresos y los enlaces viejos que
// apuntan a `/eventos/1084`. Quitar cuando esos QR dejen de circular.
export const idNumericoDeSlug = (param?: string | null): string | null => {
    const valor = (param ?? '').trim();
    return /^\d+$/.test(valor) ? valor : null;
};

// Resuelve el slug de la URL contra el listado publico de eventos.
// Devuelve null si ningun evento coincide (slug viejo, evento despublicado, etc.).
export const resolverSlugEnLista = (
    slug: string,
    eventos: EventoListaSlug[],
): EventoResuelto | null => {
    const objetivo = slug.trim().toLowerCase();
    if (!objetivo) return null;

    // Se prueban las bases mas largas primero: si un evento se llama "Sky Fest" y otro
    // "Sky Fest Laguna", `sky-fest-laguna` debe resolver al segundo y no leerse como una
    // funcion del primero.
    const candidatos = eventos
        .map((evento) => ({ evento, base: slugBaseEvento(evento) }))
        .filter(({ base }) => base && (objetivo === base || objetivo.startsWith(`${base}-`)))
        .sort((a, b) => b.base.length - a.base.length);

    for (const { evento, base } of candidatos) {
        if (objetivo === base) return { eventoId: String(evento.id), funcionId: null };

        const resto = objetivo.slice(base.length + 1);
        const funcion = (evento.funciones ?? []).find((f) => sufijoFuncion(f) === resto);
        if (funcion?.id != null) {
            return { eventoId: String(evento.id), funcionId: String(funcion.id) };
        }
    }

    return null;
};

export const rutaEvento = (evento: EventoSlugInput, funcion?: FuncionSlugInput | null): string =>
    `/eventos/${buildEventoSlug(evento, funcion)}`;

export const rutaEventoInformacion = (evento: EventoSlugInput): string =>
    `/eventos/informacion/${buildEventoSlug(evento)}`;

// Los microsites de conferencia (`/cosmotech/:eventoId`) siguen resolviendo por id.
export const rutaEventoPorBase = (
    evento: EventoSlugInput,
    base?: string | null,
    funcion?: FuncionSlugInput | null,
): string => {
    // En /eventos la funcion viaja dentro del slug; en las conferencias sigue por query param.
    if (!base || base === '/eventos') return rutaEvento(evento, funcion);
    return `${base}/${evento.id}${funcion?.id != null ? `?funcion=${funcion.id}` : ''}`;
};

// URL absoluta para compartir / og:url.
export const urlAbsolutaEvento = (
    evento: EventoSlugInput,
    funcion?: FuncionSlugInput | null,
): string => `${window.location.origin}${rutaEvento(evento, funcion)}`;
