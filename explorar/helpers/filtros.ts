import { ReelFiltros } from "../types";

// Todo el filtrado es server-side (el feed acepta cuando/categoriaId/precio/ciudad).
// Aquí sólo se cuenta cuántos filtros hay activos para el badge.
export const contarFiltrosActivos = (f: ReelFiltros): number =>
  [
    f.cuando !== "",
    f.categoriaId != null,
    f.precioMin != null,
    f.precioMax != null,
    f.ciudadId != null,
    f.eventoId != null,
  ].filter(Boolean).length;
