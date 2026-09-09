import mammoth from "mammoth";
import { getSiteConfig } from "@/lib/config/getSiteConfig";
import { sanitizeLegalHtml } from "@/utils/sanitizeHtml";

// Renderizado de las páginas de legales EN EL SERVIDOR.
//
// Antes cada ruta /legales/* era 'use client' y, en un useEffect, bajaba el .docx
// (config.terminosYCondiciones / avisoPrivacidad / politicasDeUso), importaba
// `mammoth` (~1 MB) en el navegador y lo inyectaba con dangerouslySetInnerHTML.
// El crawler no veía contenido y el parser pesaba en el bundle del cliente.
//
// Ahora la conversión ocurre aquí, en servidor: `mammoth` sale del bundle del
// navegador, el HTML entra en la respuesta inicial (indexable) y se elimina uno
// de los dangerouslySetInnerHTML del cliente. El resultado se cachea 24 h con el
// tag `legales`, ya presente en la allowlist de /api/revalidate.

export const TAG_LEGALES = "legales";

// Las URLs de los .docx vienen de la config de marca (/configuraciones/detail/1).
// ConfigResponse las expone como `[key: string]: any`, así que se leen por clave.
export type DocumentoLegal = "terminosYCondiciones" | "avisoPrivacidad" | "politicasDeUso";

// Descarga del .docx con el patrón de cache opt-in de Next 16 (force-cache +
// next.revalidate/tags). La invalidación real la dispara el backend con el tag
// `legales`; el TTL es solo una red de seguridad.
const descargarDocx = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    const res = await fetch(url, {
      cache: "force-cache",
      next: { revalidate: 86400, tags: [TAG_LEGALES] },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`legales HTTP ${res.status}`);
    return await res.arrayBuffer();
  } catch (err) {
    console.error("[legales] no se pudo descargar el documento:", err);
    return null;
  }
};

/**
 * Devuelve el HTML saneado de un documento de legales, convertido con `mammoth`
 * en el servidor. Cadena vacía si no hay documento configurado o si falla la
 * descarga/conversión (la página muestra entonces su estado vacío).
 */
export const getLegal = async (documento: DocumentoLegal): Promise<string> => {
  const { config } = await getSiteConfig();
  const url = config?.[documento];
  if (typeof url !== "string" || !url) return "";

  const arrayBuffer = await descargarDocx(url);
  if (!arrayBuffer) return "";

  try {
    // mammoth en Node acepta { buffer: Buffer }.
    const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(arrayBuffer) });
    // Defensa en profundidad: el .docx es propio y versionado, pero se sanea igual.
    return sanitizeLegalHtml(value);
  } catch (err) {
    console.error("[legales] no se pudo convertir el .docx:", err);
    return "";
  }
};
