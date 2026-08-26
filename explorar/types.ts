// Tipos del feed de contenido (reels). Reflejan el contrato del backend:
// docs/integracion/contenido/README.md (taquillavipbackend-v2).

export type ReelMediaTipo = "video" | "imagen";

export interface ReelMedia {
  id: number;
  tipo: ReelMediaTipo;
  url: string;
  thumbnailUrl: string | null;
  orden: number;
  ancho?: number;
  alto?: number;
  duracionSeg?: number;
}

export interface ReelRecinto {
  id: number;
  nombre: string;
  direccion: string;
  ciudad: string;
}

export interface ReelEvento {
  id: number | null; // null cuando es externo
  nombre: string;
  fecha: string | null;
  externo: boolean; // decide navegación
  url: string | null; // sólo si externo === true
  esMultiFuncion: boolean; // true => fechas/funciones
  recinto: ReelRecinto | null; // null en externos
}

export interface ReelCategoria {
  id: number;
  nombre: string;
}

export interface Reel {
  id: number;
  titulo: string;
  descripcion: string;
  textoBoton: string;
  categoria: ReelCategoria | null; // categoría del evento
  tags: string[]; // = [categoria.nombre] (compat)
  likesCount: number;
  vistasCount: number;
  liked: boolean; // siempre false en el feed; se hidrata con estado-likes
  evento: ReelEvento | null;
  media: ReelMedia[];
  fechaPublicacion: string;
}

export interface Paginacion {
  total: number;
  totalPaginas: number;
  paginaActual: number;
  itemsPorPagina: number;
}

export interface FeedResponse {
  reels: Reel[];
  paginacion: Paginacion;
}

export interface LikeResponse {
  liked: boolean;
  likesCount: number;
}

export interface EstadoLikesResponse {
  likedIds: number[];
}

export interface VistaResponse {
  vistasCount: number;
}

// Contadores por bucket de tiempo (chips Hoy/Mañana/Semana/Fin de semana).
export interface Contadores {
  hoy: number;
  manana: number;
  semana: number;
  finSemana: number;
  total: number;
}

export interface CategoriasResponse {
  categorias: ReelCategoria[];
  paginacion?: Paginacion;
}

// Límites de precio del conjunto filtrado. { min: 0, max: 0 } => sin boletaje.
export interface PreciosResponse {
  min: number;
  max: number;
}

// ---- Filtros del feed (TODOS server-side) ----

// Bucket de fecha del evento. "" = sin filtro de tiempo.
export type ReelCuando = "" | "hoy" | "manana" | "semana" | "fin_semana";

export interface ReelFiltros {
  cuando: ReelCuando; // chips de tiempo (aplica de inmediato)
  categoriaId: number | null; // categoría del evento
  precioMin: number | null; // rango de precio (solo internos con boletaje)
  precioMax: number | null;
  ciudadId: number | null; // ciudad del recinto
  eventoId: number | null; // reels de un evento puntual (deep link)
}

export const FILTROS_INICIALES: ReelFiltros = {
  cuando: "",
  categoriaId: null,
  precioMin: null,
  precioMax: null,
  ciudadId: null,
  eventoId: null,
};

// Parte del panel "Filtros" que se aplica con el botón "Aplicar filtros".
export type FiltrosPanelDraft = Pick<ReelFiltros, "categoriaId" | "precioMin" | "precioMax">;
