"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useEventosStore } from "../../../hooks/useEventosStore";
import { useAuthStore } from "../../../hooks/useAuthStore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HiLocationMarker } from "react-icons/hi";
import { IoCartOutline } from "react-icons/io5";
import { TfiLayoutGrid2 } from "react-icons/tfi";
import { MdSportsTennis, MdPalette, MdLocalActivity } from "react-icons/md";
import { BsSpeakerFill } from "react-icons/bs";
import { HiOutlineTicket } from "react-icons/hi2";
import { GoChevronRight } from "react-icons/go";
import { GiSydneyOperaHouse } from "react-icons/gi";
import { FaRegEye } from "react-icons/fa";
import { BsFillClockFill } from "react-icons/bs";
import { FaLocationArrow } from "react-icons/fa";
import apiApplication from "../../../api/apiApplication";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import Swal from "sweetalert2";
import LocalLoader from "../../../components/LocalLoader";
import {
  formatDate,
  formatFechaConRango,
  formatHoraRelativa,
  formatRangoHora,
  eventoPasaFiltroFecha,
} from "../../../utils/dateHelpers";
import { consultaMaps } from "../../../utils/mapsHelpers";
import { DireccionMapsLink } from "../../../components/DireccionMapsLink";
import { rutaEvento, rutaEventoInformacion, rutaEventoPorBase } from "../../../utils/eventoSlug";
import { LuCalendarClock, LuDoorOpen } from "react-icons/lu";

// Normaliza texto para comparar sin acentos ni mayúsculas (búsqueda del header).
const normalizarTexto = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// Define la interfaz para el evento
interface Artista {
  id: number;
  nombre: string;
  genero: string;
}

interface FuncionEvento {
  id: number;
  fecha: string;
  nombre: string;
  aperturaPuertas?: string | null;
  finalEvento?: string | null;
}

interface Abono {
  id: number;
  nombre?: string;
  precio?: number | string;
  [key: string]: any;
}

interface Ciudad {
  id: number;
  nombre: string;
}

interface Recinto {
  id: number;
  nombre: string;
  direccion: string;
}

interface Evento {
  id: number;
  tipo: string;
  nombre: string;
  fecha: string;
  precioBase: string;
  descripcion: string | null;
  imagenPromocion: string;
  imagenBanner: string;
  artista: Artista;
  recinto: Recinto;
  asientosDisponibles: number;
  precioMin: string;
  precioMax: string;
  ciudad: Ciudad;
  categoria: string;
  esMultiFuncion?: boolean;
  funciones?: FuncionEvento[];
  aperturaPuertas?: string | null;
  finalEvento?: string | null;
}

export default function EventosPage() {
  return (
    <Suspense fallback={<LocalLoader />}>
      <EventosContent />
    </Suspense>
  );
}

