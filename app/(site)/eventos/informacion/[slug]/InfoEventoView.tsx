"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEventosStore } from '../../../../../hooks/useEventosStore';
import { useAuthStore } from '../../../../../hooks/useAuthStore';
import { TbCalendarTime } from "react-icons/tb";
import { HiLocationMarker } from "react-icons/hi";
import { BsArrowDownCircleFill } from "react-icons/bs";
import Swal from 'sweetalert2';
import { formatDate } from '../../../../../utils/dateHelpers';
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
}
interface Evento {
  id: number;
  slug?: string | null;
  nombre: string;
  fecha: string;
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
              {evento?.fecha ? new Date(evento.fecha).toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) + ', ' + new Date(evento.fecha).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }) : 'Fecha no disponible'}
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
              {evento?.fecha ? new Date(evento.fecha).toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) + ', ' + new Date(evento.fecha).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }) : 'Fecha no disponible'}
            </p>
          </div>
          <div className='mb-3'>
            <h2 className="text-2xl font-semibold text-gray-800">Ubicación:</h2>
            <p className='text-lg text-gray-500 flex items-center gap-x-2'>
              <HiLocationMarker className='text-xl flex-none' />
              <DireccionMapsLink
                consulta={consultaMaps(evento?.recinto?.nombre, evento?.recinto?.direccion, evento?.ciudad?.nombre)}
              >
                {evento?.recinto?.nombre}, {evento?.recinto?.direccion}
              </DireccionMapsLink>
            </p>
          </div>
          <div className='mb-3'>
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-x-5">
              <div className="border border-gray-400 grow rounded-full"></div>
              <p className="whitespace-nowrap text-center">Compra tus boletos: <span className='block font-normal text-base text-gray-500'>Adquiere tus boletos aquí</span></p>
              <div className="border border-gray-400 grow rounded-full"></div>
            </h2>
          </div>
          <div className='flex flex-col items-center justify-center my-5'>
            <BsArrowDownCircleFill className='animate-bounce text-accentBase text-5xl' />
            <Link className='text-accentBase text-base 2xl:text-lg border border-transparent hover:border-blue-700 transition-colors rounded-lg py-2 px-2 flex items-center w-fit gap-x-2 fade-up-item' href={rutaEvento(evento)}>Comprar boletos</Link>
          </div>
        </div>
      )}
    </div>
  );
}
