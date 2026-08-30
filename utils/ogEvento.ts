import type { Metadata } from "next";
import {
  idNumericoDeSlug,
  resolverSlugEnLista,
  rutaEvento,
  rutaEventoInformacion,
  type EventoResuelto,
  type FuncionSlugInput,
} from "./eventoSlug";
import { formatDate } from "./dateHelpers";
import { textoPlano } from "./sanitizeHtml";
import { getSiteConfig } from "@/lib/config/getSiteConfig";

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
const apiGet = async (path: string, tags: string[] = []): Promise<any> => {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "" },
    cache: "force-cache",
    next: { revalidate: 300, tags },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
};

// Mismo orden de resolucion que `useEventosStore.resolverSlugEvento`:
// id numerico (QR viejos) -> GET /eventos/slug/:slug -> fallback contra el listado publico.
const resolverSlug = async (slug: string): Promise<EventoResuelto | null> => {
  const idNumerico = idNumericoDeSlug(slug);
  if (idNumerico) return { eventoId: idNumerico, funcionId: null };

  try {
    const data = await apiGet(`/eventos/slug/${encodeURIComponent(slug)}`, [
      `evento:${slug}`,
    ]);
    if (data?.eventoId == null) throw new Error("respuesta sin eventoId");
    return {
      eventoId: String(data.eventoId),
      funcionId: data.funcionId != null ? String(data.funcionId) : null,
    };
  } catch {
    try {
      const lista = await apiGet("/eventos/get_all_select?tipoDispositivo=web", [
        "eventos:lista",
      ]);
      return resolverSlugEnLista(slug, lista?.eventosFiltrados ?? []);
    } catch {
      return null;
    }
  }
};

type Variante = "detalle" | "informacion";

export const buildMetadataEvento = async (
  slug: string,
  variante: Variante = "detalle",
): Promise<Metadata> => {
  try {
    const resuelto = await resolverSlug(slug);
    if (!resuelto) return {};

    const evento = await apiGet(`/eventos/${resuelto.eventoId}/detalle`, [
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
            (f: any) => String(f?.id) === resuelto.funcionId,
          )
        : undefined;

    const titulo =
      variante === "detalle" && funcion?.nombre
        ? `${evento.nombre} - ${funcion.nombre}`
        : evento.nombre;

    const descripcion =
      textoPlano(evento.descripcion) ||
      [
        evento.fecha
          ? formatDate(evento.fecha, "d 'de' MMMM 'de' yyyy, hh:mm a")
          : "",
        evento.recinto?.nombre,
        evento.ciudad?.nombre,
      ]
        .filter(Boolean)
        .join(" · ");

    // Sin imagen propia: undefined => hereda app/opengraph-image.tsx.
    const imagen: string | undefined = evento.imagenPromocion || undefined;
    const ruta =
      variante === "informacion"
        ? rutaEventoInformacion(evento)
        : rutaEvento(evento, funcion);
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
