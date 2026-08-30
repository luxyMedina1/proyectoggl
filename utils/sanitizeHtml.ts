import DOMPurify from "dompurify";

// Los campos de descripcion del dashboard (RichTextEditor) llegan como HTML, no como texto plano,
// y desde la version con enlaces pueden traer anchors. Se sanitiza antes de pintar con
// dangerouslySetInnerHTML para que el contenido guardado nunca pueda inyectar scripts.

const ETIQUETAS_PERMITIDAS = [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "a",
    "span",
];

const ATRIBUTOS_PERMITIDOS = ["href", "target", "rel", "style", "class"];

// Solo protocolos navegables: bloquea javascript:, data: y similares.
const PROTOCOLOS_PERMITIDOS = /^(?:https?:|mailto:|tel:|#)/i;

const ES_ENLACE_LOCAL = /^(?:mailto:|tel:|#)/i;

// El editor solo usa style para la alineacion del parrafo (style="text-align:center").
const ALINEACIONES_PERMITIDAS = new Set(["left", "right", "center", "justify"]);

let hooksInstalados = false;

const instalarHooks = () => {
    if (hooksInstalados) return;
    hooksInstalados = true;

    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
        // DOMPurify no filtra el contenido de style, y un style libre desde contenido guardado
        // permite overlays a pantalla completa (clickjacking) y peticiones externas via url().
        // Se conserva unicamente la alineacion y se descarta el resto de las declaraciones.
        if (node.hasAttribute("style")) {
            const alineacion = (node as HTMLElement).style.textAlign.trim().toLowerCase();
            if (ALINEACIONES_PERMITIDAS.has(alineacion)) {
                node.setAttribute("style", `text-align:${alineacion}`);
            } else {
                node.removeAttribute("style");
            }
        }

        if (node.nodeName !== "A") return;

        // Se fuerza target/rel por si el HTML guardado antes del editor de enlaces no los trae.
        // Los mailto:, tel: y anclas internas se quedan en la misma pestana: abrir el cliente de
        // correo o el marcador en una pestana nueva deja una ventana vacia.
        const href = node.getAttribute("href");
        if (!href) return;

        if (ES_ENLACE_LOCAL.test(href)) {
            node.removeAttribute("target");
        } else {
            node.setAttribute("target", "_blank");
        }

        node.setAttribute("rel", "noopener noreferrer nofollow");
    });
};

// Devuelve HTML seguro para dangerouslySetInnerHTML. Cadena vacia si no hay contenido.
export const sanitizeRichText = (html?: string | null): string => {
    if (!html) return "";
    instalarHooks();
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ETIQUETAS_PERMITIDAS,
        ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
        ALLOWED_URI_REGEXP: PROTOCOLOS_PERMITIDOS,
    });
};

// Texto plano recortado a partir del mismo HTML, para meta description / og:description.
// Se sanitiza primero y luego se lee el textContent de un nodo suelto (no se inserta en el DOM).
// OJO: usa document, así que SOLO corre en el navegador. En el servidor
// (generateMetadata, sitemap) usa textoPlano().
export const richTextToPlainText = (html?: string | null, maxLargo = 200): string => {
    if (!html) return "";

    const contenedor = document.createElement("div");
    contenedor.innerHTML = sanitizeRichText(html);

    const texto = (contenedor.textContent ?? "").replace(/\s+/g, " ").trim();
    if (texto.length <= maxLargo) return texto;

    return `${texto.slice(0, maxLargo - 1).trimEnd()}…`;
};

const ENTIDADES: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};

/**
 * Texto plano a partir de HTML, sin depender del DOM.
 *
 * Sirve en servidor y en cliente, y es la que usa generateMetadata para derivar
 * la og:description de la descripción rich text del evento.
 *
 * OJO: esto NO es un sanitizador. Sólo quita etiquetas para producir texto.
 * Para pintar HTML sigue usando sanitizeRichText() con DOMPurify.
 */
export const textoPlano = (html?: string | null, maxLargo = 200): string => {
    if (!html) return "";

    const texto = html
        // Los bloques se convierten en espacio para que no se peguen palabras
        // entre párrafos: "<p>uno</p><p>dos</p>" → "uno dos", no "unodos".
        .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, " ")
        .replace(/<br\s*\/?>/gi, " ")
        // script y style con su contenido, antes de quitar etiquetas sueltas.
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTIDADES[m.toLowerCase()] ?? " ")
        .replace(/\s+/g, " ")
        .trim();

    if (texto.length <= maxLargo) return texto;
    return `${texto.slice(0, maxLargo - 1).trimEnd()}…`;
};
