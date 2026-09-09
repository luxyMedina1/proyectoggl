import { ImageResponse } from "next/og";
import { getSiteConfig } from "@/lib/config/getSiteConfig";

// Imagen OG de respaldo del sitio. La heredan todas las rutas que no definan
// su propia imagen (p. ej. un evento sin imagenPromocion). Generada en build
// y cacheada; runtime Node por defecto (hace falta para descargar el logo).
//
// Dibuja el logo de la marca (config:sitio) sobre el degradado de marca. El
// logo real vive en un <img> embebido dentro del SVG `logoMarca`, así que se
// extrae ese PNG en alta resolución. Si el backend no responde o el asset no
// trae raster, cae al diseño de solo texto: nunca rompe el build.

export const alt = "TaquillaVip";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE_APP = process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip";
const TAGLINE = "Boletos para conciertos, deportes y espectáculos";

const esRaster = (tipo: string): boolean => /^image\/(png|jpeg)/.test(tipo);

// Devuelve el logo como data URI PNG/JPEG (lo que Satori sabe pintar), o null.
// - SVG: se extrae el primer <image href="data:image/..."> incrustado.
// - PNG/JPEG: se usa tal cual.
async function cargarLogo(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      cache: "force-cache",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const tipo = (res.headers.get("content-type") ?? "").split(";")[0].trim();

    if (tipo === "image/svg+xml" || url.toLowerCase().endsWith(".svg")) {
      const svg = await res.text();
      const m = svg.match(/href="(data:image\/(?:png|jpeg);base64,[^"]+)"/i);
      return m ? m[1] : null;
    }
    if (esRaster(tipo)) {
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      return `data:${tipo};base64,${b64}`;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const { config, colors } = await getSiteConfig();
  const nombre = config?.nombreMarca?.trim() || TITLE_APP;
  const logoSrc =
    (await cargarLogo(config?.logoMarca as string | undefined)) ||
    (await cargarLogo(config?.logo as string | undefined));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${colors.emphasis} 0%, ${colors.accentBase} 100%)`,
          color: "#F8FAFC",
          fontFamily: "sans-serif",
        }}
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} width={620} height={91} alt={nombre} />
        ) : (
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.03em" }}>
            {nombre}
          </div>
        )}
        <div style={{ fontSize: 34, marginTop: 32, opacity: 0.85 }}>{TAGLINE}</div>
      </div>
    ),
    size,
  );
}
