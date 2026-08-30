import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

/**
 * Invalidación de caché disparada por el backend.
 *
 * El backend llama aquí después de cada mutación en el dashboard que afecte a
 * datos públicos cacheados (ver docs/checklist-migracion/03-revalidacion-desde-el-backend.md).
 *
 * Autenticación: secreto compartido en el header x-revalidate-secret. NO se
 * reutiliza la API key del backend: esta ruta la puede alcanzar cualquiera desde
 * internet y el único daño posible es forzar renders innecesarios.
 */

// Tags exactos que el backend puede invalidar.
const TAGS_EXACTOS = new Set([
  "config:sitio",
  "ciudades",
  "eventos:lista",
  "legales",
]);

// Tags con parámetro: 'evento:tuff-riders', 'citypass:torreon'.
const PREFIJOS = ["evento:", "citypass:"];

// Allowlist a propósito: sin ella, quien tenga el secreto puede invalidar
// cualquier cadena y provocar renders en masa. También atrapa typos del backend.
const tagPermitido = (tag: string) =>
  TAGS_EXACTOS.has(tag) ||
  PREFIJOS.some((p) => tag.startsWith(p) && tag.length > p.length);

const secretoValido = (recibido: string | null): boolean => {
  const esperado = process.env.REVALIDATE_SECRET;
  if (!esperado || !recibido) return false;

  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  // timingSafeEqual lanza si los largos difieren; comparar antes evita que la
  // longitud del secreto se filtre por el tipo de respuesta.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export async function POST(request: Request) {
  if (!secretoValido(request.headers.get("x-revalidate-secret"))) {
    // 401 sin detalle: no le digas a quien sondea si el secreto existe.
    return Response.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const tags = (body as { tags?: unknown })?.tags;
  if (!Array.isArray(tags) || tags.length === 0) {
    return Response.json(
      { ok: false, error: "Se espera { tags: string[] } con al menos un tag" },
      { status: 400 },
    );
  }

  const invalidados: string[] = [];
  const rechazados: string[] = [];

  for (const tag of tags) {
    if (typeof tag !== "string" || !tagPermitido(tag)) {
      rechazados.push(String(tag));
      continue;
    }
    // { expire: 0 } = expiración inmediata. Es el modo documentado para
    // webhooks externos que necesitan que el dato caduque ya.
    revalidateTag(tag, { expire: 0 });
    invalidados.push(tag);
  }

  if (rechazados.length) {
    console.warn("[revalidate] tags rechazados:", rechazados.join(", "));
  }

  // 200 aunque haya rechazados: el backend no debe reintentar por un typo.
  return Response.json({
    ok: true,
    invalidados,
    rechazados,
    ts: new Date().toISOString(),
  });
}
