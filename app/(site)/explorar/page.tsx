"use client";

import { Suspense } from "react";
import { ExplorarPage } from "@/explorar";

// useSearchParams() (dentro de ExplorarPage) obliga a un boundary de Suspense en
// rutas prerenderizadas; sin el, `next build` falla con CSR bailout. Mismo patron
// que las otras rutas del repo que leen la query string.
export default function Page() {
  return (
    // El fallback es lo unico que entra en el HTML prerenderizado (ExplorarPage
    // hace bailout de CSR por useSearchParams). Con `null` el footer nacia pegado
    // al header y saltaba al hidratar el feed -> CLS ~0.7 movil. El spacer reserva
    // el mismo alto fijo que usa ExplorarPage (`h-[calc(100dvh-6rem)]`), asi el
    // relevo fallback -> contenido no mueve nada.
    <Suspense
      fallback={<div className="h-[calc(100dvh-6rem)] bg-gray-50" aria-hidden="true" />}
    >
      <ExplorarPage />
    </Suspense>
  );
}
