import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import { useContenidoStore } from "../../hooks/useContenidoStore";
import { useEventosStore } from "../../hooks/useEventosStore";
import { useAuthStore } from "../../hooks/useAuthStore";
import { formatDate } from "../../utils/dateHelpers";
import {
  Contadores,
  FiltrosPanelDraft,
  Reel,
  ReelCategoria,
  ReelCuando,
  ReelEvento,
  ReelFiltros,
} from "../types";
import { contarFiltrosActivos } from "../helpers/filtros";
import { mapsUrl, resolverDestino, RUTAS_REEL } from "../helpers/navegacion";
import { ReelSlide } from "../components/ReelSlide";
import { FiltrosPanel } from "../components/FiltrosPanel";
import { ChipsTiempo } from "../components/ChipsTiempo";
import { ReelInfoPanel } from "../components/ReelInfoPanel";
import { EstadoFeed, ReelSkeleton } from "../components/ReelStates";

const LIMIT = 6;
// Nombre de la marca. En código (.tsx) la sintaxis %VITE_TITLE_APP% NO se
// interpola (eso solo aplica en index.html); hay que leer import.meta.env.
const APP_NAME = process.env.NEXT_PUBLIC_TITLE_APP || "Taquilla VIP";

const prefiereMenosMovimiento = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const filtrosDesdeParams = (params: { get(key: string): string | null }): ReelFiltros => ({
  cuando: (params.get("cuando") as ReelCuando) || "",
  categoriaId: params.get("categoriaId") ? Number(params.get("categoriaId")) : null,
  precioMin: params.get("precioMin") ? Number(params.get("precioMin")) : null,
  precioMax: params.get("precioMax") ? Number(params.get("precioMax")) : null,
  ciudadId: params.get("ciudadId") ? Number(params.get("ciudadId")) : null,
  eventoId: params.get("eventoId") ? Number(params.get("eventoId")) : null,
});

