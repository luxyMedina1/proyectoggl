"use client";

// Boundary de errores de la app (Req: no había ninguno — ver AGENTS.md/docs de
// error.js). Envuelve todo `page.tsx` y `layout.tsx` anidado bajo la raíz
// (incluidos los flujos de checkout); NO cubre errores del propio
// `app/layout.tsx`, para eso está `global-error.tsx`. Debe ser Client Component.
//
// `retry` (no `reset`, prop estable desde Next 16.3.0): reintenta re-renderizar
// el segmento sin recargar toda la página — si el error fue transitorio (un
// fetch que falló una vez), el usuario recupera su lugar en el flujo.

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // TODO: mandar a un servicio de monitoreo de errores cuando exista uno
    // (hoy no hay ninguno configurado en el repo — Sentry, etc.).
    console.error("Error de la app:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-100 px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-800">Algo salió mal</h1>
      <p className="max-w-md text-gray-600">
        Tuvimos un problema al cargar esta parte de la página. Si estabas en medio de una compra,
        tu reserva no se pierde — intenta de nuevo.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => retry()}
          className="rounded-lg bg-accentBase px-4 py-2 font-medium text-neutral transition-colors hover:bg-accentLight"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
