import type { Metadata } from "next";
import {
  idNumericoDeSlug,
  resolverSlugEnLista,
  rutaEvento,
  rutaEventoInformacion,
  type EventoResuelto,
  type EventoListaSlug,
  type FuncionSlugInput,
} from "./eventoSlug";
import type { Recinto, Ciudad } from "@/app/(site)/eventos/[slug]/cabeceraEvento";
import { formatDate } from "./dateHelpers";
import { textoPlano } from "./sanitizeHtml";
import { getSiteConfig } from "@/lib/config/getSiteConfig";

// --- Formas de las respuestas del backend ------------------------------------------
// Tipadas a partir de lo que este módulo (y sus consumidores) leen de verdad, no del
// DTO completo del backend —que no tiene tipo fuerte en el servidor—. Lo que no se
// consume aquí queda en el index signature de `EventoDetalle`.

// GET /eventos/slug/:slug — resolución de un slug a ids.
interface RespuestaSlugEvento {
  eventoId?: string | number | null;
  funcionId?: string | number | null;
}

// GET /eventos/get_all_select — listado público de eventos.
interface RespuestaListaEventos {
  eventosFiltrados?: EventoListaSlug[] | null;
}

// GET /eventos/:id/detalle, acotado a lo que consumen las <meta> y el cascarón de la
// página de evento (`construirEventosJsonLd`, `proyectarCabeceraEvento`). El backend
// manda más claves —entre ellas `secciones[].asientosDisponibles`, cacheado ~5 min—:
// van en el index signature y las recorta `proyectarCabeceraEvento` antes del cliente.
export interface EventoDetalle {
  id: number | string;
  nombre: string;
  fecha: string;
  imagenPromocion: string;
  descripcion: string;
  recinto: Recinto;
  ciudad: Ciudad;
  funciones?: FuncionSlugInput[] | null;
  artista?: { nombre?: string | null } | null;
  slug?: string | null;
  precioBase?: string | number | null;
  imagenBanner?: string | null;
  [clave: string]: unknown;
}

// --- Open Graph de las paginas de evento (server-side) -----------------------------
//
// Los scrapers de WhatsApp/Facebook/Twitter/Telegram/Slack NO ejecutan JS. Aqui se
// resuelve el evento en el servidor (dentro de `generateMetadata`) y se emiten las
// <meta> reales en el HTML de respuesta.
//
// No se reutiliza la instancia `apiApplication` de axios: sus interceptores leen
// `localStorage`/`window` y no corren en el servidor. Tampoco `richTextToPlainText`, que
// usa `document`.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://taquillavip.com";
const SITE_NAME_FALLBACK = process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip";

const apiBase = (): string => {
  const url = process.env.NEXT_PUBLIC_URL_BACKEND;
  return url ? `${url}/api/v1` : "/api/v1";
};

// Cache de 5 min: los crawlers reintentan y no hay que golpear el back en cada request.
// Timeout corto: si el back no responde no se debe demorar el render de la pagina
// (el catch de buildMetadataEvento cae a las <meta> globales del layout).
// tags: el backend los invalida vía POST /api/revalidate cuando el evento cambia.
const apiGet = async <T = unknown>(path: string, tags: string[] = []): Promise<T> => {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "" },
    cache: "force-cache",
    next: { revalidate: 300, tags },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
};

// Mismo orden de resolucion que `useEventosStore.resolverSlugEvento`:
// id numerico (QR viejos) -> GET /eventos/slug/:slug -> fallback contra el listado publico.
const resolverSlug = async (slug: string): Promise<EventoResuelto | null> => {
  const idNumerico = idNumericoDeSlug(slug);
  if (idNumerico) return { eventoId: idNumerico, funcionId: null };

  try {
    const data = await apiGet<RespuestaSlugEvento>(`/eventos/slug/${encodeURIComponent(slug)}`, [
      `evento:${slug}`,
    ]);
    if (data?.eventoId == null) throw new Error("respuesta sin eventoId");
    return {
      eventoId: String(data.eventoId),
      funcionId: data.funcionId != null ? String(data.funcionId) : null,
    };
  } catch {
    try {
      const lista = await apiGet<RespuestaListaEventos>(
        "/eventos/get_all_select?tipoDispositivo=web",
        ["eventos:lista"],
      );
      return resolverSlugEnLista(slug, lista?.eventosFiltrados ?? []);
    } catch {
      return null;
    }
  }
};

