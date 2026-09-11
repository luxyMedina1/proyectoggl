"use client";

// Boundary para errores del propio `app/layout.tsx` (el fetch de getSiteConfig,
// por ejemplo). `error.tsx` NO cubre esto — solo cubre lo que layout.tsx envuelve,
// no al layout mismo. Debe declarar sus propios <html>/<body> y NO hereda
// globals.css/fuentes/el theme de marca (layout.tsx es justo lo que falló), así
// que va con estilos en línea y colores fijos en vez de las clases de Tailwind
// del resto del repo.

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // TODO: mandar a un servicio de monitoreo de errores cuando exista uno.
    console.error("Error global de la app:", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#f3f4f6",
          color: "#1f2937",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
          No pudimos cargar el sitio
        </h1>
        <p style={{ maxWidth: 420, color: "#4b5563", margin: 0 }}>
          Hubo un problema al iniciar la página. Intenta de nuevo en unos segundos.
        </p>
        <button
          onClick={() => retry()}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "0.5rem 1rem",
            fontWeight: 600,
            color: "#fff",
            background: "#023E8A",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
