"use client";

import { Suspense } from "react";
import { ExplorarPage } from "@/explorar";

// useSearchParams() (dentro de ExplorarPage) obliga a un boundary de Suspense en
// rutas prerenderizadas; sin el, `next build` falla con CSR bailout. Mismo patron
// que las otras rutas del repo que leen la query string.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ExplorarPage />
    </Suspense>
  );
}