export const ExplorarPage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { getFeed, getContadores, getCategorias, getPrecios, getEstadoLikes, toggleLike, registrarVista } =
    useContenidoStore();
  const { getDetalleEventos } = useEventosStore();
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  const [reels, setReels] = useState<Reel[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [paginaActual, setPaginaActual] = useState(0);
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(false);
  const [filtros, setFiltros] = useState<ReelFiltros>(() => filtrosDesdeParams(searchParams));
  const [draftPanel, setDraftPanel] = useState<FiltrosPanelDraft>(() => {
    const f = filtrosDesdeParams(searchParams);
    return { categoriaId: f.categoriaId, precioMin: f.precioMin, precioMax: f.precioMax };
  });
  const [categorias, setCategorias] = useState<ReelCategoria[]>([]);
  const [contadores, setContadores] = useState<Contadores | null>(null);
  const [preciosBounds, setPreciosBounds] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const feedRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const vistasRef = useRef<Set<number>>(new Set());
  const likesHydratedRef = useRef<Set<number>>(new Set());

  // El filtrado es server-side: los reels llegan ya filtrados.
  const displayReels = reels;
  const filtrosCount = contarFiltrosActivos(filtros);
  const activeReel = displayReels[activeIndex] ?? null;
  const hayMas = paginaActual < totalPaginas;

  // ---- Categorías para el filtro "Secciones" (una vez) ----
  useEffect(() => {
    let activo = true;
    getCategorias()
      .then((cats) => activo && setCategorias(cats))
      .catch(() => {});
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Contadores de los chips de tiempo ----
  // Se refrescan al cambiar categoría/precio/ciudad (NO al cambiar `cuando`).
  useEffect(() => {
    let activo = true;
    getContadores(filtros)
      .then((c) => activo && setContadores(c))
      .catch(() => {});
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.categoriaId, filtros.precioMin, filtros.precioMax, filtros.ciudadId, filtros.eventoId]);

  // ---- Límites del slider de precio ----
  // Se adapta al contexto (categoría en borrador + ciudad/cuándo aplicados),
  // así el rango refleja la categoría que estás eligiendo antes de aplicar.
  useEffect(() => {
    let activo = true;
    getPrecios({
      categoriaId: draftPanel.categoriaId,
      ciudadId: filtros.ciudadId,
      cuando: filtros.cuando,
      eventoId: filtros.eventoId,
    })
      .then((p) => activo && setPreciosBounds(p))
      .catch(() => {});
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPanel.categoriaId, filtros.ciudadId, filtros.cuando, filtros.eventoId]);

  // ---- Hidratación de likes ----
  // Marca los corazones de los reels ya likeados. Corre cuando hay reels nuevos
  // Y cuando `user` aparece (el feed puede cargar antes de que checkAuthToken
  // resuelva la sesión). Sin guard de cancelación a propósito: el setReels es
  // funcional y `getEstadoLikes` cambia de identidad cada render.
  useEffect(() => {
    if (!user) {
      likesHydratedRef.current.clear();
      return;
    }
    const pendientes = reels.filter((r) => !likesHydratedRef.current.has(r.id)).map((r) => r.id);
    if (pendientes.length === 0) return;
    pendientes.forEach((id) => likesHydratedRef.current.add(id));
    getEstadoLikes(pendientes)
      .then(({ likedIds }) => {
        if (!likedIds.length) return;
        const set = new Set(likedIds);
        setReels((prev) => prev.map((r) => (set.has(r.id) ? { ...r, liked: true } : r)));
      })
      .catch(() => {
        pendientes.forEach((id) => likesHydratedRef.current.delete(id));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reels, user]);

  // ---- Carga del feed ----
  // Reinicia y carga la página 1 cuando cambia CUALQUIER filtro server-side.
  useEffect(() => {
    let activo = true;
    setCargandoInicial(true);
    setError(false);
    vistasRef.current.clear();
    likesHydratedRef.current.clear();
    (async () => {
      try {
        const data = await getFeed(1, LIMIT, filtros);
        if (!activo) return;
        setReels(data.reels);
        setPaginaActual(data.paginacion.paginaActual);
        setTotalPaginas(data.paginacion.totalPaginas);
        setActiveIndex(0);
        feedRef.current?.scrollTo({ top: 0 });
      } catch {
        if (activo) setError(true);
      } finally {
        if (activo) setCargandoInicial(false);
      }
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filtros.cuando,
    filtros.categoriaId,
    filtros.precioMin,
    filtros.precioMax,
    filtros.ciudadId,
    filtros.eventoId,
    reloadKey,
  ]);

  // Carga la siguiente página (infinite scroll).
  const cargarMas = useCallback(async () => {
    if (cargandoMas || !hayMas) return;
    setCargandoMas(true);
    try {
      const next = paginaActual + 1;
      const data = await getFeed(next, LIMIT, filtros);
      setReels((prev) => [...prev, ...data.reels]);
      setPaginaActual(data.paginacion.paginaActual);
      setTotalPaginas(data.paginacion.totalPaginas);
    } catch {
      /* dejamos los reels ya cargados; el sentinel reintenta al re-observar */
    } finally {
      setCargandoMas(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargandoMas, hayMas, paginaActual, filtros]);

  // ---- Persistencia de filtros en query params ----
  useEffect(() => {
    const p = new URLSearchParams();
    if (filtros.cuando) p.set("cuando", filtros.cuando);
    if (filtros.categoriaId != null) p.set("categoriaId", String(filtros.categoriaId));
    if (filtros.precioMin != null) p.set("precioMin", String(filtros.precioMin));
    if (filtros.precioMax != null) p.set("precioMax", String(filtros.precioMax));
    if (filtros.ciudadId != null) p.set("ciudadId", String(filtros.ciudadId));
    if (filtros.eventoId != null) p.set("eventoId", String(filtros.eventoId));
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  // ---- Observer del reel activo ----
  useEffect(() => {
    const root = feedRef.current;
    if (!root || displayReels.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number((visible.target as HTMLElement).dataset.index);
          if (!Number.isNaN(idx)) setActiveIndex(idx);
        }
      },
      { root, threshold: 0.6 },
    );
    slideRefs.current.slice(0, displayReels.length).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [displayReels.length]);

  // ---- Observer de infinite scroll ----
  useEffect(() => {
    const root = feedRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) cargarMas();
      },
      { root, rootMargin: "600px 0px" },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, [cargarMas]);

  // ---- Registro de vista (una vez por reel) ----
  useEffect(() => {
    const reel = displayReels[activeIndex];
    if (!reel || vistasRef.current.has(reel.id)) return;
    vistasRef.current.add(reel.id);
    registrarVista(reel.id)
      .then((res) => {
        setReels((prev) =>
          prev.map((r) => (r.id === reel.id ? { ...r, vistasCount: res.vistasCount } : r)),
        );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, displayReels]);

  // ---- Acciones de navegación entre reels ----
  const scrollAReel = (idx: number) => {
    const el = slideRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: prefiereMenosMovimiento() ? "auto" : "smooth" });
  };
  const onPrev = () => activeIndex > 0 && scrollAReel(activeIndex - 1);
  const onNext = () => {
    if (activeIndex < displayReels.length - 1) scrollAReel(activeIndex + 1);
    else if (hayMas) cargarMas();
  };

  // ---- Likes ----
  const onLike = async (reel: Reel) => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    const { liked: prevLiked, likesCount: prevCount } = reel;
    const liked = !prevLiked;
    setReels((prev) =>
      prev.map((r) =>
        r.id === reel.id ? { ...r, liked, likesCount: prevCount + (liked ? 1 : -1) } : r,
      ),
    );
    try {
      const res = await toggleLike(reel.id);
      setReels((prev) =>
        prev.map((r) => (r.id === reel.id ? { ...r, liked: res.liked, likesCount: res.likesCount } : r)),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setReels((prev) =>
        prev.map((r) => (r.id === reel.id ? { ...r, liked: prevLiked, likesCount: prevCount } : r)),
      );
      if (e?.response?.status === 401) router.push("/auth/login");
    }
  };

  // ---- CTA ----
  const accentColor = () =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-accent-base").trim() ||
    "#023E8A";

  // Multi-función: el detalle necesita ?funcion=. El reel no trae las funciones,
  // así que las pedimos con el endpoint de detalle del evento y dejamos elegir.
  const elegirFuncion = async (evento: ReelEvento) => {
    const eventoId = evento.id as number;
    Swal.fire({ title: "Cargando fechas...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
      const detalle = await getDetalleEventos(String(eventoId));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const funciones: any[] = detalle?.funciones ?? [];
      Swal.close();
      if (funciones.length === 0) {
        router.push(RUTAS_REEL.detalle(evento));
        return;
      }
      const inputOptions = funciones.reduce((acc: Record<string, string>, f) => {
        const fecha = formatDate(f.fecha, "d 'de' MMMM yyyy, hh:mm a");
        acc[String(f.id)] = f.nombre ? `${f.nombre} · ${fecha}` : fecha;
        return acc;
      }, {});
      const res = await Swal.fire({
        title: "Selecciona una fecha",
        input: "select",
        inputOptions,
        inputPlaceholder: "Elige una función",
        showCancelButton: true,
        confirmButtonText: "Continuar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: accentColor(),
        inputValidator: (v) => (!v ? "Selecciona una fecha para continuar" : undefined),
      });
      if (res.isConfirmed && res.value) {
        // La funcion elegida viaja dentro del slug, no como query param.
        const elegida = funciones.find((f) => String(f.id) === String(res.value));
        router.push(RUTAS_REEL.detalle(evento, elegida));
      }
    } catch {
      Swal.fire({ icon: "error", title: "No se pudieron cargar las fechas", confirmButtonColor: accentColor() });
    }
  };

  const onCTA = (reel: Reel) => {
    const destino = resolverDestino(reel);
    switch (destino.tipo) {
      case "interno-detalle":
        router.push(RUTAS_REEL.detalle(destino.evento));
        break;
      case "interno-fechas":
        elegirFuncion(destino.evento);
        break;
      case "externo":
        Swal.fire({
          title: `Vas a salir de ${APP_NAME}`,
          text: `Este contenido te llevará a un sitio externo que no es administrado por ${APP_NAME}. ¿Deseas continuar?`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Continuar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: accentColor(),
        }).then((res) => {
          if (res.isConfirmed) window.open(destino.url, "_blank", "noopener,noreferrer");
        });
        break;
      default:
        break;
    }
  };

  const onVerMapa = (reel: Reel) => {
    const dir = reel.evento?.recinto?.direccion;
    if (dir) window.open(mapsUrl(dir), "_blank", "noopener,noreferrer");
  };

  // ---- Filtros ----
  const onCuando = (cuando: ReelCuando) => setFiltros((f) => ({ ...f, cuando }));
  const onChangeDraft = (patch: Partial<FiltrosPanelDraft>) =>
    setDraftPanel((d) => ({ ...d, ...patch }));
  const onAplicarFiltros = () => {
    setFiltros((f) => ({ ...f, ...draftPanel }));
    setFiltrosOpen(false);
  };
  const onLimpiarFiltros = () => {
    const limpio: FiltrosPanelDraft = { categoriaId: null, precioMin: null, precioMax: null };
    setDraftPanel(limpio);
    setFiltros((f) => ({ ...f, ...limpio }));
  };

  // ---- Render del centro del feed ----
  const renderFeed = () => {
    if (cargandoInicial) return <ReelSkeleton />;
    if (error)
      return (
        <EstadoFeed tipo="error" onAccion={() => setReloadKey((k) => k + 1)} accionLabel="Reintentar" />
      );
    if (displayReels.length === 0)
      return filtrosCount > 0 ? (
        <EstadoFeed tipo="sin-resultados" onAccion={onLimpiarFiltros} accionLabel="Limpiar filtros" />
      ) : (
        <EstadoFeed tipo="vacio" />
      );

    return (
      <div
        ref={feedRef}
        className="reel-feed h-full w-full snap-y snap-mandatory overflow-y-auto overflow-x-hidden"
      >
        {displayReels.map((reel, idx) => (
          <ReelSlide
            key={reel.id}
            reel={reel}
            idx={idx}
            activeIndex={activeIndex}
            muted={muted}
            filtrosOpen={filtrosOpen}
            filtrosCount={filtrosCount}
            hasPrev={idx > 0}
            hasNext={idx < displayReels.length - 1 || hayMas}
            registerRef={(el) => (slideRefs.current[idx] = el)}
            onCTA={onCTA}
            onVerMapa={onVerMapa}
            onLike={onLike}
            onToggleMute={() => setMuted((m) => !m)}
            onToggleFiltros={() => setFiltrosOpen((o) => !o)}
            onPrev={onPrev}
            onNext={onNext}
          />
        ))}
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
        {cargandoMas && (
          <div className="flex w-full justify-center py-4">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-gray-300 border-t-accentBase" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex h-[calc(100dvh-6rem)] overflow-hidden bg-gray-50">
      {/* Panel izquierdo (desktop): zona flexible que llena el costado izquierdo.
          Chips arriba-izquierda (grandes); la info del reel se centra
          verticalmente para alinear con el video. Misma anchura flex que la zona
          de filtros => video centrado. */}
      <aside className="hidden min-w-0 flex-1 flex-col overflow-y-auto py-8 pl-[clamp(2rem,4vw,3.5rem)] pr-6 lg:flex">
        <div className="w-full max-w-[30rem]">
          <ChipsTiempo
            cuando={filtros.cuando}
            contadores={contadores}
            variant="grid"
            onChange={onCuando}
          />
        </div>
        {activeReel && (
          <div className="flex w-full max-w-[30rem] flex-1 items-center">
            <ReelInfoPanel reel={activeReel} variant="panel" onCTA={onCTA} onVerMapa={onVerMapa} />
          </div>
        )}
      </aside>

      {/* Centro: feed de reels. Ancho fijo en desktop (reel 9:16 a ~46vh +
          carril/flechas); las zonas laterales flex-1 lo mantienen centrado. */}
      <div className="relative min-w-0 flex-1 lg:flex-none lg:w-[calc(46vh_+_12rem)]">
        {/* Chips de tiempo (mobile): barra superior horizontal */}
        <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/40 to-transparent p-3 lg:hidden">
          <ChipsTiempo
            cuando={filtros.cuando}
            contadores={contadores}
            variant="row"
            onChange={onCuando}
          />
        </div>

        {renderFeed()}
      </div>

      {/* Zona derecha (desktop): mismo flex-1 que el panel izquierdo, así reserva
          espacio simétrico y el video queda centrado y NO se mueve al abrir/cerrar.
          El panel se anima dentro de su zona (limitado a su ancho) y nunca tapa el
          rail de acciones del video. overflow-hidden oculta el panel cerrado. */}
      <aside className="hidden min-w-0 flex-1 justify-end overflow-hidden lg:flex">
        <div
          aria-hidden={!filtrosOpen}
          className={`h-full w-full max-w-[clamp(22rem,30vw,32rem)] transition duration-300 ease-out motion-reduce:transition-none ${
            filtrosOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
          }`}
        >
          <FiltrosPanel
            categorias={categorias}
            draft={draftPanel}
            bounds={preciosBounds}
            variant="panel"
            onChangeDraft={onChangeDraft}
            onAplicar={onAplicarFiltros}
            onLimpiar={onLimpiarFiltros}
            onClose={() => setFiltrosOpen(false)}
          />
        </div>
      </aside>

      {/* Filtros como hoja inferior (mobile) */}
      {filtrosOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 lg:hidden">
          <div className="absolute inset-0" onClick={() => setFiltrosOpen(false)} />
          <div className="reel-sheet relative h-[85dvh] w-full">
            <FiltrosPanel
              categorias={categorias}
              draft={draftPanel}
              bounds={preciosBounds}
              variant="sheet"
              onChangeDraft={onChangeDraft}
              onAplicar={onAplicarFiltros}
              onLimpiar={onLimpiarFiltros}
              onClose={() => setFiltrosOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplorarPage;