type Variante = "detalle" | "informacion";

// Resuelve el evento por slug en el servidor y devuelve el detalle ya poblado, o
// `null` si el slug no corresponde a ningún evento (o el back no responde).
//
// Se usa en el cascarón de `app/(site)/eventos/[slug]/page.tsx` para invocar
// `notFound()` (404 real) ante slugs inválidos, cerrando la fuga de soft 404. Comparte
// la misma resolución (`resolverSlug`) y el mismo fetch cacheado que las <meta> de
// `buildMetadataEvento`, así que no golpea el back una segunda vez por request.
export const getEvento = async (slug: string): Promise<EventoDetalle | null> => {
  try {
    const resuelto = await resolverSlug(slug);
    if (!resuelto) return null;

    const evento = await apiGet<EventoDetalle>(`/eventos/${resuelto.eventoId}/detalle`, [
      "eventos:lista",
      `evento:${slug}`,
    ]);
    return evento?.nombre ? evento : null;
  } catch {
    return null;
  }
};

// Listado publico de eventos para el servidor (mismo endpoint y cache que el sitemap).
// Fetch directo, no la instancia axios (sus interceptores leen window/localStorage).
// `apiGet` lanza si el back no responde; quien llama decide como manejarlo
// (generateStaticParams lo captura y cae a [] para no romper el build, Req 3.2).
export const getListaEventos = async (): Promise<EventoListaSlug[]> => {
  const data = await apiGet<RespuestaListaEventos>("/eventos/get_all_select?tipoDispositivo=web", [
    "eventos:lista",
  ]);
  return data?.eventosFiltrados ?? [];
};

export const buildMetadataEvento = async (
  slug: string,
  variante: Variante = "detalle",
): Promise<Metadata> => {
  try {
    const resuelto = await resolverSlug(slug);
    if (!resuelto) return {};

    const evento = await apiGet<EventoDetalle>(`/eventos/${resuelto.eventoId}/detalle`, [
      "eventos:lista",
      `evento:${slug}`,
    ]);
    if (!evento?.nombre) return {};

    // Mismo nombre de marca que usa el layout raíz (config:sitio, cacheado).
    const { config } = await getSiteConfig();
    const siteName = config?.nombreMarca?.trim() || SITE_NAME_FALLBACK;

    const funcion: FuncionSlugInput | undefined =
      variante === "detalle" && resuelto.funcionId
        ? (evento.funciones ?? []).find(
            (f: FuncionSlugInput) => String(f?.id) === resuelto.funcionId,
          )
        : undefined;

    const titulo =
      variante === "detalle" && funcion?.nombre
        ? `${evento.nombre} - ${funcion.nombre}`
        : evento.nombre;

    const descripcion =
      textoPlano(evento.descripcion) ||
      [
        evento.fecha ? formatDate(evento.fecha, "d 'de' MMMM 'de' yyyy, hh:mm a") : "",
        evento.recinto?.nombre,
        evento.ciudad?.nombre,
      ]
        .filter(Boolean)
        .join(" · ");

    // Sin imagen propia: undefined => hereda app/opengraph-image.tsx.
    const imagen: string | undefined = evento.imagenPromocion || undefined;
    const ruta =
      variante === "informacion" ? rutaEventoInformacion(evento) : rutaEvento(evento, funcion);
    const url = `${SITE_URL}${ruta}`;

    return {
      title: titulo,
      description: descripcion,
      alternates: { canonical: url },
      openGraph: {
        type: "article",
        url,
        siteName,
        locale: "es_MX",
        title: titulo,
        description: descripcion,
        images: imagen ? [{ url: imagen, alt: titulo }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: titulo,
        description: descripcion,
        images: imagen ? [imagen] : undefined,
      },
    };
  } catch {
    // Sin datos se usan las <meta> globales del layout raiz.
    return {};
  }
};
