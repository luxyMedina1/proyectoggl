"use client";

import { Suspense, useEffect, useState, useRef } from 'react';
import { useParams, usePathname, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useEventosStore } from '../../../../hooks/useEventosStore';
import { useAuthStore } from '../../../../hooks/useAuthStore';
import { useMetaPixel, usePixelsDeEvento } from '../../../../hooks/useMetaPixel';
import { useAuthModal } from '../../../../context/AuthModalContext';
import { TbTicket } from "react-icons/tb";
import { MdKeyboardBackspace } from "react-icons/md";
import { IoIosClose } from "react-icons/io";
import { IoTrashOutline } from "react-icons/io5";
import { FiMinus, FiPlus } from "react-icons/fi";
import Swal from 'sweetalert2';
import apiApplication from '../../../../api/apiApplication';
import { formatDate, formatFechaConRango, formatHoraRelativa } from '../../../../utils/dateHelpers';
import { validarNumeroTarjeta, validarCVC } from '../../../../utils/cardHelpers';
import { sanitizeRichText } from '../../../../utils/sanitizeHtml';
import { buildEventoSlug, type EventoResuelto } from '../../../../utils/eventoSlug';
import LocalLoader from '../../../../components/LocalLoader';
import { LuBadgeCheck } from "react-icons/lu";
import ListaPreciosCategorias from '../../../../eventos/components/ListaPreciosCategorias';
import { formatearDinero } from '../../../../eventos/helpers/formatearDinero';
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Autoplay, Navigation } from "swiper/modules";
import { toast } from 'react-toastify';

declare global {
  interface Window {
    OpenPay: any;
  }
}

interface Asiento {
  id: number;
  numero: string;
  estado: 'disponible' | 'vendido' | 'bloqueado';
}
interface Fila {
  id: number;
  nombre: string;
  categoria: string;
  asientos: Asiento[];
}
interface Seccion {
  id: number;
  nombre: string;
  precioAdicional: string;
  asientosDisponibles: number;
  filas: Fila[];
  tipo_seccion: 'general' | 'numerada' | 'suite' | 'mesas';
  color: string;
}
interface Recinto {
  id: number;
  nombre: string;
  svg: string;
  direccion: string;
  esGeneral?: boolean;
}
interface Evento {
  id: number;
  slug?: string | null;
  nombre: string;
  fecha: string;
  aperturaPuertas?: string | null;
  finalEvento?: string | null;
  funciones?: any[];
  precioBase: string;
  recinto: Recinto;
  secciones: Seccion[];
  descripcion: string;
  ciudad: Ciudad;
  imagenPromocion: string;
  artista: Artista;
  preciosCategorias: Categorias[];
  limiteDeAsientos: number;
  udsPorCategoria: boolean;
  esGratuito: boolean;
  usoDeServicio: string;
  // Pixels de Meta del promotor de este evento (ademas de los de la marca).
  metaPixels?: string[];
}
interface Ciudad {
  id: number;
  nombre: string;
}
interface Artista {
  id: number;
  nombre: string;
}
interface Secciones {
  id: number;
  nombre: string;
  asientosDisponibles: number;
  precioSeccion: string;
  tipo_seccion: 'general' | 'numerada' | 'suite' | 'mesas';
  precioAdicional: string;
  bloque: string;
  color: string;
  disponiblesPorCategoria: [];
  colores: string[];
  seccionesAdicionales: [];
  nombreEspecial: string;
  uds: string;
  colorGeneral: string;
}
interface Categorias {
  precios: [];
  categoria: string;
  color: string,
}
interface ModalProps {
  id: number;
  nombre: string;
  tipo_seccion: 'general' | 'numerada' | 'suite' | 'mesas';
  asientosDisponibles: number;
  bloque: string;
  nombreEspecial: string;
}
interface TarjetaGuardada {
  id: number,
  idtarjeta: string;
  tarjeta: string;
  banco: string;
}

interface promocion {
  id: number;
  nombre: string;
  tipo: 'PORCENTAJE' | 'CANTIDAD';
  porcentaje: number;
  cantidadCompra: number;
  cantidadPaga: number;
  aplicaTodoEvento: boolean;
  categorias: { categoriaGeneral: { nombre: string } }[];
  descuentoCalculado: number;
}

export default function DetalleEventoPage() {
  return (
    <Suspense fallback={<LocalLoader />}>
      <DetalleEventoContent />
    </Suspense>
  );
}

function DetalleEventoContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { slug } = useParams<{ slug: string }>();
  // La URL solo lleva el slug (`tuff-riders`, `sky-fest-laguna-7-matutino`). El back lo
  // traduce a ids con resolverSlugEvento; hasta que responde no hay nada que pedir.
  const [resuelto, setResuelto] = useState<EventoResuelto | null>(null);
  const id = resuelto?.eventoId;
  const { checkAuthToken, user, status } = useAuthStore();
  const { requestLogin } = useAuthModal();
  const [reservaPendiente, setReservaPendiente] = useState(false);
  const searchParams = useSearchParams();
  const isAbono = slug?.includes('abono') || searchParams.get('isAbono') === 'true';
  const { getDetalleEventos, getDetalleEventoSecciones, reservarGeneral, cancelar, getDetalleAbono, getAbonoBuilderState, setAbonoBuilderState, clearAbonoBuilderState, resolverSlugEvento } = useEventosStore();
  // La funcion sale del slug. `?funcion=` se sigue leyendo por los enlaces internos viejos.
  const funcionId = resuelto?.funcionId ?? searchParams.get('funcion');
  const { verContenido } = useMetaPixel();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [funciones, setFunciones] = useState<any[]>([]);
  const [modoAbono, setModoAbono] = useState<'mismo_asiento' | 'por_funcion'>('mismo_asiento');
  const [currentFuncionIndex, setCurrentFuncionIndex] = useState(0);
  const [seleccionesAbono, setSeleccionesAbono] = useState<any[]>([]);
  const [secciones, setSecciones] = useState<Secciones[] | null>(null);
  const [seccionesOcultas, setSeccionesOcultas] = useState<Secciones[] | null>(null);
  const [seccionesAdicionales, setSeccionesAdicionales] = useState<Secciones[] | null>(null);
  const [preciosCategorias, setPreciosCategorias] = useState<Categorias[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [boletos, setBoletos] = useState(1);
  const [limite, setLimite] = useState(1);
  const [precioBoletos, setPrecioBoletos] = useState(0);
  const [modalProps, setModalProps] = useState<ModalProps | null>(null);
  const [deviceDataId, setDeviceDataId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tarjetas, setTarjetas] = useState<TarjetaGuardada[]>([]);
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState<string | null>(null);
  const [emailUsuario, setEmailUsuario] = useState<string | null>(null);
  const [reservaExitosa, setReservaExitosa] = useState<boolean>(false);
  const [usuarioInvitado, setUsuarioInvitado] = useState<boolean>(false);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [tiempoRestante, setTiempoRestante] = useState<number | null>(null);
  const [fechaExpiracion, setFechaExpiracion] = useState<number | null>(null);
  const [step, setStep] = useState(1);
  const [seccionId, setSeccionId] = useState(0);
  const [formValues, setFormValues] = useState({ nombre: '', tarjeta: '', expiracion: '', cvv: '', nombre_invitado: '', correo_invitado: '' });
  const [expiracion, setExpiracion] = useState("");
  const [expirationYear, setExpirationYear] = useState("");
  const [expirationMonth, setExpirationMonth] = useState("");
  const [udt, setUdt] = useState<number>(0);
  const [uds, setUds] = useState<number>(0);
  const [iva, setIva] = useState<number>(0);
  const [ivaApplied, setIvaApplied] = useState(false);
  const [tabMetodo, setTabMetodo] = useState('nueva_tarjeta');
  const [cargando, setCargando] = useState(false);
  const [compraExitosa, setCompraExitosa] = useState(false);
  const [tooltip, setTooltip] = useState<{ visible: boolean, text: string, x: number, y: number }>({
    visible: false,
    text: "",
    x: 0,
    y: 0
  });
  const [eventoActivo, setEventoActivo] = useState(false);

  // Codigos de descuento
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPorcent, setDiscountPorcent] = useState(0);
  const [promocion_id, setPromocionID] = useState(0);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [habilitaPromocion, setHabilitaPromocion] = useState(false);
  const [promocionesAplicanDirecto, setPromocionesAplicanDirecto] = useState<any[]>([]);
  const [promosAplicables, setPromosAplicables] = useState<any[]>([]);
  const [promocion, setPromocion] = useState<promocion>({ id: 0, nombre: '', tipo: 'PORCENTAJE', porcentaje: 0, cantidadCompra: 0, cantidadPaga: 0, aplicaTodoEvento: false, categorias: [], descuentoCalculado: 0 });
  const [descripcionAdicional, setDescripcionAdicional] = useState('');

  // Pixels de Meta: los de la marca ya estan activos desde ColorContext; aqui se suma el del
  // promotor de este evento, y solo mientras la pagina siga montada — al navegar al evento
  // siguiente no queremos seguir reportandole al promotor anterior.
  usePixelsDeEvento(evento?.metaPixels);

  useEffect(() => {
    if (!evento?.id) return;
    verContenido({
      eventoId: evento.id,
      nombre: evento.nombre,
      precioUnitario: Number(evento.precioBase) || undefined,
    });
    // Solo el id: al cambiar de funcion no es una vista de contenido nueva.
  }, [evento?.id, evento?.nombre, evento?.precioBase, verContenido]);

  // Slug -> { eventoId, funcionId }. Si el slug no existe se avisa una sola vez; cuando ya
  // habia algo resuelto (p. ej. tras canonicalizar la URL) se conserva lo anterior.
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
          habilitarpromocion(id);

          let response;
          if (isAbono) {
            // El id en la ruta ahora es el del EVENTO (para el mapa),
            // el del ABONO viene por query param si se seleccionó desde el home.
            const aId = searchParams.get('abonoId') || id;

            // Obtener detalles del abono (fechas, etc) usando el ID del abono
            const abonoRes = await getDetalleAbono(aId);
            if (abonoRes.funciones) {
              setFunciones(abonoRes.funciones);
            }

            // Obtener detalles del evento (SVG, etc) usando el ID del evento asociado al abono
            // Si el abonoRes trae un eventoId o similar, usarlo. Si no, probar con el mismo ID.
            const eventoId = abonoRes.eventoId || abonoRes.evento?.id || id;
            const eventoRes = await getDetalleEventos(eventoId.toString());

            // Mezclar ambos: priorizar abono para info general pero mantener el recinto/svg del evento
            response = { ...eventoRes, ...abonoRes };

            // Inicializar builder si no existe
            const saved = getAbonoBuilderState();
            const aIdNum = Number(aId);
            const idNum = Number(id);
            if (saved && (saved.abonoId === idNum || saved.abonoId === aIdNum)) {
              setModoAbono(saved.modo);
              const partials = saved.seleccionesParciales || [];
              setSeleccionesAbono(partials);
              // Auto-moverse a la siguiente fecha pendiente
              if (saved.modo === 'por_funcion' && abonoRes.funciones) {
                const pendingIndex = abonoRes.funciones.findIndex((f: any) =>
                  !partials.some((s: any) => s.funcionId === f.id)
                );
                if (pendingIndex !== -1) setCurrentFuncionIndex(pendingIndex);
              }
            } else {
              setAbonoBuilderState({
                abonoId: aIdNum,
                modo: 'mismo_asiento',
                seleccionesParciales: []
              });
            }
          } else {
            response = await getDetalleEventos(id);
            if (funcionId && response.funciones) {
              const funcion = response.funciones.find((f: any) => f.id.toString() === funcionId);
              if (funcion) {
                // La funcion elegida manda: su horario pisa el del evento.
                response.fecha = funcion.fecha;
                response.aperturaPuertas = funcion.aperturaPuertas ?? response.aperturaPuertas ?? null;
                response.finalEvento = funcion.finalEvento ?? response.finalEvento ?? null;
              }
            } else if (response.funciones?.length === 1) {
              // Multifuncion al que solo le queda una funcion: se entra sin elegir fecha, asi
              // que su horario es el que vale y no la fecha plana del evento.
              const [unica] = response.funciones;
              response.fecha = unica.fecha ?? response.fecha;
              response.aperturaPuertas = unica.aperturaPuertas ?? response.aperturaPuertas ?? null;
              response.finalEvento = unica.finalEvento ?? response.finalEvento ?? null;
            }
          }

          setEventoActivo(true);
          const parsedUdt = parseFloat(response.usoDeTarjeta);
          const parsedUds = parseFloat(response.usoDeServicio);
          setUdt(parsedUdt);
          setUds(parsedUds);
          setIva(parseFloat(response.ivaRate));
          setIvaApplied(response.isIvaApplied);
          setEvento(response);
          setLimite(response.limiteDeAsientos);
          setDescripcionAdicional(response.descripcionExtra);
        } catch (error: any) {
          console.error('Error al obtener el evento:', error);
          let mensajeError = 'Error al obtener el evento.';
          if (error.response && error.response.data && error.response.data.message) {
            mensajeError = error.response.data.message;
          } else if (error.message) {
            mensajeError = error.message;
          }
          Swal.fire({ title: 'Error', text: mensajeError, icon: 'error', confirmButtonText: 'OK', });
        } finally {
          setCargando(false);
        }
      }
    };
    fetchEvento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Funcion activa: su nombre y su dia entran al slug para que cada fecha de un evento
  // multifecha tenga su propia URL al compartirla.
  const funcionActiva =
    (funcionId && evento?.funciones?.find((f: any) => String(f.id) === funcionId)) || null;

  const funcionSecciones: string | number | null = isAbono
    ? (((modoAbono === 'por_funcion' ? funciones[currentFuncionIndex] : funciones[0]) ?? funciones[0])?.id ?? null)
    : (funcionId ?? evento?.funciones?.[0]?.id ?? null);

  const esperandoFuncionSecciones = isAbono ? funcionSecciones == null : (!funcionId && !evento);

  // Canonicaliza la URL: si se entro por `/eventos/123` (QR, enlace viejo) o con un slug
  // desactualizado, se reemplaza por el slug actual. No vuelve a pedir el evento porque el
  // efecto de arriba depende del id, que no cambia al reescribir la URL.
  useEffect(() => {
    // En modo abono el `evento` viene mezclado con la respuesta del abono (el id puede ser
    // el del abono), asi que ahi se deja la URL tal cual: no es la URL que se comparte.
    if (isAbono || !evento?.id || !slug) return;
    const canonico = buildEventoSlug(evento, funcionActiva);
    if (!canonico) return;
    // La funcion ya viaja en el slug, asi que `?funcion=` sale de la URL; el resto de los
    // query params se conserva.
    const resto = new URLSearchParams(searchParams.toString());
    resto.delete('funcion');
    const query = resto.toString();
    const destino = `/eventos/${canonico}${query ? `?${query}` : ''}`;
    if (destino === `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`) return;
    router.replace(destino);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento, funcionActiva, slug, searchParams]);

  // El <title>, la description y los og:* de esta ruta los genera el servidor en
  // app/(site)/eventos/[slug]/page.tsx -> generateMetadata (utils/ogEvento.ts).

  useEffect(() => {
    const fetchSecciones = async () => {
      if (id && !esperandoFuncionSecciones) {
        try {
          const response = await getDetalleEventoSecciones(id, funcionSecciones);

          setSecciones(response.secciones);
          setSeccionesOcultas(response.seccionesOcultas);

          // Filtrar solo las secciones que tienen un nombreEspecial válido
          const adicionalesConNombreEspecial = response.secciones.filter(
            (seccion: any) => seccion.seccionAdicional != null && seccion.seccionAdicional !== 0
          );
          setSeccionesAdicionales(adicionalesConNombreEspecial);

          // Ordenar los precios de cada categoría y de mayor a menor y si son iguales priorizar izquierda
          const categoriasOrdenadas = (response.preciosCategorias ?? [])
            .map((categoria: any) => ({
              ...categoria,
              precios: (categoria.precios ?? []).filter((p: number) => p > 0).sort((a: number, b: number) => b - a),
            }))
            .sort((a: any, b: any) => {
              const precioA = a.precios[0] ?? 0;
              const precioB = b.precios[0] ?? 0;

              if (precioA !== precioB) {
                return precioB - precioA;
              }

              // Si los precios son iguales, priorizar los que tienen izquierda en el nombre
              const nombreA = a.categoria.toLowerCase();
              const nombreB = b.categoria.toLowerCase();

              const tieneIzquierdaA = nombreA.includes("izquierda");
              const tieneIzquierdaB = nombreB.includes("izquierda");

              if (tieneIzquierdaA && !tieneIzquierdaB) return -1;
              if (!tieneIzquierdaA && tieneIzquierdaB) return 1;

              return nombreA.localeCompare(nombreB);
            });
          setPreciosCategorias(categoriasOrdenadas);
        } catch (error: any) {
          console.error('Error al obtener las secciones:', error);
          let mensajeError = 'Error al obtener las secciones.';
          if (error.response && error.response.data && error.response.data.message) {
            mensajeError = error.response.data.message;
          } else if (error.message) {
            mensajeError = error.message;
          }
          const result = await Swal.fire({
            title: 'Error',
            text: mensajeError,
            icon: 'error',
            confirmButtonText: 'OK',
            allowOutsideClick: false,
            allowEscapeKey: false,
          });

          if (result.isConfirmed) {
            window.location.href = '/eventos';
          }
        }
      }
    };
    fetchSecciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, funcionSecciones, esperandoFuncionSecciones]);

  // dar funcionalidad al svg
  useEffect(() => {
    if (!containerRef.current || !evento || !secciones) return;

    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;

    const defs = svg.querySelector("defs") || document.createElementNS("http://www.w3.org/2000/svg", "defs");

    // Limpiar gradientes anteriores para evitar acumulación
    defs.innerHTML = "";

    const sections = containerRef.current.querySelectorAll(".verify-section");

    sections.forEach((section, index) => {
      const seccionData = secciones.find((s: Secciones) =>
        s.nombre.toLowerCase() === section.id.toLowerCase() &&
        s.bloque.toLowerCase() === (section.attributes.getNamedItem("bloque")?.value.toLowerCase() || "")
      );

      const currentClasses = new Set(section.getAttribute("class")?.split(" ") || []);

      if (seccionData) {
        currentClasses.delete("st0");
        currentClasses.delete("non-interactive-section");
        currentClasses.add("cursor-pointer");
        currentClasses.add("interactive-section");

        if (Array.isArray(seccionData.colores) && seccionData.colores.length > 0) {
          if (seccionData.colores.length === 1) {
            // Si solo hay un color, usarlo directamente
            section.setAttribute("style", `fill: ${seccionData.colores[0]};`);
          }else {
            // Crear un ID único para el gradiente de esta sección
            const gradientId = `gradiente-${index}`;

            // Crear el elemento `linearGradient`
            const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
            gradient.setAttribute("id", gradientId);
            gradient.setAttribute("x1", "0%");
            gradient.setAttribute("y1", "0%");
            gradient.setAttribute("x2", "100%");
            gradient.setAttribute("y2", "100%");

            // Agregar los colores al gradiente
            seccionData.colores.forEach((color, i) => {
              const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
              stop.setAttribute("offset", `${(i / (seccionData.colores.length - 1)) * 100}%`);
              stop.setAttribute("stop-color", color);
              gradient.appendChild(stop);
            });

            // Agregar el gradiente a `defs`
            defs.appendChild(gradient);

            // Asignar el `fill` con referencia al gradiente
            section.setAttribute("style", `fill: url(#${gradientId});`);
          }
        }

        section.setAttribute("class", Array.from(currentClasses).join(" "));
        section.addEventListener("click", handleSectionClick);
      } else {
        const seccionOculta = seccionesOcultas?.find((s: Secciones) =>
          s.nombre.toLowerCase() === section.id.toLowerCase() &&
          s.bloque.toLowerCase() === (section.attributes.getNamedItem("bloque")?.value.toLowerCase() || "")
        );

        section.removeEventListener("click", handleSectionClick);
        if (seccionOculta) {
          section.setAttribute("style", "opacity: 0;");
        } else {
          section.setAttribute("class", "st0 verify-section non-interactive-section");
        }
      }
    });

    // Asegurar que `defs` esté dentro del SVG
    if (!svg.querySelector("defs")) {
      svg.prepend(defs);
    }

    return () => {
      sections.forEach((section) => {
        section.removeEventListener("click", handleSectionClick);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento, secciones]);

  useEffect(() => {

    const getCredenciales = async () => {
      const res = await apiApplication.get('/pagos/get/credenciales');
      const { data } = res;
      return data;
    }

    const scriptOpenPay = document.createElement('script');
    scriptOpenPay.src = 'https://resources.openpay.mx/lib/openpay.v1.min.js';
    scriptOpenPay.async = false;
    scriptOpenPay.onload = () => {
      const scriptDeviceData = document.createElement('script');
      scriptDeviceData.src = 'https://resources.openpay.mx/lib/openpay-data-js/1.2.38/openpay-data.v1.min.js';
      scriptDeviceData.async = false;
      scriptDeviceData.onload = async () => {
        if (window.OpenPay) {
          const { merchantId, publicKey, sandbox } = await getCredenciales();
          window.OpenPay.setId(merchantId);
          window.OpenPay.setApiKey(publicKey);
          window.OpenPay.setSandboxMode(sandbox);

          const id = window.OpenPay.deviceData.setup('formId');
          setDeviceDataId(id);
        } else {
          console.error('La librería OpenPay no se ha cargado correctamente');
        }
      };
      document.body.appendChild(scriptDeviceData);
    };

    document.body.appendChild(scriptOpenPay);

    // Opcional: limpiar los scripts al desmontar el componente
    return () => {
      document.body.removeChild(scriptOpenPay);
    };
  }, []);

  if (status === 'checking') {
    checkAuthToken();
  }

  const handleModalClose = (e: any) => {
    setIsModalOpen(false); // Cerrar el modal
    setBoletos(1);
    // Cancelar también
    handleCancelarCompra(e);
    setDiscountCode('');
    setDiscountAmount(0);
  };

  const handleBoletosChange = (e: any) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= limite) {
      setBoletos(value);
    }
  };

  const habilitarpromocion = async (id_evento_web: string) => {

    const params = {
      evento_id: parseInt(id_evento_web)
    };

    const res = await apiApplication.post('/promociones/validar_promo_web', params);

    if (res.data.total > 0) {
      setHabilitaPromocion(true);
      if (res.data.promocionesAplicaDirecto && res.data.promocionesAplicaDirecto.length > 0) {
        setPromocionesAplicanDirecto(res.data.promocionesAplicaDirecto);
      }
    } else {
      setHabilitaPromocion(false);
    }

  };

  const handleExpiracionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 2) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}`;
    }
    setExpiracion(value);

    if (value.length === 5) {
      setExpirationMonth(value.slice(0, 2));
      setExpirationYear(value.slice(3, 5));
    }
  };

  const handleSectionClick = (event: Event) => {
    const target = event.currentTarget as SVGElement;

    if (!target.classList.contains('interactive-section')) return;


    const seccion = secciones?.find((s: Secciones) =>
      s.nombre.toLowerCase() === (target.id.toLowerCase()) &&
      s.bloque.toLowerCase() === (target.attributes.getNamedItem('bloque')?.value.toLowerCase() || '')
    );

    if (seccion) {
      // Resetear clases de secciones
      const sections = containerRef.current?.querySelectorAll('.verify-section');
      sections?.forEach(section => {
        section.classList.remove('section-animated');
        section.classList.remove('opacity-20');
      });

      // Resaltar sección seleccionada
      target.classList.add('section-animated');

      if (seccion.tipo_seccion != 'general') {
        if (isAbono) {
          const fId = funcionSecciones ?? id;
          const aId = searchParams.get('abonoId') || id;
          router.push(`/abonos/${slug}/${seccion.id}/${seccion.nombre}?funcionId=${fId}&abonoId=${aId}`);
        } else {
          // La funcion ya viaja dentro del slug del evento.
          router.push(`/eventos/${evento ? buildEventoSlug(evento, funcionActiva) : slug}/${seccion.id}/${seccion.nombre}`);
        }
      } else {
        setPrecioBoletos(+seccion.precioSeccion); // Asignar el precio de la sección
        setIsModalOpen(true);
        setModalProps(seccion);
        if (evento && evento.udsPorCategoria) setUds(parseFloat(seccion.uds));
        if (promocionesAplicanDirecto.length > 0) {
          const promocionesFiltradas = filtrarPromocionesAplicables(promocionesAplicanDirecto, seccion.nombreEspecial);
          setPromosAplicables(promocionesFiltradas);
        }
        setSeccionId(seccion.id);
      }

    }
  };

  const filtrarPromocionesAplicables = (promociones: any, categoria: string) => {
    return promociones.filter((promo: { aplicaTodoEvento: any; categorias: any[]; }) => {
      // Si aplica a todo el evento, siempre es válida
      if (promo.aplicaTodoEvento) {
        return true;
      }

      const categoriasGenerales = promo.categorias.map(c => c.categoriaGeneral?.nombre).filter(c => c !== null && c !== undefined);

      // Si no aplica a todo el evento, verificar si la categoría está incluida
      return categoriasGenerales && categoriasGenerales.includes(categoria);
    });
  };

  const obtenerMejorPromocion = (promocionesAplicables: any[], cantidadBoletos: number, precioBoleto: number): promocion | null => {
    if (!promocionesAplicables || promocionesAplicables.length === 0) {
      return null;
    }

    let mejorPromocion = null;
    let mayorDescuento = 0;

    promocionesAplicables.forEach(promo => {
      let descuentoTotal = 0;

      if (promo.tipo === "PORCENTAJE") {
        descuentoTotal = (precioBoleto * cantidadBoletos * promo.porcentaje) / 100;
      }
      else if (promo.tipo === "CANTIDAD") {
        const gruposCompletos = Math.floor(cantidadBoletos / promo.cantidadCompra);
        const boletosGratis = gruposCompletos * (promo.cantidadCompra - promo.cantidadPaga);
        descuentoTotal = boletosGratis * precioBoleto;
      }

      if (descuentoTotal > mayorDescuento) {
        mayorDescuento = descuentoTotal;
        mejorPromocion = {
          ...promo,
          descuentoCalculado: descuentoTotal,
          precioFinal: (precioBoleto * cantidadBoletos) - descuentoTotal
        };
      }
    });

    return mejorPromocion;
  };

  useEffect(() => {
    if (!containerRef.current || !evento) return;

    const sections = containerRef.current.querySelectorAll('.verify-section');

    sections.forEach(section => {
      const seccion = secciones?.find((s: Secciones) =>
        s.nombre.toLowerCase() === section.id.toLowerCase() &&
        s.bloque.toLowerCase() === (section.attributes.getNamedItem("bloque")?.value.toLowerCase() || "")
      );

      if (seccion) {
        section.classList.add("cursor-pointer", "interactive-section");
        (section as HTMLElement).dataset.nombre = seccion.nombre;
        (section as HTMLElement).dataset.tipo_seccion = seccion.tipo_seccion;
        (section as HTMLElement).dataset.asientosDisponibles = seccion.asientosDisponibles != null ? seccion.asientosDisponibles.toString() : '';


        // Extraer `disponiblesPorCategoria` desde la misma `seccion`
        const disponiblesPorCategoria = seccion.disponiblesPorCategoria
          ? JSON.stringify(seccion.disponiblesPorCategoria)
          : "[]";

        (section as HTMLElement).dataset.disponiblesPorCategoria = disponiblesPorCategoria;

        section.addEventListener('click', handleSectionClick);
        section.addEventListener("mouseenter", handleMouseEnter as EventListener);
        section.addEventListener("mouseleave", handleMouseLeave as EventListener);
      } else {
        section.classList.remove("cursor-pointer", "interactive-section");
        section.removeEventListener('click', handleSectionClick);
        section.removeEventListener("mouseenter", handleMouseEnter as EventListener);
        section.removeEventListener("mouseleave", handleMouseLeave as EventListener);
      }
    });

    return () => {
      sections.forEach(section => {
        section.removeEventListener('click', handleSectionClick);
        section.removeEventListener("mouseenter", handleMouseEnter as EventListener);
        section.removeEventListener("mouseleave", handleMouseLeave as EventListener);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento, secciones]);

  const handleMouseEnter = (event: MouseEvent) => {
    const section = event.target as HTMLElement;
    const nombre = section.dataset.nombre || "Desconocido";
    const bloque = section.dataset.tipo_seccion || "Sin tipo";

    // Convertir `disponiblesPorCategoria` de string a array
    const disponiblesPorCategoria = section.dataset.disponiblesPorCategoria
      ? JSON.parse(section.dataset.disponiblesPorCategoria)
      : [];

    // Generar HTML dinámico con las categorías y disponibles
    const disponiblesTexto = disponiblesPorCategoria.length
      ? disponiblesPorCategoria.map((cat: { categoria: string | null, disponibles: number | null }) =>
        `Categoría: ${cat.categoria ?? "General"} (Disponibles: ${cat.disponibles ? cat.disponibles : "Agotado"})`
      ).join("<br>")
      : "Sin categorías disponibles";

    setTooltip({
      visible: true,
      text: `
        Sección: ${nombre} <br>
        Tipo: ${bloque} <br>
        ${disponiblesTexto}`,
      x: event.pageX + 10,
      y: event.pageY + 10
    });
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const renderSVG = () => {
    if (!evento?.recinto?.svg) {
      console.log('No hay SVG disponible');
      return null;
    }

    const cleanSvg = evento.recinto.svg
      .replace(/^'|'$/g, '')
      .replace(/'\+\s*'/g, '')
      .replace(/\r\n\t/g, '')
      .replace('<style type="text/css">', `<style type="text/css">
        .st0 {
          fill-opacity: 0.3;
          cursor: not-allowed;
        }
        .interactive-section {
          cursor: pointer;
        }
      `);

    return (
      <div
        ref={containerRef}
        className="w-full max-w-4xl mx-auto relative"
        dangerouslySetInnerHTML={{ __html: cleanSvg }}
      />
    );
  };

  const nextStep = async () => {
    // Solo avanza al paso de pago si la reserva se hizo (si cancelan el login, no avanza).
    const reservado = await handleReservarAsientos();
    if (reservado) setStep((prevStep) => prevStep + 1);
  };

  const handleComprarGratis = async (reservaId: string) => {
    try {
      setCargando(true);

      let resdata: any;
      try {
        const { data } = await apiApplication.post(`/eventos/${evento?.id}/gratis`, {
          esInvitado: usuarioInvitado,
          esGeneral: true,
          reservaId: reservaId,
          email: usuarioInvitado ? formValues.correo_invitado : user?.email,
          nombre: usuarioInvitado ? formValues.nombre_invitado : user?.fullName
        });
        resdata = data;
      } catch (error: any) {
        setCargando(false);
        console.error("Error al completar la compra gratuita:", error);
        Swal.fire({
          title: 'Error',
          text: error.response?.data?.message || 'Ocurrió un error al completar la compra gratuita. Por favor, intenta nuevamente.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }


      if (resdata) {
        setCargando(false);
        Swal.fire({
          title: '¡Éxito!',
          text: 'Tu reserva gratuita se ha completado con éxito.  Tus boletos estan disponibles en la app movil.',
          icon: 'success',
          confirmButtonText: 'OK'
        }).then(() => {
          window.location.reload();
        });
      }
    } catch (error) {
      console.error(error)
    }
  };

  // Tras iniciar sesión en el modal, reintenta la reserva automáticamente (sin salir de la página).
  useEffect(() => {
    if (reservaPendiente && user) {
      setReservaPendiente(false);
      handleReservarAsientos().then((reservado) => {
        if (reservado) setStep((prevStep) => prevStep + 1);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaPendiente, user]);

  const handleReservarAsientos = async (): Promise<boolean> => {
    let reservado = false;

    // Si no hay sesión, abre el modal de login (sin navegar) y continúa al iniciar sesión.
    if (!user) {
      setCargando(false);
      const ok = await requestLogin();
      if (ok) setReservaPendiente(true);
      return false;
    }

    try {

      setCargando(true);

      if (evento?.id) {
        const response = await reservarGeneral(boletos, evento?.id.toString(), seccionId);
        if (response && response.id) {
          setReservaExitosa(true);
          setReservaId(response.id);
          reservado = true;

          if (user) {
            setUsuarioInvitado(false);
            try {
              setCargando(true);
              const has_user = await apiApplication.get("/pagos/get/mi_perfil");
              setOpenId(has_user.data.idOpenpay);
              setTarjetas(has_user.data.tarjetas);
              setEmailUsuario(has_user.data.usuario.email);
              setCargando(false);
            } catch (error) {
              const resp = await apiApplication.post("/pagos/save/usuario");
              setOpenId(resp.data.idOpenpay);
              setCargando(false);
              console.error("Error al obtener/crear OpenPay ID", error);
            }

          }

          let mejorPromocion;
          if (discountCode == '') {
            mejorPromocion = obtenerMejorPromocion(promosAplicables, boletos, precioBoletos);
            if (mejorPromocion) {
              setPromocion(mejorPromocion);
              setDiscountPorcent(mejorPromocion.porcentaje);
              setPromocionID(mejorPromocion.id);
              setDiscountAmount(mejorPromocion.descuentoCalculado);
            }
          }

          // Obtener la fecha de expiración
          const fechaExp = new Date(response.fechaExpiracion).getTime();
          setFechaExpiracion(fechaExp);

          // Calcular tiempo restante inicial
          const ahora = new Date().getTime();
          const tiempoRestante = Math.max(0, Math.floor((fechaExp - ahora) / 1000));
          setTiempoRestante(tiempoRestante);

          // Iniciar temporizador correctamente
          const intervalId = setInterval(() => {
            setTiempoRestante(prev => {
              if (prev === null || prev <= 0) {
                clearInterval(intervalId);
                Swal.fire({
                  title: '¡Atención!',
                  text: 'El tiempo de tu reserva ha expirado. La página se recargará.',
                  icon: 'warning',
                  timer: 2000,
                  showConfirmButton: false
                }).then(() => window.location.reload());
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

        } else {
          setReservaExitosa(false);
          Swal.fire({
            title: '¡Atención!',
            text: 'Uno o más asientos ya no están disponibles. Por favor, actualiza la página.',
            icon: 'warning',
            confirmButtonText: 'OK'
          });
          window.location.reload();  // En lugar de recargar la página
          return false;
        }
      }

    } catch (error: any) {
      setCargando(false);
      setIsModalOpen(false);
      console.error("Error en la reserva:", error);
      Swal.fire({
        title: 'Atención!',
        text: error.message || 'Ocurrió un error al reservar. Por favor, intenta nuevamente.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }

    return reservado;
  };

  const handleEliminarTarjeta = async (tarjetaId: string) => {
    try {
      const { isConfirmed } = await Swal.fire({
        title: "¿Estás seguro?",
        text: "Esta acción eliminará tu método de pago de forma permanente.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
      });

      if (!isConfirmed) {
        return;
      }
      const has_user = await apiApplication.get("/pagos/get/mi_perfil");
      const clienteId = has_user.data.idOpenpay;
      if (!has_user.data.idOpenpay) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No puedes eliminar la tarjeta porque no tiene un usuario Openpay.', });
        return;
      }
      const res = await apiApplication.delete(`/pagos/tarjeta/${clienteId}/${tarjetaId}`);
      Swal.fire({ icon: 'success', title: 'Tarjeta eliminada', text: res.data.message });
      setTarjetas(tarjetas => tarjetas.filter(tarjeta => tarjeta.idtarjeta !== tarjetaId));
    } catch (error) {
      console.error('Error al eliminar la tarjeta:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al eliminar la tarjeta. Por favor, inténtalo de nuevo.' });
    }
  };

  const handleCancelarCompra = async (e: any) => {
    e.preventDefault();
    try {
      if (evento?.id && reservaId) {
        const response = await cancelar(reservaId.toString(), evento?.id.toString(), true);
        if (response) {
          Swal.fire({ title: '¡Atención!', text: 'La reserva se ha cancelado.', icon: 'warning', timer: 2000, showConfirmButton: false }).then(() => {
            window.location.reload();
          });
        } else {
          Swal.fire({ title: 'Error', text: 'No se pudo cancelar la reserva. Inténtalo de nuevo.', icon: 'error', confirmButtonText: 'OK' });
        }
      }
    } catch (error) {
      Swal.fire({ title: 'Error', text: 'Ocurrió un error al cancelar la reserva.', icon: 'error', confirmButtonText: 'OK' });
    }
  };

  const procesarPago = async () => {
    try {
      setCargando(true);

      // 🛑 CONFIRMAR PAGO ANTES DE PROCESARLO
      const confirmacionPago = await Swal.fire({
        title: "¿Confirmar compra?",
        text: `Vas a pagar $${calcularTotal()} por tus boletos. ¿Quieres continuar?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, pagar",
        cancelButtonText: "Cancelar",
      });

      if (!confirmacionPago.isConfirmed) {
        setCargando(false);
        return; // 🚨 Detener si el usuario cancela
      }

      // Construcción del payload del pago
      const payload: any = {
        reservaId: reservaId,
        esGeneral: true,
        tipoDispositivo: "web",
        source_id: tarjetaSeleccionada || "",
        tarjeta: tarjetaSeleccionada
          ? undefined
          : {
            card_number: formValues.tarjeta,
            holder_name: formValues.nombre,
            expiration_year: expirationYear,
            expiration_month: expirationMonth,
            cvv2: formValues.cvv,
            device_session_id: deviceDataId,
          },
        amount: calcularTotal(),
        device_session_id: deviceDataId,
        redirect_url: "/",
        nombre_invitado: formValues.nombre_invitado,
        correo_invitado: formValues.correo_invitado,
        promocion_id
      };

      // Agregar usuarioOpenpayId solo si se usa una tarjeta guardada
      if (tarjetaSeleccionada) {
        payload.usuarioOpenpayId = openId;
      }

      // 🛑 PREGUNTAR SI DESEA GUARDAR LA TARJETA (SOLO SI ES NUEVA)
      if (!tarjetaSeleccionada && !usuarioInvitado) {
        const { isConfirmed } = await Swal.fire({
          title: "¿Quieres guardar tu tarjeta?",
          text: "Podrás usarla en futuras compras sin necesidad de ingresarla nuevamente.",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Sí, guardar y pagar",
          cancelButtonText: "No, solo pagar",
        });

        if (isConfirmed) {
          try {
            const saveCardPayload = {
              card_number: formValues.tarjeta,
              holder_name: formValues.nombre,
              expiration_year: expirationYear,
              expiration_month: expirationMonth,
              cvv2: formValues.cvv,
              device_session_id: deviceDataId,
            };

            const { data } = await apiApplication.post("/pagos/save/tarjeta", saveCardPayload);
            console.log("Tarjeta guardada exitosamente:", data);
          } catch (error) {
            console.error("Error al guardar la tarjeta:", error);
            Swal.fire({
              title: "Error",
              text: "No se pudo guardar la tarjeta, pero puedes continuar con el pago.",
              icon: "error",
              confirmButtonText: "OK",
            });
          }
        }
      }

      if (promocion_id > 0) {
        await apiApplication.post('/pagos/aplicar-promo', { promocionId: promocion_id, eventoId: evento?.id });
      }

      {

        // 💳 PROCESAR EL PAGO
        const { data } = await apiApplication.post("/pagos/make/cargo", payload);
        console.log("Pago exitoso:", data);
        const transaccionId = data.cargo.id;

        // Verificar si se requiere 3D Secure
        if (data.cargo?.payment_method?.url && data.cargo?.payment_method?.type === "redirect") {
          console.log("Se requiere autenticación 3D Secure. Redirigiendo...");
          window.location.href = data.cargo.payment_method.url;
          return;
        }

        // 🔄 CONFIRMAR EL CARGO
        const res_cargo = await apiApplication.post(`/pagos/check/cargo/${transaccionId}`, {
          reservaId: reservaId,
          esGeneral: true,
        });
        console.log("Ticket de pago", res_cargo);

        console.log("Correo enviado a:", emailUsuario);
        // ✅ MENSAJE DE ÉXITO
        setCargando(false);
        setCompraExitosa(true);
        setStep(1);
        setIsModalOpen(false);

      }

    } catch (error: any) {
      console.error("Error procesando pago", error);
      setCargando(false);
      Swal.fire({
        title: "Error",
        text: error?.response?.data?.message || "Ocurrió un error al procesar el pago.",
        icon: "error",
        confirmButtonText: "OK",
      });

      if (error?.response?.data?.isPromoError) {
        setDiscountAmount(0);
        setPromocionID(0);
      }
    }
  };

  const handleVenderGenerales = async (e: React.FormEvent) => {
    e.preventDefault();

    if (evento?.esGratuito){
      handleComprarGratis(reservaId!);
      return;
    }

    // 📌 Si el usuario seleccionó una tarjeta guardada, saltamos las validaciones de datos de tarjeta
    if (!tarjetaSeleccionada) {
      // 📌 Validaciones de pago solo si NO hay una tarjeta guardada seleccionada
      if (!formValues.nombre || !/^[a-zA-Z\s]+$/.test(formValues.nombre)) {
        Swal.fire({ title: "Error", text: "El nombre del titular no es válido o no puede ir vacío.", icon: "error", confirmButtonText: "OK" });
        return;
      }
      if (!validarNumeroTarjeta(formValues.tarjeta)) {
        Swal.fire({ title: "Error", text: "El número de tarjeta no es válido. Verifica que esté completo y sea correcto (de 14 a 19 dígitos).", icon: "error", confirmButtonText: "OK" });
        return;
      }
      if (!expiracion || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiracion)) {
        Swal.fire({ title: "Error", text: "La fecha de vencimiento debe estar en formato MM/YY.", icon: "error", confirmButtonText: "OK" });
        return;
      }

      // 📌 Verificar que la tarjeta no esté vencida
      const [mes, año] = expiracion.split("/").map(Number);
      const añoActual = new Date().getFullYear() % 100; // Obtener los últimos 2 dígitos del año
      const mesActual = new Date().getMonth() + 1; // Enero = 0, sumamos 1

      if (año < añoActual || (año === añoActual && mes < mesActual)) {
        Swal.fire({ title: "Error", text: "La tarjeta está vencida.", icon: "error", confirmButtonText: "OK" });
        return;
      }

      if (!validarCVC(formValues.cvv, formValues.tarjeta)) {
        Swal.fire({ title: "Error", text: "El código de seguridad (CVV) no es válido.", icon: "error", confirmButtonText: "OK" });
        return;
      }
    }

    try {
      // 📌 Intentar procesar el pago
      await procesarPago();
    } catch (error: any) {
      console.error("Error al procesar la compra:", error);
      Swal.fire({ title: "Error", text: error.message || "Ocurrió un error al comprar.", icon: "error", confirmButtonText: "OK" });
    }
  };

  // Actualizar el contador cada segundo y manejar pestaña inactiva
  useEffect(() => {
    if (fechaExpiracion === null) return;

    // eslint-disable-next-line prefer-const
    let interval: ReturnType<typeof setInterval>;

    const actualizarTiempo = () => {
      const ahora = new Date().getTime();
      const tiempoRestante = Math.max(0, Math.floor((fechaExpiracion - ahora) / 1000));
      setTiempoRestante(tiempoRestante);

      if (tiempoRestante <= 0) {
        clearInterval(interval);
      }
    };

    // Ejecutar inmediatamente para evitar retraso inicial
    actualizarTiempo();

    // Configurar intervalo de actualización
    interval = setInterval(actualizarTiempo, 1000);

    // Manejar cuando la pestaña vuelve a estar activa
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Re-sincronizar el tiempo al volver a la pestaña
        actualizarTiempo();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fechaExpiracion]);

  const renderTimer = () => {
    if (tiempoRestante === null) return null;

    const minutos = Math.floor(tiempoRestante / 60);
    const segundos = tiempoRestante % 60;

    return (
      <div className='flex items-end justify-between'>
        <p className='text-sm font-semibold text-center'>Tiempo restante <span className='block font-normal text-sm'>(minutos)</span></p>
        <div className='flex items-center gap-x-3 text-xl'>
          <span className='font-semibold text-red-500 w-8 h-8 p-1 rounded shadow grid place-items-center'>{minutos.toString().padStart(2, '0')}</span>
          <span className='font-semibold w-8 h-8 p-1 rounded shadow grid place-items-center'>:</span>
          <span className='font-semibold text-red-500 w-8 h-8 p-1 rounded shadow grid place-items-center'>{segundos.toString().padStart(2, '0')}</span>
        </div>
      </div>
    );
  };

  const calcularTotal = () => {
    let totalBase = (((boletos * precioBoletos) - discountAmount));
    const totalUdt = (totalBase * udt);
    const totalUds = (totalBase * uds);

    let total = totalBase + totalUdt + totalUds;

    if (ivaApplied) {
      const totalIva = (totalBase * iva);
      total += totalIva;
    }

    return (total).toFixed(2);
  };

  const increment = () => setBoletos((prev) => (prev < limite && ((modalProps?.asientosDisponibles && (prev < modalProps?.asientosDisponibles)) || !modalProps?.asientosDisponibles) ? prev + 1 : prev));
  const decrement = () => setBoletos((prev) => (prev > 1 ? prev - 1 : 1));

  const handleClickSeccionAdicional = (seccion: any) => {
    setPrecioBoletos(+seccion.precioSeccion);
    setIsModalOpen(true);
    setModalProps(seccion);
    if (evento && evento.udsPorCategoria) setUds(parseFloat(seccion.uds));
    setSeccionId(seccion.id);
  }

  const handleCheckDiscount = async () => {

    if (!discountCode.trim()) {
      Swal.fire("Mensaje", "Ingresa un código valido", "warning");
      return;
    }

    setIsCheckingCode(true);

    try {
      const params = {
        clave: discountCode.toUpperCase(),
        evento_id: id
      };

      const res = await apiApplication.post('/promociones/validar_clave_web', params);

      if (res.data.id) {
        const promo = res.data;
        setPromocion(promo);

        const categoriasValidas = promo.categorias.map((cat: { categoriaGeneral: { nombre: string; }; }) => cat.categoriaGeneral?.nombre).filter((cat: string) => cat !== null && cat !== undefined);

        if (!promo.aplicaTodoEvento && !categoriasValidas.includes(modalProps?.nombreEspecial)) {
          toast.error(`El código de descuento no es válido para la sección ${modalProps?.nombreEspecial}.`);
          return;
        }

        // Simulando cuenta
        setPromocionID(res.data.id);
        setDiscountPorcent(parseFloat(res.data.porcentaje));
        let descuentoAplicado = parseFloat(res.data.porcentaje);

        descuentoAplicado = (boletos * precioBoletos) * (descuentoAplicado / 100);

        if (res.data.tipo === 'CANTIDAD') {
          const cantidadCompra = res.data.cantidadCompra;
          const cantidadPaga = res.data.cantidadPaga;

          if (boletos < cantidadCompra) {
            toast.error(`Debes comprar al menos ${cantidadCompra} boletos para aplicar el descuento.`);
            setDiscountAmount(0);
            return;
          }
          const gruposCompletos = Math.floor(boletos / cantidadCompra);
          const sobrantes = boletos % cantidadCompra;
          const boletosPagadosEnGrupos = gruposCompletos * cantidadPaga;
          const boletosPagadosExtras = sobrantes;
          const boletosAPagar = boletosPagadosEnGrupos + boletosPagadosExtras;

          const totalSinPromo = boletos * precioBoletos;
          const totalConPromo = boletosAPagar * precioBoletos;
          descuentoAplicado = totalSinPromo - totalConPromo;
        }

        setDiscountAmount(descuentoAplicado);

        toast.success(`Descuento aplicado correctamente!`);

      } else {
        toast.error(`Código de descuento inválido.`);
      }

    } catch (err) {
      toast.error(`Código de descuento inválido.`);
      setDiscountAmount(0);
    } finally {
      setIsCheckingCode(false);
    }
  };

  return (
    <div>

      {cargando && (
        <LocalLoader />
      )}

      {tooltip.visible && (
        <div
          style={{
            position: "absolute",
            top: tooltip.y,
            left: tooltip.x,
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: "5px",
            fontSize: "14px",
            pointerEvents: "none",
            zIndex: 1000
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.text }}
        />
      )}

      {evento && (
        <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
          {/* Categorias */}
          <div className='flex items-center gap-x-3 my-4'>
            <Link href={`/`} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-md flex items-center gap-x-1">
              <MdKeyboardBackspace className='text-2xl' />
            </Link>
            <p className='text-gray-900 text-2xl font-medium'>{evento?.nombre} - {evento?.fecha ? formatDate(evento.fecha, "d 'de' MMMM 'de' yyyy") : ''}</p>
          </div>
          <div className='mb-3'>
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-x-5">
              <div className="border border-gray-400 grow rounded-full"></div>
              <p className="whitespace-nowrap text-center">Compra tus boletos:
                {!evento?.recinto?.esGeneral && (
                  <span className='block font-normal text-base text-gray-500'>Para empezar haz clic en el mapa</span>
                )}
              </p>
              <div className="border border-gray-400 grow rounded-full"></div>
            </h2>
            <div className='border-y border-gray-300 py-3 mt-5 flex flex-wrap items-center gap-3'>
              <p className='font-semibold text-gray-700'>Información importante del evento: <span className='font-normal text-gray-500'>Venta máxima de boletos por usuario {evento?.limiteDeAsientos}.</span></p>
              {(preciosCategorias?.length ?? 0) > 0 && (
                <p className='font-semibold text-gray-700'>Disponibles: <span className='font-normal text-gray-500'>{preciosCategorias?.length} tipos de boletos.</span></p>
              )}
              <p className='font-semibold text-gray-700'>Evento: <span className='font-normal text-gray-500'>{evento?.nombre}.</span></p>
              <div className='flex flex-col'>
                <p className='font-semibold text-gray-700'>Fecha: <span className='font-normal text-gray-500'>{evento?.fecha ? (evento?.finalEvento ? formatFechaConRango(evento.fecha, evento.finalEvento) : formatDate(evento.fecha, "d 'de' MMMM 'de' yyyy")) : ''}.</span></p>
                {evento?.aperturaPuertas && (
                  <p className='font-semibold text-gray-700'>Apertura de puertas: <span className='font-normal text-gray-500'>{formatHoraRelativa(evento.aperturaPuertas, evento.fecha)}.</span></p>
                )}
              </div>
            </div>
            {/* Secciones adicionales para comprar si son con nombre especial */}
            {(seccionesAdicionales ?? []).length > 0 && eventoActivo && (
              <>
                <p className='text-gray-700 text-xl font-semibold my-4'>Boletos Generales Adicionales <span className='font-normal text-gray-500 text-base'>*No visibles en el mapa*</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {seccionesAdicionales?.map((seccion, index) => (
                    <div key={seccion.id || index} className="border border-gray-300 rounded-md bg-white shadow-sm p-2 lg:p-3 flex flex-col items-start justify-between">
                      <h5 className="text-base font-light text-gray-700 flex flex-wrap items-center gap-x-1">
                        <span className='rounded-md w-5 h-5 grid place-items-center' style={{ backgroundColor: seccion.colorGeneral }} ><TbTicket className="text-white" size={16} /></span>
                        <span>{seccion.nombreEspecial}</span>
                      </h5>
                      {/* Nombre de la seccion, solo si la tiene: sirve para diferenciar generales adicionales */}
                      {seccion.nombre && seccion.nombre !== seccion.nombreEspecial && (
                        <p className='text-sm text-gray-500'>Sección {seccion.nombre}</p>
                      )}
                      <p className='my-2 font-semibold text-xl text-gray-800 text-center w-full'>{formatearDinero(Number(seccion.precioSeccion))}</p>
                      <button onClick={() => { handleClickSeccionAdicional(seccion) }} disabled={seccion?.asientosDisponibles === null || seccion?.asientosDisponibles === 0} className={`mt-auto w-full px-3 py-2 rounded-md bg-accentBase hover:bg-emphasis text-white text-sm transition-colors ${seccion?.asientosDisponibles === null || seccion?.asientosDisponibles === 0 ? 'cursor-not-allowed' : ''}`}>
                        {seccion?.asientosDisponibles <= 0 ? 'Agotados' : 'Comprar boletos'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Listado de precios de categorias */}
            {(preciosCategorias?.length ?? 0) > 0 && eventoActivo && !isAbono && (
              <Swiper
                modules={[Navigation, Autoplay]}
                spaceBetween={10}
                slidesPerView={1}
                autoplay={{ delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true }}
                breakpoints={{
                  640: { slidesPerView: 2 },
                  1024: { slidesPerView: 4 },
                  1536: { slidesPerView: 5 },
                }}
                navigation
                className="mt-4 mb-2"
              >
                {preciosCategorias.map((categoria, index) => (
                  <SwiperSlide className="flex items-center justify-center" key={index}>
                    <ListaPreciosCategorias preciosCategorias={[categoria]} />
                  </SwiperSlide>
                ))}
              </Swiper>
            )}

            {evento?.id !== 59 && (
              <p className='font-semibold text-gray-700 text-center'>*Los precios son {Number(evento.usoDeServicio) == 0 ? '' : 'más cargos por servicio y'} en pesos mexicanos.*</p>
            )}
          </div>

          {isAbono && (
            <div className="mb-8 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-slate-700">Preferencia de Abono</h3>
                  <p className="text-gray-500 text-sm">¿Deseas el mismo asiento para todas las fechas o elegir por separado?</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Mantener asiento en todas las fechas</span>
                  <button
                    onClick={() => {
                      const nuevoModo = modoAbono === "por_funcion" ? "mismo_asiento" : "por_funcion";
                      const newState = { ...getAbonoBuilderState(), modo: nuevoModo };
                      setAbonoBuilderState(newState);
                      setModoAbono(nuevoModo);
                    }}
                    className={`relative w-12 h-6 rounded-full transition ${
                      modoAbono === "mismo_asiento" ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        modoAbono === "mismo_asiento" ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className='flex justify-center mb-3'>
                <p className='font-normal text-sm text-slate-500 text-center inline-flex mx-auto border border-slate-300 rounded-full px-4 py-3'>{funciones.length} fechas incluidas en el pase</p>
              </div>

              {modoAbono === 'por_funcion' && funciones.length > 0 && (
                <div className="flex justify-center gap-3 overflow-x-auto py-2 scrollbar-none">
                  {funciones.map((f, index) => {
                    const isCompleted = seleccionesAbono.some(s => s.funcionId === f.id);
                    const isActive = currentFuncionIndex === index;
                    // Estar bloqueado si no es la primera y la anterior no está completada
                    const isLocked = index > 0 && !seleccionesAbono.some(s => s.funcionId === funciones[index - 1].id);

                    return (
                      <button
                        key={f.id}
                        disabled={isLocked}
                        onClick={() => !isLocked && setCurrentFuncionIndex(index)}
                        className={`h-24 w-24 p-3 rounded-xl border flex flex-col items-center transition-all ${
                          isLocked
                            ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed'
                            : isActive
                              ? 'bg-blue-50 text-slate-700 border-blue-600 shadow-md ring-4 ring-blue-100'
                              : isCompleted
                                ? 'bg-green-50 text-green-700 border-green-200 opacity-100'
                                : 'bg-white text-gray-400 border-gray-200 grayscale opacity-90'
                        }`}
                      >
                         <span className="text-[10px] font-bold uppercase tracking-wider mb-1">{f.fecha ? formatDate(f.fecha, 'MMM yyyy') : ''}</span>
                         <span className="text-xl font-black mb-1">{f.fecha ? formatDate(f.fecha, 'dd') : ''}</span>
                         <span className="text-[10px] font-medium">{f.fecha ? formatDate(f.fecha, 'EEEE') : ''}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {((getAbonoBuilderState()?.seleccionesParciales?.length || 0) > 0 || (Object.keys(getAbonoBuilderState()?.asientosPorFecha || {}).length > 0)) && (
                <button
                  onClick={() => {
                    clearAbonoBuilderState();
                    setSeleccionesAbono([]);
                    setCurrentFuncionIndex(0);
                    window.location.reload();
                  }}
                  className="ml-auto flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
                >
                  <IoTrashOutline className="text-sm" />
                  Reiniciar selección
                </button>
              )}
            </div>
          )}

          <div ref={containerRef} className="relative container-svg my-5 bg-white shadow-sm p-2 lg:p-3 rounded-lg">
            {eventoActivo ? (
              <>
                {renderSVG()}
                {descripcionAdicional && (
                  // descripcionExtra llega como HTML del editor del dashboard (puede traer enlaces).
                  <div
                    className="rounded-xl bg-gradient-to-r from-accentBase to-emphasis text-neutral text-lg xl:text-xl font-normal my-10 w-full md:w-4/5 mx-auto text-left p-2 md:p-4 event-message"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichText(descripcionAdicional) }}
                  />
                )}
              </>
            ) : (
              <>
                <div className='text-gray-600 text-center text-2xl xl:text-4xl font-light'>
                  ¡Este evento no se encuentra disponible!
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de compra */}
      {isModalOpen && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-40" >
          <div className={`bg-white p-2 md:p-3 rounded-lg shadow-lg min-w-96 ${step === 2 ? 'w-8/12' : ''} max-h-[95vh] overflow-y-auto`}>
            <button onClick={(e) => handleModalClose(e)} className="text-right w-full flex justify-end">
              <IoIosClose className="text-4xl text-gray-400" />
            </button>

            {/* Contenido del Paso 1 */}
            {step === 1 && (
              <>
                <div className="text-emphasis font-semibold text-xl flex flex-wrap items-center justify-between mb-5">
                  {modalProps?.asientosDisponibles ? (
                    <p className='capitalize'>{modalProps?.nombreEspecial}, {modalProps?.bloque} - {modalProps?.tipo_seccion} </p>
                  ) : (
                    <p className='capitalize'>{modalProps?.nombre}, {modalProps?.bloque} - {modalProps?.tipo_seccion} </p>
                  )}
                  <p className='text-sm font-normal'>Disponibles:
                    <span className='px-1 rounded-full shadow-sm bg-blue-100 text-xs font-semibold'>{modalProps?.asientosDisponibles}</span>
                  </p>
                </div>
                <p className="text-base text-gray-500 font-medium mb-3">Precios de las entradas:</p>
                <div className="grid grid-cols-2">
                  <div className="col-span-2 md:col-span-1 flex items-center gap-x-2">
                    <div className="bg-indigo-600 rounded-lg w-8 h-8 flex items-center justify-center">
                      <TbTicket className="text-white" />
                    </div>
                    <span className="text-emphasis capitalize">{modalProps?.tipo_seccion ?? "N/A"}</span>
                  </div>
                  <div className="col-span-2 md:col-span-1 flex items-center gap-x-3">
                    <p className="text-gray-500 text-sm">Precio de cada asiento:</p>
                    <span className="font-bold text-accentLight text-2xl">${precioBoletos}</span>
                  </div>
                </div>
                <hr className="my-4" />
                <div className="flex items-center justify-between mb-4">
                  <label htmlFor="boletos_general" className="text-gray-500 font-medium">Cantidad de boletos</label>
                  <div className="flex items-center border border-gray-300 px-2 py-1 rounded-full">
                    <button onClick={decrement} className="w-8 h-8 grid place-items-center">
                      <FiMinus />
                    </button>
                    <input id="boletos_general" type="number" value={boletos} className="p-2 text-center w-16 rounded-md"
                      onChange={handleBoletosChange}
                      min="1"
                      max={limite}
                    />
                    <button onClick={increment} className="w-8 h-8 bg-accentBase rounded-full grid place-items-center">
                      <FiPlus className="text-white text-xl" />
                    </button>
                  </div>
                </div>
                <p className="mb-4 flex items-center justify-between text-3xl text-accentLight font-bold">
                  Total: <span>${parseFloat((precioBoletos * boletos).toFixed(2))}</span>
                </p>
                <div className="grid gap-y-5">
                  <button type='button' onClick={nextStep} disabled={(modalProps?.asientosDisponibles === null || modalProps?.asientosDisponibles === 0) && !evento?.esGratuito } className={`px-4 py-2 bg-accentBase hover:bg-emphasis transition-colors text-neutral rounded-md ${modalProps?.asientosDisponibles === null || modalProps?.asientosDisponibles === 0 ? 'cursor-not-allowed' : ''}`}>
                    Siguiente
                  </button>
                </div>
              </>
            )}

            {/* Contenido del Paso 2 */}
            {step === 2 && (
              <div>
                <div className='grid grid-cols-2 gap-3 text-gray-500'>
                  <section className='col-span-2 lg:col-span-1'>
                    <div className='grid grid-cols-3 gap-3 mb-3'>
                      <div className='flex flex-col items-start gap-y-2 col-span-3 lg:col-span-2'>
                        <p className='bg-gray-100 rounded-full px-3 py-1 inline-block text-sm text-gray-600'>{boletos} {boletos === 1 ? 'asiento' : 'asientos'} {boletos === 1 ? 'seleccionado' : 'seleccionados'}</p>
                        <p className='text-sm'>Evento <span className='block font-medium'>{evento?.nombre}</span></p>
                        <p className='text-sm'>Fecha <span className='block font-medium'>{evento?.fecha ? formatDate(evento.fecha) : 'Fecha no disponible'}</span></p>
                      </div>
                      <div className='flex flex-col gap-y-2 col-span-3 lg:col-span-1'>
                        <img className='rounded-md ml-auto aspect-square object-cover' width={75} height={75} src={evento?.imagenPromocion} alt="" />
                        <p className='text-right text-sm'>Recinto <span className='block font-medium'>{evento?.recinto?.nombre}, {evento?.ciudad?.nombre}</span></p>
                      </div>
                    </div>
                    <hr />
                    <div>
                      <h3 className='my-1 font-medium text-lg'>Ordenes de artículos</h3>
                      <p className='text-gray-500 font-medium flex justify-between px-2 lg:px-3'>Boleto <span>Precio</span></p>
                      <ul className='grid gap-1 overflow-y-auto max-h-32 pr-1'>
                        {Array.from({ length: boletos }).map((_, index) => (
                          <li key={index} className='bg-gray-100 rounded-md p-2 text-sm text-gray-600 flex items-center gap-1'>
                            <div className="bg-indigo-600 rounded-lg w-7 h-7 flex items-center justify-center mr-2">
                              <TbTicket className="text-white text-lg" />
                            </div>
                            <div className='w-full'>
                              <p className='font-medium'>Asiento {modalProps?.tipo_seccion}</p>
                              <div className='flex justify-between flex-1'>
                                <p>{modalProps?.nombreEspecial},{modalProps?.nombre}, {modalProps?.bloque}</p>
                                <span className='font-medium'>${precioBoletos}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <hr className='mt-3' />

                    {habilitaPromocion && (

                      <div className='col-span-2 text-xs pl-0 flex items-center justify-between my-2'>
                        Código de descuento:
                        <div className="flex gap-2">
                          <input onChange={(e) => setDiscountCode(e.target.value)} defaultValue={discountCode} type="text" id="codigo_descuento" placeholder='Escriba el código' className="w-36 p-2 border border-gray-400 bg-white rounded-md text-gray-900 text-right placeholder:text-gray-600" style={{ textTransform: 'uppercase' }} />
                          <button type="button" className='bg-accentBase text-neutral px-2 rounded-md transition-colors' onClick={handleCheckDiscount} disabled={isCheckingCode}>
                            Aplicar
                          </button>
                        </div>
                      </div>

                    )}

                    <div>
                      <h3 className='font-medium text-lg'>Resumen de la compra</h3>
                      <div className='px-2 lg:px-3'>
                        <p className='flex items-center justify-between text-sm'>{boletos} x {boletos === 1 ? 'boleto' : 'boletos'}: <span className='font-medium'>${Math.floor(boletos * precioBoletos * 100) / 100}</span></p>
                        {discountAmount > 0 && <p className='flex items-center justify-between text-sm'>Descuento {promocion.nombre} : <span className='font-medium'>-${discountAmount}</span></p>}
                        <p className='flex items-center justify-between text-sm'>Subtotal: <span className='font-medium'>${Math.floor(((boletos * precioBoletos) - discountAmount) * 100) / 100}</span></p>
                        <p className='flex items-center justify-between text-sm'>Cargo por servicio: <span className='font-medium'>${Math.floor(uds * ((boletos * precioBoletos) - discountAmount) * 100) / 100}</span></p>
                        <p className='flex items-center justify-between text-sm'>Cargo por uso de tarjeta: <span className='font-medium'>${(udt * ((boletos * precioBoletos) - discountAmount)).toFixed(2)}</span></p>
                        {ivaApplied && (
                          <p className='flex items-center justify-between text-sm'>
                            IVA:
                            <span className='font-medium'>
                              ${Math.floor(iva * ((boletos * precioBoletos) - discountAmount) * 100) / 100}
                            </span>
                          </p>
                        )}
                        <hr className='my-2' />
                        <p className='flex items-center justify-between text-emphasis font-bold text-xl lg:text-2xl'>Total: <span>${calcularTotal()}</span></p>
                      </div>
                    </div>
                  </section>
                  <section className='col-span-2 lg:col-span-1 flex flex-col gap-1 relative'>
                    <div className="scrolldown absolute right-50 z-50 top-0">
                      <div className="chevrons">
                        <div className="chevrondown"></div>
                        <div className="chevrondown"></div>
                      </div>
                    </div>
                    {reservaExitosa && (
                      <div className="w-11/12 ml-auto p-2 lg:p-4 bg-white flex flex-col gap-3 rounded-md shadow-sm">
                        {renderTimer()}
                      </div>
                    )}
                    <div className="w-full p-2 lg:p-4 bg-white flex flex-col gap-3 rounded-md shadow-sm">

                      {!evento?.esGratuito && (
                        <>
                          <h3 className='font-medium text-lg'>Seleccionar método de pago</h3>
                          <div className='flex items-center gap-x-1'>
                            <label className="w-full text-sm font-medium h-10 relative hover:bg-zinc-100 flex items-center px-2 gap-2 rounded-lg has-[:checked]:text-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:ring-blue-300 has-[:checked]:ring-1 select-none">
                              <input
                                className="w-4 h-4 absolute accent-current right-3"
                                type="radio"
                                value="metodo"
                                checked={tabMetodo === 'nueva_tarjeta'}
                                onChange={() => setTabMetodo('nueva_tarjeta')}
                              />
                              Nueva tarjeta
                            </label>
                            {!usuarioInvitado && (
                              <label className="w-full text-sm font-medium h-10 relative hover:bg-zinc-100 flex items-center px-2 gap-2 rounded-lg has-[:checked]:text-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:ring-blue-300 has-[:checked]:ring-1 select-none">
                                <input
                                  className="w-4 h-4 absolute accent-current right-3"
                                  type="radio"
                                  value="metodo"
                                  checked={tabMetodo === 'tarjetas_guardadas'}
                                  onChange={() => setTabMetodo('tarjetas_guardadas')}
                                />
                                Tarjetas guardadas
                              </label>
                            )}
                          </div>
                          <div className='grid grid-cols-8 divide-y gap-4'>
                            <div className='col-span-8 md:col-span-8'>
                              <p className='text-gray-500 text-sm'>Tarjetas de crédito</p>
                              <figure className='flex flex-wrap gap-3 items-center mt-2'>
                                <Image className='aspect-3/2 object-contain w-6' width={60} height={40} src="/visa.png" alt="" />
                                <Image className='aspect-3/2 object-contain w-6' width={60} height={40} src="/masterCard.png" alt="" />
                                <Image className='aspect-3/2 object-contain w-6' width={60} height={40} src="/americanExpress.png" alt="" />
                                <Image className='aspect-3/2 object-contain w-10' width={60} height={40} src="/carnet.png" alt="" />
                              </figure>
                            </div>
                            <div className='col-span-8 md:col-span-8 mt-2'>
                              <p className='text-gray-500 text-sm'>Tarjetas de débito</p>
                              <figure className='flex flex-wrap gap-3 items-center'>
                                <Image className='aspect-3/2 object-contain w-12' width={60} height={40} src="/BBVA.png" alt="" />
                                <Image className='aspect-3/2 object-contain w-12' width={60} height={40} src="/santander.png" alt="" />
                                <Image className='aspect-3/2 object-contain w-12' width={60} height={40} src="/hsbc.png" alt="" />
                                <Image className='aspect-3/2 object-contain w-12' width={60} height={40} src="/scotiabank.png" alt="" />
                                <Image className='aspect-3/2 object-contain w-12' width={60} height={40} src="/inbursa.png" alt="" />
                                <Image className='aspect-3/2 object-contain w-12' width={60} height={40} src="/ixe.png" alt="" />
                              </figure>
                            </div>
                          </div>
                        </>
                      )}
                      {(tabMetodo === 'nueva_tarjeta' && !evento?.esGratuito) && (
                        <>
                          <div className="space-y-1">
                            <label htmlFor="nombre" className="text-sm text-gray-400 font-semibold pb-1 block">Nombre del titular</label>
                            <input
                              type="text"
                              name="nombre"
                              id="nombre"
                              placeholder="Nombre en la tarjeta"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              value={formValues.nombre}
                              onChange={(e) => {
                                // Solo permite letras básicas y espacios
                                const cleanedValue = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                setFormValues({ ...formValues, nombre: cleanedValue });
                              }}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label htmlFor="tarjeta" className="text-sm text-gray-400 font-semibold pb-1 block">Número de la tarjeta</label>
                            <input
                              type="text"
                              name="tarjeta"
                              id="tarjeta"
                              placeholder="Número de tarjeta"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              value={formValues.tarjeta}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, ''); // Permite solo números
                                setFormValues({ ...formValues, tarjeta: value });
                              }}
                              maxLength={19} // Hasta 19 dígitos (tarjetas de 14 a 19 dígitos)
                              required
                            />
                          </div>
                          <div className="flex space-x-2">
                            <div className="space-y-1 w-full">
                              <label htmlFor="expiracion" className="text-sm text-gray-400 font-semibold pb-1 block">Fecha de vencimiento</label>
                              <input
                                type="text"
                                name="expiracion"
                                id="expiracion"
                                placeholder="MM/AA"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                value={expiracion}
                                onChange={handleExpiracionChange}
                                maxLength={5}
                                required
                              />
                            </div>

                            <div className="space-y-1 w-full">
                              <label htmlFor="cvv" className="text-sm text-gray-400 font-semibold pb-1 block">Código de seguridad </label>
                              <input
                                type="text"
                                name="cvv"
                                id="cvv"
                                placeholder="CVV"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                value={formValues.cvv}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, ''); // Permite solo números
                                  setFormValues({ ...formValues, cvv: value });
                                }}
                                maxLength={4} // Máximo de 4 dígitos (algunos CVV tienen 4)
                                required
                              />
                            </div>
                          </div>
                          <div className='flex flex-col justify-end divide-x-2 gap-4'>
                            <figure className='flex flex-col items-end'>
                              <small className='block text-gray-500 text-xs mb-1'>Transacciones realizadas vía:</small>
                              <Image width={100} height={60} src="/openpay.webp" alt="" />
                            </figure>
                            <figure className='flex items-center w-full'>
                              <LuBadgeCheck className='text-green-500 text-3xl w-10 flex-none' />
                              <small className='block text-gray-500 text-xs mb-1'>Tus pagos se realizan de forma segura con encriptación de 256 bits</small>
                            </figure>
                          </div>
                        </>
                      )}
                    </div>
                    {tabMetodo === 'tarjetas_guardadas' && tarjetas.length > 0 && !evento?.esGratuito && (
                      <div className="w-full p-2 lg:p-4 bg-white flex flex-col gap-3 rounded-md shadow-sm">
                        <div className='w-full'>
                          <h3 className='ftext-gray-400 font-semibold text-base mb-2'>Mis Tarjetas Guardadas</h3>
                          {tarjetas.map((tarjeta) => (
                            <div className="w-full flex items-center gap-x-3 bg-gray-100 relative hover:bg-gray-200 transition-colors rounded-lg p-2 mb-2 group" key={tarjeta.idtarjeta}>
                              <label className="w-full text-sm font-medium h-10 relative hover:bg-zinc-100 flex items-center px-3 gap-3 rounded-lg has-[:checked]:text-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:ring-blue-300 has-[:checked]:ring-1 select-none" key={tarjeta.idtarjeta}>
                                <input
                                  className="w-4 h-4 absolute accent-current right-3"
                                  type="radio"
                                  value={tarjeta.idtarjeta}
                                  checked={tarjetaSeleccionada === tarjeta.idtarjeta}
                                  onChange={() => setTarjetaSeleccionada(tarjeta.idtarjeta)}
                                />
                                {tarjeta.tarjeta}  ({tarjeta.banco})
                              </label>
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                                <button type='button' onClick={() => handleEliminarTarjeta(tarjeta.idtarjeta)}><IoTrashOutline className='text-red-500 text-xl' /></button>
                              </span>
                            </div>
                          ))}
                        </div>
                        <figure className='flex justify-end'>
                          <Image width={100} height={60} src="/openpay.webp" alt="" />
                        </figure>
                      </div>
                    )}

                    <footer className='mbs-auto'>
                      <p className='text-center w-full text-xs my-3 text-gray-400'>Al hacer clic en el botón pagar, confirmas que has leído y aceptas nuestros términos y condiciones, así como nuestra política de privacidad.</p>
                      {reservaExitosa && (
                        <>
                          <button onClick={handleVenderGenerales} type='button' className="w-full px-4 py-2 bg-accentBase hover:bg-emphasis mb-2 transition-colors text-white rounded-lg">
                            Pagar
                          </button>
                          <button type='button' onClick={handleCancelarCompra} className="w-full px-4 py-2 bg-gray-300 hover:bg-gray-400 transition-colors text-gray-700 rounded-lg">
                            Cancelar compra
                          </button>
                        </>
                      )}
                    </footer>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {compraExitosa && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50" >
          <div className={`bg-white p-2 md:p-3 rounded-lg shadow-lg min-w-96 max-w-96 text-center`}>
            <div className='rounded-full w-12 h-12 bg-green-500 grid place-items-center mx-auto mb-5'><LuBadgeCheck className='text-white text-3xl' /></div>
            <h2 className='text-2xl font-bold text-gray-800'>¡Compra exitosa!</h2>
            <hr className='my-3' />
            <p className="text-gray-600">Tus boletos para {evento?.nombre} {evento?.recinto.nombre} han sido comprados con éxito.</p>
            <p className="text-gray-600">Recibiras un correo con tus boletos.</p>
            <p className='text-gray-600 my-4'>Total pagado: <span className='block text-3xl font-bold text-gray-800'>${calcularTotal()}</span></p>
            {!usuarioInvitado && (
              <Link href="/perfil/mis_compras" className='w-full block px-4 py-2 bg-accentBase hover:bg-emphasis mb-2 transition-colors text-white rounded-lg'>Ir a mis compras</Link>
            )}
            <button onClick={() => window.location.reload()} className='w-full px-4 py-2 mb-2 transition-colors text-gray-700 rounded-lg'>Continuar</button>
          </div>
        </div>
      )}

    </div>
  );

};
