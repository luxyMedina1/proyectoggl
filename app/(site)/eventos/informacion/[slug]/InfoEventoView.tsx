"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEventosStore } from '../../../../../hooks/useEventosStore';
import { useAuthStore } from '../../../../../hooks/useAuthStore';
import { TbCalendarTime } from "react-icons/tb";
import { HiLocationMarker } from "react-icons/hi";
import { HiOutlineTicket } from "react-icons/hi2";
import { BsArrowDownCircleFill } from "react-icons/bs";
import { LuCalendarClock } from "react-icons/lu";
import { GoChevronRight } from "react-icons/go";
import { FaLocationArrow } from "react-icons/fa";
import Swal from 'sweetalert2';
import apiApplication from '../../../../../api/apiApplication';
import { formatDate, formatRangoHora } from '../../../../../utils/dateHelpers';
import { consultaMaps } from '../../../../../utils/mapsHelpers';
import { DireccionMapsLink } from '../../../../../components/DireccionMapsLink';
import { buildEventoSlug, rutaEvento, rutaEventoInformacion, type EventoResuelto } from '../../../../../utils/eventoSlug';
import LocalLoader from '../../../../../components/LocalLoader';

interface Ciudad {
  id: number;
  nombre: string;
}
interface Artista {
  id: number;
  nombre: string;
}
interface Recinto {
  id: number;
  nombre: string;
  direccion: string;
  latitud?: number | string | null;
  longitud?: number | string | null;
}
interface Evento {
  id: number;
  slug?: string | null;
  nombre: string;
  fecha: string;
  esMultiFuncion?: boolean;
  funciones?: any[];
  descripcion: string;
  recinto: Recinto;
  ciudad: Ciudad;
  imagenPromocion: string;
  artista: Artista;
}

