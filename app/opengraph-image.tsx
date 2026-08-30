import { ImageResponse } from "next/og";

// Imagen OG de respaldo del sitio. La heredan todas las rutas que no definan
// su propia imagen (p. ej. un evento sin imagenPromocion). Generada en build
// y cacheada; sin runtime 'edge' (Node por defecto es lo correcto).

export const alt = "TaquillaVip";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE_APP = process.env.NEXT_PUBLIC_TITLE_APP || "TaquillaVip";

export default function Image() {
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
          background: "linear-gradient(135deg, #0E1A3D 0%, #1A56DB 100%)",
          color: "#F8FAFC",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.03em" }}>
          {TITLE_APP}
        </div>
        <div style={{ fontSize: 34, marginTop: 16, opacity: 0.85 }}>
          Boletos para conciertos, deportes y espectáculos
        </div>
      </div>
    ),
    size,
  );
}
