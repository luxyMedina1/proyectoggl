import apiApplication from "../api/apiApplication";
import {
  CategoriasResponse,
  Contadores,
  EstadoLikesResponse,
  FeedResponse,
  LikeResponse,
  PreciosResponse,
  Reel,
  ReelCategoria,
  ReelFiltros,
  VistaResponse,
} from "../explorar/types";

// Construye un query string omitiendo vacíos/null.
const qs = (obj: Record<string, unknown>) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  return p.toString();
};

// Capa "hook-as-service" para el contenido público (reels).
// Todas las llamadas pasan por la única instancia de axios (apiApplication),
// que ya inyecta x-api-key y Authorization. Ver:
// docs/integracion/contenido/README.md (taquillavipbackend-v2).
export const useContenidoStore = () => {
  // Feed paginado y anónimo. Acepta filtros server-side: cuando, categoriaId,
  // precioMin/Max, ciudadId, eventoId.
  const getFeed = async (
    page = 1,
    limit = 6,
    f: Partial<ReelFiltros> = {},
  ): Promise<FeedResponse> => {
    const query = qs({
      page,
      limit,
      cuando: f.cuando,
      categoriaId: f.categoriaId,
      precioMin: f.precioMin,
      precioMax: f.precioMax,
      ciudadId: f.ciudadId,
      eventoId: f.eventoId,
    });
    const { data } = await apiApplication.get<FeedResponse>(`/contenido/publico/feed?${query}`);
    return data;
  };

  // Contadores por bucket de tiempo. Mismos filtros que el feed EXCEPTO `cuando`.
  const getContadores = async (
    f: Omit<Partial<ReelFiltros>, "cuando"> = {},
  ): Promise<Contadores> => {
    const query = qs({
      categoriaId: f.categoriaId,
      precioMin: f.precioMin,
      precioMax: f.precioMax,
      ciudadId: f.ciudadId,
      eventoId: f.eventoId,
    });
    const { data } = await apiApplication.get<Contadores>(
      `/contenido/publico/feed/contadores?${query}`,
    );
    return data;
  };

  // Límites de precio del slider. Mismos filtros que el feed EXCEPTO precioMin/Max.
  const getPrecios = async (
    f: Omit<Partial<ReelFiltros>, "precioMin" | "precioMax"> = {},
  ): Promise<PreciosResponse> => {
    const query = qs({
      categoriaId: f.categoriaId,
      ciudadId: f.ciudadId,
      cuando: f.cuando,
      eventoId: f.eventoId,
    });
    const { data } = await apiApplication.get<PreciosResponse>(
      `/contenido/publico/feed/precios?${query}`,
    );
    return data;
  };

  // Categorías de evento para poblar el filtro "Secciones".
  const getCategorias = async (): Promise<ReelCategoria[]> => {
    const { data } = await apiApplication.get<CategoriasResponse>("/categorias/get_all");
    return data?.categorias ?? [];
  };

  // Detalle de un reel por id (deep link / share).
  const getDetalle = async (id: number): Promise<Reel> => {
    const { data } = await apiApplication.get<Reel>(`/contenido/publico/${id}`);
    return data;
  };

  // Hidratación de likes del usuario autenticado tras cargar el feed.
  const getEstadoLikes = async (ids: number[]): Promise<EstadoLikesResponse> => {
    const { data } = await apiApplication.post<EstadoLikesResponse>(
      "/contenido/publico/estado-likes",
      { ids },
    );
    return data;
  };

  // Toggle idempotente de like (requiere sesión).
  const toggleLike = async (id: number): Promise<LikeResponse> => {
    const { data } = await apiApplication.post<LikeResponse>(`/contenido/publico/${id}/like`);
    return data;
  };

  // Registro de vista (anónimo). Llamar una vez por reel al entrar al viewport.
  const registrarVista = async (id: number): Promise<VistaResponse> => {
    const { data } = await apiApplication.post<VistaResponse>(`/contenido/publico/${id}/vista`);
    return data;
  };

  return {
    getFeed,
    getContadores,
    getPrecios,
    getCategorias,
    getDetalle,
    getEstadoLikes,
    toggleLike,
    registrarVista,
  };
};