// Puerto simplificado de infoEventoPage.tsx (v2). En v2 el mapa SVG (`renderSVG()`) esta
// comentado y el CTA de compra ya redirige a la pagina de detalle real (`rutaEvento`), asi
// que el modal de compra + integracion OpenPay duplicados en ese archivo (~1250 lineas) son
// codigo muerto: los `useEffect` que enganchan el click dependen de `.verify-section`, que
// nunca existe porque el SVG no se monta. Aqui solo se porta el camino realmente alcanzable:
// info de solo lectura + link a `/eventos/[slug]` para comprar.
export default function InfoEventoPage() {
  const router = useRouter();
  const { checkAuthToken, status } = useAuthStore();
  const { getDetalleEventos, resolverSlugEvento } = useEventosStore();
  const { slug } = useParams<{ slug: string }>();
  const [resuelto, setResuelto] = useState<EventoResuelto | null>(null);
  const id = resuelto?.eventoId;

  const [evento, setEvento] = useState<Evento | null>(null);
  const [cargando, setCargando] = useState(false);

  // Multifecha: abonos disponibles para el evento (mismo endpoint que usa el home).
  const [abonosEvento, setAbonosEvento] = useState<any[]>([]);
  const [cargandoAbonosEvento, setCargandoAbonosEvento] = useState(false);

  // Slug -> { eventoId, funcionId }. Sin resolver no hay nada que pedirle al back.
  useEffect(() => {
    let activo = true;
    (async () => {
      if (!slug) return;
      setCargando(true);
      try {
        const encontrado = await resolverSlugEvento(slug);
        if (!activo) return;
        if (encontrado) {
          setResuelto(encontrado);
        } else if (!resuelto) {
          setCargando(false);
          Swal.fire({ title: 'Evento no encontrado', text: 'El enlace no corresponde a un evento disponible.', icon: 'error', confirmButtonText: 'OK' });
        }
      } catch (error) {
        console.error('Error al resolver el slug del evento:', error);
        if (activo && !resuelto) setCargando(false);
      }
    })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    const fetchEvento = async () => {
      if (id) {
        setCargando(true);
        try {
          const response = await getDetalleEventos(id);
          setEvento(response);
        } catch (error: any) {
          console.error('Error al obtener el evento:', error);
          let mensajeError = 'Error al obtener el evento.';
          if (error.response && error.response.data && error.response.data.message) {
            mensajeError = error.response.data.message;
          } else if (error.message) {
            mensajeError = error.message;
          }
          Swal.fire({ title: 'Error', text: mensajeError, icon: 'error', confirmButtonText: 'OK' });
        } finally {
          setCargando(false);
        }
      }
    };
    fetchEvento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Canonicaliza la URL cuando se entro con el id suelto o con un slug desactualizado.
  useEffect(() => {
    if (!evento?.id || !slug) return;
    const canonico = buildEventoSlug(evento);
    if (!canonico || canonico === slug) return;
    router.replace(`/eventos/informacion/${canonico}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento, slug]);

  // El <title>, la description y los og:* de esta ruta los genera el servidor en
  // app/(site)/eventos/informacion/[slug]/page.tsx -> generateMetadata.

  useEffect(() => {
    if (status === 'checking') {
      checkAuthToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ---- Multifecha: mismo criterio que el catalogo/home ----
  // Funciones ordenadas por fecha (la respuesta puede venir desordenada).
  const funcionesOrdenadas: any[] = [...(evento?.funciones ?? [])].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
  );
  // Dias distintos: varias funciones el mismo dia cuentan una sola vez.
  const diasDistintosFunciones = new Set(
    funcionesOrdenadas.map((f: any) => formatDate(f.fecha, 'yyyy-MM-dd')),
  ).size;
  // "Multifecha" = esMultiFuncion y mas de un dia distinto.
  const esMultiFecha = !!evento?.esMultiFuncion && diasDistintosFunciones > 1;

  // Texto de fecha para la info de arriba. En multifecha se muestra un rango en vez de la
  // primera funcion. Ej: "12 al 15 de octubre de 2025" o, si cruza de mes,
  // "12 de octubre al 3 de noviembre de 2025".
  const textoFechaEncabezado = (): string => {
    if (esMultiFecha && funcionesOrdenadas.length > 0) {
      const primera = funcionesOrdenadas[0].fecha;
      const ultima = funcionesOrdenadas[funcionesOrdenadas.length - 1].fecha;
      const mismoMes = formatDate(primera, 'yyyy-MM') === formatDate(ultima, 'yyyy-MM');
      return mismoMes
        ? `${formatDate(primera, 'd')} al ${formatDate(ultima, "d 'de' MMMM 'de' yyyy")}`
        : `${formatDate(primera, "d 'de' MMMM")} al ${formatDate(ultima, "d 'de' MMMM 'de' yyyy")}`;
    }
    return evento?.fecha
      ? formatDate(evento.fecha, "EEEE, d 'de' MMMM 'de' yyyy, hh:mm a")
      : 'Fecha no disponible';
  };

  // Abonos del evento: se piden una sola vez, solo cuando el evento es multifecha.
  useEffect(() => {
    if (!esMultiFecha || !evento?.id) return;
    let activo = true;
    (async () => {
      setCargandoAbonosEvento(true);
      try {
        const { data } = await apiApplication.get(`/abonos/evento/${evento.id}`);
        if (!activo) return;
        if (Array.isArray(data)) setAbonosEvento(data);
        else if (data && data.abonos) setAbonosEvento(data.abonos);
        else if (data) setAbonosEvento([data]);
        else setAbonosEvento([]);
      } catch (error) {
        console.error('Error al obtener los abonos del evento:', error);
        if (activo) setAbonosEvento([]);
      } finally {
        if (activo) setCargandoAbonosEvento(false);
      }
    })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esMultiFecha, evento?.id]);

  return (
    <div>
      {cargando && (
        <LocalLoader />
      )}
      <div className='custom-banner'
        style={{ backgroundImage: `url(${evento?.imagenPromocion})` }}
      >
        <div className='glass'></div>
        <div className='container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 grid grid-cols-3 items-center gap-5'>
          <figure className='content col-span-3 lg:col-span-1'>
            <img className='imagen' src={evento?.imagenPromocion} alt="banner promocional" />
          </figure>
          <div className='grid content gap-y-4 col-span-3 lg:col-span-2'>
            <h1 className='text-5xl font-semibold text-white'>{evento?.artista?.nombre}</h1>
            <p className='text-2xl font-medium text-white'>{evento?.ciudad?.nombre}, {evento?.recinto?.nombre}.</p>
            <div className='mini-glass p-2 rounded-lg text-white text-lg inline-block w-fit font-light capitalize'>
              {textoFechaEncabezado()}
            </div>
          </div>
        </div>
      </div>
      {evento && (
        <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
          <div className='mb-3'>
            <h2 className="text-2xl font-semibold text-gray-800">Descripción del evento:</h2>
            <p className='text-lg text-gray-500'>{evento?.descripcion}</p>
          </div>
          <div className='mb-3'>
            <h2 className="text-2xl font-semibold text-gray-800">Fecha y hora:</h2>
            <p className='text-lg text-gray-500 flex items-center gap-x-2 capitalize'>
              <TbCalendarTime className='text-xl' />
              {textoFechaEncabezado()}
            </p>
            {esMultiFecha && (
              <p className='text-base text-gray-400 mt-1'>Apertura de puertas: varía según cada fecha. Consulta el detalle de cada función abajo.</p>
            )}
          </div>
          <div className='mb-3'>
            <h2 className="text-2xl font-semibold text-gray-800">Ubicación:</h2>
            <p className='text-lg text-gray-500 flex items-center gap-x-2'>
              <HiLocationMarker className='text-xl flex-none' />
              <DireccionMapsLink
                consulta={consultaMaps(evento?.recinto?.nombre, evento?.recinto?.direccion, evento?.ciudad?.nombre)}
                latitud={evento?.recinto?.latitud}
                longitud={evento?.recinto?.longitud}
                etiqueta={evento?.recinto?.nombre}
              >
                {evento?.recinto?.nombre}, {evento?.recinto?.direccion}
              </DireccionMapsLink>
            </p>
          </div>
          <div className='mb-3'>
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-x-5">
              <div className="border border-gray-400 grow rounded-full"></div>
              <p className="whitespace-nowrap text-center">Compra tus boletos: <span className='block font-normal text-base text-gray-500'>{esMultiFecha ? 'Elige una fecha o un abono' : 'Adquiere tus boletos aquí'}</span></p>
              <div className="border border-gray-400 grow rounded-full"></div>
            </h2>
          </div>

          {esMultiFecha ? (
            <div className='mb-10'>
              {/* Abonos disponibles */}
              {(cargandoAbonosEvento || abonosEvento.length > 0) && (
                <section className='mb-8'>
                  <div className='mb-4 flex items-center gap-x-4'>
                    <h3 className='whitespace-nowrap text-xl font-semibold text-gray-800 md:text-2xl'>Abonos de temporada</h3>
                    <div className='grow rounded-full border-t border-gray-200'></div>
                  </div>
                  <p className='mb-4 text-sm text-gray-500'>Un solo pase para asistir a varias fechas del evento.</p>
                  {cargandoAbonosEvento ? (
                    <div className='flex items-center justify-center py-10'>
                      <div className='h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-b-accentBase'></div>
                    </div>
                  ) : (
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                      {abonosEvento.map((abono: any) => {
                        const fechasAbono: any[] = [...(abono.funciones ?? [])].sort(
                          (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
                        );
                        return (
                          <Link
                            key={`abono-${abono.id}`}
                            href={`${rutaEvento(evento)}?isAbono=true&abonoId=${abono.id}`}
                            className='group flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accentBase hover:shadow-md'
                          >
                            <div className='mb-3 flex items-center gap-2'>
                              <span className='grid size-9 flex-none place-items-center rounded-xl bg-accentBase text-white'>
                                <HiOutlineTicket className='size-5' />
                              </span>
                              <p className='font-semibold text-gray-800'>{abono.nombre || 'Abono'}</p>
                            </div>
                            <div className='flex items-start gap-2 text-sm text-gray-600'>
                              <LuCalendarClock className='mt-0.5 size-4 flex-none text-gray-400' />
                              <div className='flex flex-col gap-0.5'>
                                {fechasAbono.slice(0, 4).map((f: any) => (
                                  <span key={f.id}>
                                    {formatDate(f.fecha, "d 'de' MMM")}{f.nombre ? ` · ${f.nombre}` : ''}
                                  </span>
                                ))}
                                {fechasAbono.length > 4 && (
                                  <span className='text-gray-400'>+{fechasAbono.length - 4} fechas más</span>
                                )}
                              </div>
                            </div>
                            <span className='mt-4 inline-flex items-center justify-center gap-1 rounded-xl bg-accentBase px-3 py-2 text-sm font-medium text-white transition-colors group-hover:bg-emphasis'>
                              Seleccionar abono
                              <GoChevronRight className='size-4' />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Listado de funciones (fechas) para comprar por separado */}
              <section>
                <div className='mb-4 flex items-center gap-x-4'>
                  <h3 className='whitespace-nowrap text-xl font-semibold text-gray-800 md:text-2xl'>Elige una fecha</h3>
                  <div className='grow rounded-full border-t border-gray-200'></div>
                </div>
                <p className='mb-4 text-sm text-gray-500'>Selecciona la función a la que quieres asistir para comprar tus boletos.</p>
                <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                  {funcionesOrdenadas.map((funcion: any) => (
                    <Link
                      key={funcion.id}
                      href={rutaEvento(evento, funcion)}
                      className='group flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accentBase hover:shadow-md'
                    >
                      <div className='flex items-center gap-4'>
                        <div className='grid size-16 flex-none place-items-center rounded-xl bg-accentBase/10 text-accentBase'>
                          <p className='text-center leading-none'>
                            <span className='block text-[11px] font-semibold uppercase tracking-wide'>{formatDate(funcion.fecha, 'MMM')}</span>
                            <span className='block text-2xl font-black text-gray-900'>{formatDate(funcion.fecha, 'dd')}</span>
                          </p>
                        </div>
                        <div className='min-w-0'>
                          {funcion.nombre && (
                            <p className='truncate font-semibold text-gray-800'>{funcion.nombre}</p>
                          )}
                          <p className='text-sm capitalize text-gray-600'>
                            {formatDate(funcion.fecha, 'EEEE')}
                            <span className='ml-1 font-light text-gray-500'>{formatRangoHora(funcion.fecha, funcion.finalEvento, 'HH:mm')}</span>
                          </p>
                          {funcion.aperturaPuertas && (
                            <p className='text-xs text-gray-400'>Apertura de puertas {formatDate(funcion.aperturaPuertas, 'HH:mm')}</p>
                          )}
                          {evento?.recinto?.nombre && (
                            <p className='mt-0.5 flex items-center gap-1.5 text-xs font-medium text-gray-500'>
                              {evento.recinto.nombre}
                              <span className='grid size-4 place-items-center rounded-full bg-accentLight'>
                                <FaLocationArrow className='size-1.5 text-white' />
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      <span className='grid size-9 flex-none place-items-center rounded-full bg-accentLight text-white transition-transform group-hover:translate-x-0.5'>
                        <GoChevronRight className='size-5' />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center my-5'>
              <BsArrowDownCircleFill className='animate-bounce text-accentBase text-5xl' />
              <Link className='text-accentBase text-base 2xl:text-lg border border-transparent hover:border-blue-700 transition-colors rounded-lg py-2 px-2 flex items-center w-fit gap-x-2 fade-up-item' href={rutaEvento(evento)}>Comprar boletos</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