// useSearchParams() exige un boundary de Suspense para el prerender estatico de Next.js
// (bailout de CSR) — el resto de la logica de HomePage.tsx (v2) queda igual dentro.
function EventosContent() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventosOriginales, setEventosOriginales] = useState<Evento[]>([]);
  const { getListaEventos } = useEventosStore();
  const [activeEvent, setActiveEvent] = useState<Evento | null>(null);
  interface Categoria {
    id: number;
    nombre: string;
  }

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<
    string | null
  >(null);
  const [filtroFecha, setFiltroFecha] = useState("");
  const [cargando, setCargando] = useState(false);

  const { status, isVerified } = useAuthStore();
  const searchParams = useSearchParams();
  const buscar = normalizarTexto(searchParams.get("buscar") ?? "");
  const [modalFuncionOpen, setModalFuncionOpen] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null);

  const [modalView, setModalView] = useState<'seleccionar_opcion' | 'fechas'>('seleccionar_opcion');
  const [abonosDisponibles, setAbonosDisponibles] = useState<Abono[]>([]);
  const [cargandoAbonos, setCargandoAbonos] = useState(false);

  const handleVerClick = async (e: React.MouseEvent, evento: Evento) => {
    if (evento.esMultiFuncion && evento.funciones && evento.funciones.length > 0) {

      e.preventDefault();
      setEventoSeleccionado(evento);
      setAbonosDisponibles([]);
      setModalFuncionOpen(true);

      if (status === "authenticated" && isVerified) {
        setModalView('seleccionar_opcion');
        // Fetch abonos
        setCargandoAbonos(true);
        try {
          const { data } = await apiApplication.get(`/abonos/evento/${evento.id}`);
          if (Array.isArray(data)) {
            setAbonosDisponibles(data);
          } else if (data && data.abonos) {
            setAbonosDisponibles(data.abonos);
          } else if (data) {
            setAbonosDisponibles([data]);
          }
        } catch (error) {
          console.error("Error cargando abonos:", error);
        } finally {
          setCargandoAbonos(false);
        }
      }else{
        setModalView('fechas');
      }
    }
  };

  const fetchEventos = useMemo(() => {
    return async () => {
      setCargando(true);
      try {
        const response = await getListaEventos();
        const eventos = response.eventosFiltrados;

        if (Array.isArray(eventos) && eventos.length > 0) {

          setEventosOriginales(eventos);
          setEventos(eventos);
          setActiveEvent(eventos[0]);

        } else {

          setEventos([]);
          setActiveEvent(null);

        }
      } catch (error: any) {
        console.error('Error al obtener los eventos:', error);
        let mensajeError = 'Error al obtener los eventos.';
        if (error.response && error.response.data && error.response.data.message) {
          mensajeError = error.response.data.message;
        } else if (error.message) {
          mensajeError = error.message;
        }
        Swal.fire({
          title: "Error",
          text: mensajeError,
          icon: "error",
          confirmButtonText: "OK",
        });
      } finally {
        setCargando(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const { data } = await apiApplication.get("/categorias/get_all");
        setCategorias(data.categorias);
      } catch (error) {
        console.error("Error al obtener las categorías:", error);
      }
    };
    fetchCategorias();
  }, []);

  const fechaFormateada = (date: string) => formatDate(date, "MMM - dd").toUpperCase();

  const filtrarPorFecha = (evento: any) =>
    eventoPasaFiltroFecha(evento.fecha, filtroFecha);

  const eventosFiltrados = eventos.filter((evento) => {
    const cumpleCategoria = categoriaSeleccionada
      ? evento.categoria === categoriaSeleccionada
      : true;
    const cumpleFecha = filtrarPorFecha(evento);
    const cumpleBusqueda = buscar
      ? normalizarTexto(evento.nombre ?? "").includes(buscar) ||
        normalizarTexto(evento.artista?.nombre ?? "").includes(buscar)
      : true;
    return cumpleCategoria && cumpleFecha && cumpleBusqueda;
  });

  const iconosCategorias: { [key: string]: React.ReactElement } = {
    deportes: <MdSportsTennis className="flex-none w-5" />,
    concierto: <BsSpeakerFill className="flex-none w-5" />,
    artes: <MdPalette className="flex-none w-5" />,
    conferencia: <MdPalette className="flex-none w-5" />,
    teatro: <GiSydneyOperaHouse className="flex-none w-5" />,
  };

  useEffect(() => {
    const countDownDate = new Date("May 17, 2025 13:00:00").getTime();
    const x = setInterval(function () {
      const now = new Date().getTime();
      const distance = countDownDate - now;
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      const countdownElement = document.getElementById("countdown");
      if (countdownElement) {
        countdownElement.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      }
      if (distance < 0) {
        clearInterval(x);
        if (countdownElement) {
          countdownElement.innerHTML = "¡Ya inició!";
        }
      }
    }, 1000);
    return () => clearInterval(x);
  }, []);

  // Primero, agrupa los eventos por tipo
  const eventosPorTipo = eventosFiltrados.reduce((acc, evento) => {
    const tipo = evento.tipo; // Asumiendo que tu evento tiene la propiedad 'tipo'
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(evento);
    return acc;
  }, {} as Record<string, typeof eventosFiltrados>);

  // Define los títulos y configuraciones para cada tipo
  const configPorTipo = {
    Comercial: {
      titulo: 'Próximos Eventos',
      rutaBase: '/eventos',
      botonTexto: 'Comprar boletos',
      botonIcono: <IoCartOutline className="text-xl item-hidden" />,
      mostrarOjo: true
    },
    Conferencia: {
      titulo: 'Próximas Conferencias',
      rutaBase: '/cosmotech',
      botonTexto: 'Ver conferencia',
      botonIcono: <FaRegEye className="text-xl item-hidden" />,
      mostrarOjo: false
    }
  };

  // Ordena las funciones y las agrupa por mes usando la TZ de la app.
  const agruparFunciones = (funciones: FuncionEvento[]): FuncionEvento[][] => {
    const ordenadas = [...funciones].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );

    const grupos: Record<string, FuncionEvento[]> = {};
    ordenadas.forEach((f) => {
      const key = formatDate(f.fecha, "yyyy-MM");
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(f);
    });

    return Object.values(grupos);
  };

  const gruposFechasEvento = (evento: Evento): FuncionEvento[][] =>
    agruparFunciones(evento.funciones ?? []);

  // En un evento multifuncion los horarios viven en las funciones: aunque solo quede una,
  // esa manda sobre la fecha plana del evento (que puede ser la de una funcion ya pasada).
  const horarioEvento = (evento: Evento): FuncionEvento | Evento => {
    const [primera] = gruposFechasEvento(evento).flat();
    return evento.esMultiFuncion && primera ? primera : evento;
  };

  // Badge: una fecha -> "OCT - 12"; varias -> rango "OCT - 12 AL 15" / "OCT - 12 AL NOV - 03".
  const badgeFechaEvento = (evento: Evento) => {
    if (!esMultiFecha(evento)) return fechaFormateada(horarioEvento(evento).fecha);

    const funciones = gruposFechasEvento(evento).flat();
    const primera = funciones[0].fecha;
    const ultima = funciones[funciones.length - 1].fecha;

    if (formatDate(primera, "yyyy-MM") === formatDate(ultima, "yyyy-MM")) {
      return `${fechaFormateada(primera)} AL ${formatDate(ultima, "dd")}`;
    }

    return `${fechaFormateada(primera)} AL ${fechaFormateada(ultima)}`;
  };

  // Dias distintos de un grupo (varias funciones el mismo dia cuentan una vez).
  const diasUnicosGrupo = (grupo: FuncionEvento[]) => [
    ...new Set(grupo.map((f) => formatDate(f.fecha, "d"))),
  ];

  const totalDiasEvento = (evento: Evento) =>
    gruposFechasEvento(evento).reduce(
      (total, grupo) => total + diasUnicosGrupo(grupo).length,
      0,
    );

  // Multifecha solo si hay mas de un dia distinto (varias funciones el mismo dia no cuentan).
  const esMultiFecha = (evento: Evento) =>
    !!evento.esMultiFuncion && totalDiasEvento(evento) > 1;

  // Apertura de puertas de la card. Con varias fechas cada funcion abre a su hora, asi que se
  // avisa que depende de la fecha en vez de mostrar la de la primera. Sin ninguna hora, no va.
  const aperturaPuertasCard = (evento: Evento) => {
    if (esMultiFecha(evento)) {
      const alguna = (evento.funciones ?? []).some((f) => !!f.aperturaPuertas);
      return alguna || evento.aperturaPuertas ? "varía según cada fecha" : null;
    }

    const horario = horarioEvento(evento);
    const apertura = horario.aperturaPuertas ?? evento.aperturaPuertas;

    return apertura ? formatHoraRelativa(apertura, horario.fecha) : null;
  };

  // Fecha de la card cuando el evento corre en un solo dia.
  const fechaCardEvento = (evento: Evento) => {
    const horario = horarioEvento(evento);
    return formatFechaConRango(horario.fecha, horario.finalEvento);
  };

  // Texto por mes: "12, 13, 15 de octubre de 2025" o la fecha completa si es un solo dia.
  const textoGrupoFechas = (grupo: FuncionEvento[]) => {
    const dias = diasUnicosGrupo(grupo);

    return dias.length > 1
      ? `${dias.join(", ")} de ${formatDate(grupo[0].fecha, "MMMM 'de' yyyy")}`
      : formatFechaConRango(
          grupo[0].fecha,
          grupo.length === 1 ? grupo[0].finalEvento : null,
        );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {cargando && <LocalLoader />}

      {/* Slider principal */}
      <div className='container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 inherit-mob'>
        <div className="w-full flex flex-col lg:flex-row h-80 md:h-80 mt-8 bg-emphasis rounded-2xl">
          <div className="w-full lg:w-1/2 flex flex-col justify-center p-4 lg:p-8 min-h-0">
            <h2 className="text-2xl md:text-3xl lg:text-5xl text-neutral font-bold mb-2 md:mb-4 line-clamp-none">
              {eventos.length > 0 ? activeEvent?.artista?.nombre || activeEvent?.nombre : "Próximamente"}
            </h2>
            <h3 className="text-lg md:text-xl lg:text-3xl text-neutral font-semibold mb-2 md:mb-4 line-clamp-none">
              {eventos.length > 0 ? activeEvent?.recinto?.nombre : "Eventos en breve"}
            </h3>
            {eventos.length > 0 ? (
              <Link
                href={activeEvent ? rutaEvento(activeEvent) : "/eventos"}
                onClick={(e) => {
                  if (activeEvent) handleVerClick(e, activeEvent);
                }}
                className="mt-1 md:mt-4 text-gray-50 border border-gray-200 inline-block w-fit px-3 py-2 md:px-4 md:py-3 rounded-lg text-sm md:text-lg hover:bg-neutral hover:text-accentBase transition-colors"
              >
                Ver entradas
              </Link>
            ) : (
              <p className="mt-1 md:mt-4 text-gray-200 text-sm md:text-lg">
                Mantente atento para nuevos eventos.
              </p>
            )}
          </div>

          <div className="w-full lg:w-1/2 h-48 lg:h-full rounded-b-2xl lg:rounded-r-2xl lg:rounded-b-none custom-swiper">
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              direction="horizontal"
              spaceBetween={30}
              slidesPerView={1}
              pagination={{
                clickable: true,
                dynamicBullets: true
              }}
              autoplay={{
                delay: 5000,
                disableOnInteraction: false
              }}
              touchRatio={1}
              grabCursor={true}
              onSlideChange={(swiper) =>
                setActiveEvent(eventos[swiper.activeIndex])
              }
              className="h-full rounded-b-2xl lg:rounded-r-2xl lg:rounded-b-none"
              breakpoints={{
                1024: {
                  direction: "vertical",
                  spaceBetween: 50
                }
              }}
            >
              {eventos.length > 0 ? (
                eventos.slice(0, 3).map((slide, index) => (
                  <SwiperSlide
                    key={index}
                    className="flex justify-center items-center h-48 lg:h-80 rounded-b-2xl lg:rounded-r-2xl lg:rounded-b-none"
                  >
                    <img
                      src={slide.imagenBanner || slide.imagenPromocion}
                      alt={slide.nombre}
                      className="block w-full h-48 lg:h-80 object-cover rounded-b-2xl lg:rounded-l-none lg:rounded-r-2xl polygon-shape"
                    />
                  </SwiperSlide>
                ))
              ) : (
                <SwiperSlide className="flex justify-center items-center h-48 lg:h-80 rounded-b-2xl lg:rounded-r-2xl lg:rounded-b-none">
                  <img
                    src="/event_default.webp"
                    alt="Eventos próximamente"
                    className="block w-full h-48 lg:h-80 object-cover rounded-b-2xl lg:rounded-l-none lg:rounded-r-2xl polygon-shape"
                  />
                </SwiperSlide>
              )}
            </Swiper>
          </div>
        </div>
      </div>
      {/* Fin slider principal */}

      {/* Filtros */}
      <section className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 mb-5 mt-5">
        <h2 className="text-center mt-5 text-2xl 2xl:text-3xl text-gray-900 font-bold mb-5">
          ¿Qué te gustaría hacer hoy? Encuentra tu evento ideal
        </h2>

        <div className="flex flex-col md:flex-row items-center gap-y-4 gap-x-8">
          <div className="w-full md:w-2/6 lg:w-1/6 bg-neutral rounded-full border border-gray-400 px-3 py-2">
            <select
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="bg-neutral text-gray-600 w-full"
            >
              <option className="bg-neutral" value="">
                Todas las fechas
              </option>
              <option className="bg-neutral" value="finDeSemana">
                Este fin de semana
              </option>
              <option className="bg-neutral" value="estaSemana">
                Esta semana
              </option>
              <option className="bg-neutral" value="proximaSemana">
                Próxima semana
              </option>
              <option className="bg-neutral" value="proximamente">
                Próximamente
              </option>
            </select>
          </div>
          <div className="w-full md:4/6 lg:w-5/6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCategoriaSeleccionada(null)}
              className={`hover:bg-accentLight text-neutral transition-colors py-2 px-3 rounded-full uppercase flex items-center gap-x-1 ${categoriaSeleccionada === null ? "bg-accentLight" : "bg-gray-400"}`}
            >
              <TfiLayoutGrid2 className="flex-none w-5" />
              Todos
            </button>
            {categorias?.map((categoria) => (
              <button
                key={categoria.id}
                onClick={() =>
                  setCategoriaSeleccionada(
                    categoria.nombre === categoriaSeleccionada
                      ? null
                      : categoria.nombre,
                  )
                }
                className={`hover:bg-accentLight text-neutral transition-colors py-2 px-3 rounded-full uppercase flex items-center gap-x-1 ${categoriaSeleccionada === categoria.nombre ? "bg-accentLight" : "bg-gray-400"}`}
              >
                {iconosCategorias[categoria.nombre.toLowerCase()] || (
                  <MdLocalActivity className="flex-none w-5" />
                )}
                {categoria.nombre}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Eventos */}
      <section className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 mt-2 lg:mt-8 mb-5">
        {Object.entries(eventosPorTipo).map(([tipo, eventos]) => {
          const config = configPorTipo[tipo as keyof typeof configPorTipo];

          return (
            <div key={tipo} className="mb-12">
              <h2 className="text-2xl 2xl:text-3xl font-bold text-gray-800 mb-4">
                {config?.titulo || `Eventos ${tipo}`}
              </h2>

              {eventos.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {eventos.map((evento) => (
                    <article
                      className="relative card-effect-hover flex flex-col hover:shadow-lg hover:rounded-lg pb-3"
                      key={evento.id}
                    >
                      <div className="bg-accentBase text-neutral z-10 absolute top-0 left-0 px-2 py-1 font-medium">
                        {badgeFechaEvento(evento)}
                      </div>

                      <figure className="relative bg-emphasis">
                        <Link href={rutaEventoPorBase(evento, config?.rutaBase)} onClick={(e) => handleVerClick(e, evento)}>
                          <img
                            className="custom-pic"
                            src={evento.imagenPromocion}
                            alt={evento.artista?.nombre || evento.nombre}
                          />
                        </Link>

                        {config?.mostrarOjo && (
                          <Link
                            href={rutaEventoInformacion(evento)}
                            className="btn-hidden"
                          >
                            <FaRegEye className="text-neutral" />
                          </Link>
                        )}
                      </figure>

                      <div className="px-3 flex flex-col gap-y-2">
                        <Link href={rutaEventoPorBase(evento, config?.rutaBase)} onClick={(e) => handleVerClick(e, evento)}>
                          <h3 className="text-xl 2xl:text-2xl font-bold text-gray-900 mt-2">
                            {evento.nombre}
                          </h3>
                        </Link>

                        <p className="text-gray-500 flex items-start gap-x-2 text-base">
                          <BsFillClockFill className="text-gray-600 text-lg flex-none w-6 mt-1" />
                          {esMultiFecha(evento) ? (
                            <span className="grow flex flex-col">
                              <span className="text-accentBase font-semibold text-sm">
                                Varias fechas ({totalDiasEvento(evento)})
                              </span>
                              {gruposFechasEvento(evento)
                                .slice(0, 2)
                                .map((grupo, index) => (
                                  <span key={index} className="text-sm">
                                    {textoGrupoFechas(grupo)}
                                  </span>
                                ))}
                              {gruposFechasEvento(evento).length > 2 && (
                                <span className="text-sm">
                                  y{" "}
                                  {gruposFechasEvento(evento)
                                    .slice(2)
                                    .reduce((total, grupo) => total + diasUnicosGrupo(grupo).length, 0)}{" "}
                                  fecha
                                  {gruposFechasEvento(evento)
                                    .slice(2)
                                    .reduce((total, grupo) => total + diasUnicosGrupo(grupo).length, 0) === 1
                                    ? ""
                                    : "s"}{" "}
                                  mas
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="grow">
                              {fechaCardEvento(evento)}
                            </span>
                          )}
                        </p>

                        {aperturaPuertasCard(evento) && (
                          <p className="text-gray-500 flex items-start gap-x-2 text-base">
                            <LuDoorOpen className="text-gray-600 text-lg flex-none w-6 mt-1" />
                            <span className="grow text-sm">
                              Apertura de puertas: {aperturaPuertasCard(evento)}
                            </span>
                          </p>
                        )}

                        <p className="text-gray-500 flex items-start gap-x-2 text-base">
                          <HiLocationMarker className="text-gray-600 text-xl flex-none w-6 mt-1" />
                          <span
                            className="grow min-w-0"
                            title={consultaMaps(evento.recinto?.nombre, evento.recinto?.direccion, evento.ciudad?.nombre)}
                          >
                            <DireccionMapsLink
                              className="block"
                              consulta={consultaMaps(
                                evento.recinto?.nombre,
                                evento.recinto?.direccion,
                                evento.ciudad?.nombre,
                              )}
                            >
                              {/* Recinto en una linea y direccion hasta dos: recorta con ... sin descuadrar la card. */}
                              <span className="block truncate">{evento.recinto?.nombre}</span>
                              <span className="block line-clamp-2">{evento.recinto?.direccion}</span>
                            </DireccionMapsLink>
                          </span>
                        </p>
                      </div>

                      <div className="px-3 mbs-auto">
                        <Link
                          className="text-accentBase mt-2 text-base 2xl:text-lg border border-transparent hover:border-accentBase transition-colors rounded-lg py-2 px-2 flex items-center w-fit gap-x-2 fade-up-item"
                          href={rutaEventoPorBase(evento, config?.rutaBase)}
                          onClick={(e) => handleVerClick(e, evento)}
                        >
                          {config?.botonTexto || 'Ver detalles'}
                          {config?.botonIcono}
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-2xl text-center">
                  No hay eventos disponibles en esta categoría.
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* Modal Multi Función / Abonos */}
      {modalFuncionOpen && eventoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
          <div className={`bg-white rounded-lg p-4 ${modalView === 'fechas' ? 'max-w-lg' : 'max-w-5xl'} w-full shadow-xl relative`}>
            <button
              onClick={() => setModalFuncionOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl"
            >
              &times;
            </button>
            <h3 className="text-xl md:text-2xl font-medium mb-2 text-center text-accentBase">
              {modalView === 'seleccionar_opcion' ? 'Selecciona una opción' : 'Selecciona una fecha'}
            </h3>
            <p className="text-gray-500 mb-6 text-center text-sm md:text-base font-normal">
              {modalView === 'seleccionar_opcion' ? `Elige un abono o una compra de boletos por separado para ${eventoSeleccionado.nombre}` : `Escoge una fecha a la cual comprar los boletos para ${eventoSeleccionado.nombre}`}
            </p>

            {modalView === 'seleccionar_opcion' && (
              <div className="max-h-80 overflow-y-auto flex flex-col gap-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300">
                {cargandoAbonos ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accentBase"></div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {/* Render Abonos if any */}
                    {abonosDisponibles.map((abono) => {
                      const grupos = agruparFunciones(abono.funciones ?? []);
                      return (
                        <div key={`abono-${abono.id}`} className="flex flex-col shadow-md rounded-xl bg-white border border-slate-200 p-2 md:p-3">
                          <figure className="w-full h-36 bg-slate-100 p-2 rounded-md">
                            <img className="w-full h-full object-contain mx-auto" src={abono.evento.imagen} alt="" />
                          </figure>
                          <div className="flex items-center gap-x-2 mb-4">
                            <div className="w-8 h-8 grid place-items-center bg-accentBase rounded-lg">
                              <HiOutlineTicket className="text-white flex-none size-5" />
                            </div>
                            <p className="text-slate-700 font-medium">{abono.nombre || 'Abono S/N'}</p>
                          </div>
                          <div className="flex items-center gap-x-2 mb-2">
                            <LuCalendarClock className="size-5 flex-none text-slate-600" />
                            <div className="flex flex-col">
                              {grupos.map((grupo, index) => (
                                <p key={index} className="text-sm text-slate-600">
                                  {textoGrupoFechas(grupo)}
                                </p>
                              ))}
                            </div>
                          </div>
                          <Link
                            href={`${rutaEvento(abono.evento)}?isAbono=true&abonoId=${abono.id}`}
                            className="mt-auto bg-accentBase hover:bg-accentLight text-white text-center rounded-xl px-3 py-2 transition-colors"
                          >
                            Seleccionar
                          </Link>
                        </div>
                      )
                    })}

                    {/* Button for Fechas */}
                    <div className="flex flex-col shadow-md rounded-xl bg-white border border-slate-200 p-2 md:p-3">
                      <figure className="w-full h-36 bg-slate-100 p-2 rounded-md">
                        <img className="w-full h-full object-contain mx-auto" src={eventoSeleccionado.imagenPromocion} alt="" />
                      </figure>
                      <div className="flex items-center gap-x-2 mb-4">
                        <div className="w-8 h-8 grid place-items-center bg-slate-500 rounded-lg">
                          <HiOutlineTicket className="text-white flex-none size-5" />
                        </div>
                        <p className="text-slate-700 font-medium">Boletos normales</p>
                      </div>
                      <div className="flex items-center gap-x-2 mb-2">
                        <LuCalendarClock className="size-5 flex-none text-slate-600" />
                        <div className="flex flex-col">
                          {gruposFechasEvento(eventoSeleccionado).map((grupo, index) => (
                                <p key={index} className="text-sm text-slate-600">
                                  {textoGrupoFechas(grupo)}
                                </p>
                              ))}
                        </div>
                      </div>
                      <button
                        onClick={() => setModalView('fechas')}
                        className="mt-auto bg-accentBase hover:bg-accentLight text-white text-center rounded-xl px-3 py-2 transition-colors"
                      >
                        <span className="text-base">Seleccionar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {modalView === 'fechas' && (
              <>
                <button
                  onClick={() => setModalView('seleccionar_opcion')}
                  className="mb-4 text-accentBase hover:text-accentLight text-sm font-medium flex items-center gap-1"
                >
                  ← Regresar a opciones
                </button>
                <div className="max-h-60 overflow-y-auto flex flex-col gap-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300">
                  {eventoSeleccionado.funciones?.map((funcion) => {
                    return <Link
                      key={funcion.id}
                      href={rutaEventoPorBase(eventoSeleccionado, configPorTipo[eventoSeleccionado.tipo as keyof typeof configPorTipo]?.rutaBase, funcion)}
                      className="border border-slate-200 px-4 py-3 rounded-xl shadow-sm flex flex-wrap justify-between items-center gap-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-slate-100 rounded-xl p-2">
                          <p className="text-base text-slate-700 font-normal text-center capitalize">
                            {formatDate(funcion.fecha, 'MMMM')}
                            <span className="block font-semibold">{formatDate(funcion.fecha, 'dd')}</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-base font-medium text-slate-700">{funcion.nombre || ''}</p>
                          <p className="text-sm text-slate-700 capitalize">{formatDate(funcion.fecha, 'EEEE')} <span className="font-light ml-1">{formatRangoHora(funcion.fecha, funcion.finalEvento, 'HH:mm')}</span></p>
                          {funcion.aperturaPuertas && (
                            <p className="text-sm text-slate-500">Apertura de puertas {formatDate(funcion.aperturaPuertas, 'HH:mm')}</p>
                          )}
                          <p className="text-base font-medium text-slate-700 flex items-center gap-2">
                            {eventoSeleccionado.recinto?.nombre}
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accentLight">
                              <FaLocationArrow className="size-2 flex-none text-neutral" />
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="grid place-items-center rounded-full bg-accentLight text-white p-2">
                        <GoChevronRight className="size-5" />
                      </div>
                    </Link>;
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
