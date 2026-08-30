import { useEffect, useState, useRef } from 'react';
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { TbTicket } from "react-icons/tb";
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAuthModal } from '../../context/AuthModalContext';
import { useEventosStore } from '../../hooks/useEventosStore';

import { IoIosClose } from "react-icons/io";
import { IoTrashOutline, IoLocationOutline } from "react-icons/io5";
import { FiMinus, FiPlus } from "react-icons/fi";
import { FaArrowLeftLong } from "react-icons/fa6";
import { HiOutlineCalendarDateRange } from "react-icons/hi2";
import { IoKey } from "react-icons/io5";

import Swal, { SweetAlertIcon } from "sweetalert2";
import Loader from '@/publicUi/components/Loader';
import apiApplication from '../../api/apiApplication';

import { toast } from 'react-toastify';
import { LuBadgeCheck } from "react-icons/lu";
import { formatDate } from '../../utils/dateHelpers';
import { validarNumeroTarjeta, validarCVC } from '../../utils/cardHelpers';
import { formatearDinero } from '../helpers/formatearDinero';
import ConferenciaHero from './conferencias/components/ConferenciaHero';
// import NavBar from './conferencias/components/NavBar';
import ConferenciaFooter from './conferencias/components/ConferenciaFooter';

import "swiper/css";
import "swiper/css/navigation";

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
}
interface Evento {
  id: number;
  nombre: string;
  fecha: string;
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
  ubicacion: string;
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
  colores: [];
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
  colorGeneral: string;
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

export const FormConferenciaPage = () => {
  const router = useRouter();
  const { checkAuthToken, user, status } = useAuthStore();
  const { requestLogin } = useAuthModal();
  const [reservaPendiente, setReservaPendiente] = useState<number | null>(null);
  const { getDetalleEventos, getDetalleEventoSecciones, reservarGeneral, cancelar } = useEventosStore();
  const { eventoId } = useParams<{ eventoId: string }>();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [secciones, setSecciones] = useState<Secciones[] | null>(null);
  const [seccionesAdicionales, setSeccionesAdicionales] = useState<Secciones[] | null>(null);
  // const [preciosCategorias, setPreciosCategorias] = useState<Categorias[]>([]);
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
  const [reservaExitosa, setReservaExitosa] = useState<boolean>(false);
  const [usuarioInvitado, setUsuarioInvitado] = useState<boolean>(false);
  const [reservaId, setReservaId] = useState<string | null>(null);
  const [tiempoRestante, setTiempoRestante] = useState<number | null>(null);
  const [fechaExpiracion, setFechaExpiracion] = useState<number | null>(null);
  const [step, setStep] = useState(1);
  const [seccionId, setSeccionId] = useState(0);
  const [expiracion, setExpiracion] = useState("");
  const [expirationYear, setExpirationYear] = useState("");
  const [expirationMonth, setExpirationMonth] = useState("");
  const [udt, setUdt] = useState<number>(0);
  const [uds, setUds] = useState<number>(0);
  const [iva, setIva] = useState<number>(0);
  const [ivaApplied, setIvaApplied] = useState(false);
  const [tabMetodo, setTabMetodo] = useState('nueva_tarjeta');
  const [cargando, setCargando] = useState(false);
  const [tooltip, setTooltip] = useState<{ visible: boolean, text: string, x: number, y: number }>({
    visible: false,
    text: "",
    x: 0,
    y: 0
  });
  // const [eventoActivo, setEventoActivo] = useState(false);
  const [claveAccesoEvento, setClaveAccesoEvento] = useState(null);
  const [claveAcceso, setClaveAcceso] = useState("");
  const [acceso, setAcceso] = useState(false);

  const [formValues, setFormValues] = useState(
    {
      nombre: '',
      tarjeta: '',
      expiracion: '',
      cvv: '',
      tipoParticipante: 'invitado',
      nombre_conferencia: '',
      correo_conferencia: '',
      telefono_conferencia: '',
      empresa_conferencia: '',
      puesto_conferencia: '',
      temas_exponer: '',
      que_ofrecer: '',
      requerimientos_espacio: '',
      personas_expositor: '',
      foto: null as File | string | null,
    });

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

  // DETALLES DE LA CONFERENCIA
  useEffect(() => {

    const fetchEvento = async () => {

      if (eventoId) {

        setCargando(true);

        try {

          habilitarpromocion(eventoId);
          const response = await getDetalleEventos(eventoId);

          console.log("🚀 ~ fetchEvento ~ response:", response);

          // setEventoActivo(response.mostrarWeb);
          const parsedUdt = parseFloat(response.usoDeTarjeta);
          const parsedUds = parseFloat(response.usoDeServicio);
          setUdt(parsedUdt);
          setUds(parsedUds);
          setIva(parseFloat(response.ivaRate));
          setIvaApplied(response.isIvaApplied);
          setEvento(response);
          setLimite(response.limiteDeAsientos);
          setClaveAccesoEvento(response.clave_acceso);

          console.log(seccionId);

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

  }, [eventoId]);

  // SECCIONES DEL EVENTO
  useEffect(() => {

    const fetchSecciones = async () => {

      if (eventoId) {

        try {

          const response = await getDetalleEventoSecciones(eventoId);

          setSecciones(response.secciones);

          // Filtrar solo las secciones que tienen un nombreEspecial válido
          const adicionalesConNombreEspecial = response.secciones.filter(
            (seccion: any) => seccion.seccionAdicional != null && seccion.seccionAdicional !== 0
          );

          setSeccionesAdicionales(adicionalesConNombreEspecial);

          // Ordenar los precios de cada categoría y de mayor a menor y si son iguales priorizar izquierda
          // const categoriasOrdenadas = (response.preciosCategorias ?? [])
          //   .map((categoria: any) => ({
          //     ...categoria,
          //     precios: (categoria.precios ?? []).filter((p: number) => p > 0).sort((a: number, b: number) => b - a),
          //   }))
          //   .sort((a: any, b: any) => {
          //     const precioA = a.precios[0] ?? 0;
          //     const precioB = b.precios[0] ?? 0;

          //     if (precioA !== precioB) {
          //       return precioB - precioA;
          //     }

          //     // Si los precios son iguales, priorizar los que tienen izquierda en el nombre
          //     const nombreA = a.categoria.toLowerCase();
          //     const nombreB = b.categoria.toLowerCase();

          //     const tieneIzquierdaA = nombreA.includes("izquierda");
          //     const tieneIzquierdaB = nombreB.includes("izquierda");

          //     if (tieneIzquierdaA && !tieneIzquierdaB) return -1;
          //     if (!tieneIzquierdaA && tieneIzquierdaB) return 1;

          //     return nombreA.localeCompare(nombreB);
          //   });

          // setPreciosCategorias(categoriasOrdenadas);

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

  }, [eventoId]);

  useEffect(() => {
    if (!seccionesAdicionales?.length) return;

    const timer = setTimeout(() => {
      const primeraDisponible = seccionesAdicionales.find(
        (s) => s.asientosDisponibles > 0
      );

      if (primeraDisponible) {
        handleClickSeccionAdicional(primeraDisponible);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [seccionesAdicionales]);

  // OBTENER CREDENCIALES DE OPENPAY
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

  useEffect(() => {
    if (status === 'checking') {
      checkAuthToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
      // s.nombre.toLowerCase().includes(target.id.toLowerCase())
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
      /* sections?.forEach(section => {
        if (section !== target) {
          section.classList.add('opacity-20');
        }
      }); */

      if (seccion.tipo_seccion != 'general') {
        window.location.href = `/eventos/${eventoId}/${seccion.id}/${seccion.nombre}`
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
  }, [evento, secciones]);

  const handleMouseEnter = (event: MouseEvent) => {
    const section = event.target as HTMLElement;
    const nombre = section.dataset.nombre || "Desconocido";
    const bloque = section.dataset.tipo_seccion || "Sin tipo";
    // const asientosDisponibles = section.dataset.asientosDisponibles || "Sin asientos disponibles";

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

  const nextStep = async () => {
    // await handleReservarAsientos();
    setStep((prevStep) => prevStep + 1);
  };

  // Tras iniciar sesión en el modal, reintenta la reserva automáticamente (sin salir de la página).
  useEffect(() => {
    if (reservaPendiente !== null && user) {
      const seccionId = reservaPendiente;
      setReservaPendiente(null);
      handleReservarAsientos(seccionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaPendiente, user]);

  const handleReservarAsientos = async (seccion_id: number) => {
    // Si no hay sesión, abre el modal de login (sin navegar) y continúa al iniciar sesión.
    if (!user) {
      setCargando(false);
      const ok = await requestLogin();
      if (ok) setReservaPendiente(seccion_id);
      return;
    }

    try {

      setCargando(true);
      let seccion_evento_id = seccion_id;

      if (evento?.id) {
        const response = await reservarGeneral(boletos, evento?.id.toString(), seccion_evento_id);
        console.log(response);
        if (response && response.id) {
          setReservaExitosa(true);
          setReservaId(response.id);

          if (user) {
            setUsuarioInvitado(false);
            try {
              setCargando(true);
              const has_user = await apiApplication.get("/pagos/get/mi_perfil");
              setOpenId(has_user.data.idOpenpay);
              setTarjetas(has_user.data.tarjetas);
              setCargando(false);
            } catch (error) {
              const resp = await apiApplication.post("/pagos/save/usuario");
              setOpenId(resp.data.idOpenpay);
              setCargando(false);
              console.error("Error al obtener/crear OpenPay ID", error);
            }

          } /* [INVITADO DESHABILITADO] else {
            setUsuarioInvitado(true);
            setCargando(false);
          } */

          let mejorPromocion;
          if (discountCode == '') {
            mejorPromocion = obtenerMejorPromocion(promosAplicables, boletos, precioBoletos);
            console.log("🚀 ~ handleReservarAsientos ~ mejorPromocion:", mejorPromocion)
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
          return window.location.reload();  // En lugar de recargar la página
        }
      }

      // if (!user) {
      //   Swal.fire({
      //     title: 'Atención!',
      //     text: 'Por favor, inicia sesión para realizar la reserva.',
      //     icon: 'warning',
      //     confirmButtonText: 'Iniciar sesión'
      //   }).then(() => {
      //     window.location.href = '/auth/login';
      //   });
      // }
    } catch (error) {
      setCargando(false);
      console.error("Error en la reserva:", error);
      Swal.fire({
        title: 'Atención!',
        text: 'Ocurrió un error al reservar. Por favor, intenta nuevamente.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
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
          Swal.fire({ title: '¡Atención!', text: 'El registro se ha cancelado.', icon: 'warning', timer: 2000, showConfirmButton: false }).then(() => {
            // window.location.reload();
            // reirect a conferencia/44 ej
            router.push(`/cosmotech/${evento?.id}`);
          });
        } else {
          Swal.fire({ title: 'Error', text: 'No se pudo cancelar la reserva. Inténtalo de nuevo.', icon: 'error', confirmButtonText: 'OK' });
        }
      }
    } catch (error) {
      Swal.fire({ title: 'Error', text: 'Ocurrió un error al cancelar la reserva.', icon: 'error', confirmButtonText: 'OK' });
    }
  };

  // const procesarPago = async () => {

  //   try {

  //     setCargando(true);

  //     // 🛑 CONFIRMAR PAGO ANTES DE PROCESARLO
  //     const confirmacionPago = await Swal.fire({
  //       title: "Adquirir entradas",
  //       text: (calcularTotal() > 0 ? `Vas a pagar $${calcularTotal()} por tus entradas. ¿Quieres continuar?` : `¿Quieres continuar?`),
  //       icon: "warning",
  //       showCancelButton: true,
  //       confirmButtonText: "Sí, pagar",
  //       cancelButtonText: "Cancelar",
  //     });

  //     if (!confirmacionPago.isConfirmed) {
  //       setCargando(false);
  //       return; // 🚨 Detener si el usuario cancela
  //     }

  //     var params_tarjeta = null;

  //     if (!tarjetaSeleccionada) {
  //       if (precioBoletos > 0) {
  //         params_tarjeta = {
  //           card_number: formValues.tarjeta,
  //           holder_name: formValues.nombre,
  //           expiration_year: expirationYear,
  //           expiration_month: expirationMonth,
  //           cvv2: formValues.cvv,
  //           device_session_id: deviceDataId,
  //         };
  //       } else {
  //         params_tarjeta = undefined;
  //       }
  //     } else {
  //       params_tarjeta = undefined;
  //     }

  //     // Construcción del payload del pago
  //     const payload: any = {
  //       eventoId: eventoId,
  //       reservaId: reservaId,
  //       esGeneral: true,
  //       tipoDispositivo: "web",
  //       source_id: tarjetaSeleccionada || "",
  //       tarjeta: params_tarjeta,
  //       amount: calcularTotal(),
  //       device_session_id: deviceDataId,
  //       redirect_url: "/",
  //       promocion_id,
  //       tipo_participante: formValues.tipoParticipante,
  //       nombre: formValues.nombre_conferencia,
  //       telefono: formValues.telefono_conferencia,
  //       empresa: formValues.empresa_conferencia,
  //       puesto: formValues.puesto_conferencia,
  //       correo: formValues.correo_conferencia,
  //       temas: formValues.temas_exponer,
  //       actividades: formValues.que_ofrecer,
  //       requerimientos: formValues.requerimientos_espacio,
  //       no_personas: formValues.personas_expositor
  //     };

  //     if (payload.amount == '0.00') {
  //       payload.amount = 0;
  //     }

  //     // Agregar usuarioOpenpayId solo si se usa una tarjeta guardada
  //     if (tarjetaSeleccionada) {
  //       payload.usuarioOpenpayId = openId;
  //     }

  //     // 🛑 PREGUNTAR SI DESEA GUARDAR LA TARJETA (SOLO SI ES NUEVA)
  //     if (!tarjetaSeleccionada && !usuarioInvitado && precioBoletos > 0) {
  //       const { isConfirmed } = await Swal.fire({
  //         title: "¿Quieres guardar tu tarjeta?",
  //         text: "Podrás usarla en futuras compras sin necesidad de ingresarla nuevamente.",
  //         icon: "question",
  //         showCancelButton: true,
  //         confirmButtonText: "Sí, guardar y pagar",
  //         cancelButtonText: "No, solo pagar",
  //       });

  //       if (isConfirmed) {
  //         try {
  //           const saveCardPayload = {
  //             card_number: formValues.tarjeta,
  //             holder_name: formValues.nombre,
  //             expiration_year: expirationYear,
  //             expiration_month: expirationMonth,
  //             cvv2: formValues.cvv,
  //             device_session_id: deviceDataId,
  //           };

  //           const { data } = await apiApplication.post("/pagos/save/tarjeta", saveCardPayload);
  //           console.log("Tarjeta guardada exitosamente:", data);
  //         } catch (error) {
  //           console.error("Error al guardar la tarjeta:", error);
  //           Swal.fire({
  //             title: "Error",
  //             text: "No se pudo guardar la tarjeta, pero puedes continuar con el pago.",
  //             icon: "error",
  //             confirmButtonText: "OK",
  //           });
  //         }
  //       }
  //     }

  //     if (promocion_id > 0) {
  //       await apiApplication.post('/pagos/aplicar-promo', { promocionId: promocion_id, eventoId: evento?.id });
  //     }

  //     if (usuarioInvitado) {

  //       // 💳 PROCESAR EL PAGO
  //       const { data } = await apiApplication.post("/pagos/make/conferencia/cargo_invitado", payload);
  //       console.log("Pago exitoso:", data);

  //       // Verificar si se requiere 3D Secure
  //       if (precioBoletos > 0) {

  //         if (data.cargo?.payment_method?.url && data.cargo?.payment_method?.type === "redirect") {
  //           console.log("Se requiere autenticación 3D Secure. Redirigiendo...");
  //           window.location.href = data.cargo.payment_method.url;
  //           return;
  //         }

  //       } else {

  //         navigate(`/terminar_compra_invitado_conferencia_gratis/${reservaId}/${true}/${data.invitadoId}/${promocion_id}`);
  //         return;

  //       }

  //     } else {

  //       // Nota: Cuando es gratis nunca va a ver un usuarioOpenpayId
  //       // 💳 PROCESAR EL PAGO
  //       const { data } = await apiApplication.post("/pagos/make/conferencia/cargo", payload);
  //       console.log("Pago exitoso:", data);

  //       // Verificar si se requiere 3D Secure
  //       if (precioBoletos > 0) {

  //         if (data.cargo?.payment_method?.url && data.cargo?.payment_method?.type === "redirect") {
  //           console.log("Se requiere autenticación 3D Secure. Redirigiendo...");
  //           window.location.href = data.cargo.payment_method.url;
  //           return;
  //         }

  //       } else {

  //         navigate(`/terminar_compra_conferencia_gratis/${reservaId}/${true}/${data.invitadoId}/${promocion_id}`);
  //         return;

  //       }

  //     }

  //   } catch (error: any) {
  //     console.error("Error procesando pago", error);
  //     setCargando(false);
  //     Swal.fire({
  //       title: "Error",
  //       text: error?.response?.data?.message || "Ocurrió un error al procesar el pago.",
  //       icon: "error",
  //       confirmButtonText: "OK",
  //     });

  //     if (error?.response?.data?.isPromoError) {
  //       setDiscountAmount(0);
  //       setPromocionID(0);
  //     }
  //   }

  // };

  const procesarPago = async () => {
    try {
      setCargando(true);

      // 🛑 CONFIRMAR PAGO ANTES DE PROCESARLO
      const confirmacionPago = await Swal.fire({
        title: "¿Estas a punto de registrarte?",
        text:
          calcularTotal() > 0
            ? `Vas a pagar $${calcularTotal()} por tus entradas. ¿Quieres continuar?`
            : `¿Quieres continuar?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, continuar",
        cancelButtonText: "Cancelar",
      });

      if (!confirmacionPago.isConfirmed) {
        setCargando(false);
        return; // 🚨 Detener si el usuario cancela
      }

      let params_tarjeta = undefined;
      if (!tarjetaSeleccionada && precioBoletos > 0) {
        params_tarjeta = {
          card_number: formValues.tarjeta,
          holder_name: formValues.nombre,
          expiration_year: expirationYear,
          expiration_month: expirationMonth,
          cvv2: formValues.cvv,
          device_session_id: deviceDataId,
        };
      }

      // ---------------------
      // Crear FormData
      // ---------------------
      const formData = new FormData();

      if (eventoId) formData.append("eventoId", eventoId.toString());
      if (reservaId) formData.append("reservaId", reservaId.toString());
      formData.append("esGeneral", "true");
      formData.append("tipoDispositivo", "web");
      formData.append("source_id", tarjetaSeleccionada || "");
      if (params_tarjeta) formData.append("tarjeta", JSON.stringify(params_tarjeta));
      formData.append("amount", calcularTotal().toString());
      if (deviceDataId) formData.append("device_session_id", deviceDataId);
      formData.append("redirect_url", "/");
      formData.append("promocion_id", promocion_id?.toString() || "0");
      formData.append("tipo_participante", formValues.tipoParticipante);
      formData.append("nombre", formValues.nombre_conferencia);
      formData.append("telefono", formValues.telefono_conferencia);
      formData.append("empresa", formValues.empresa_conferencia);
      formData.append("puesto", formValues.puesto_conferencia);
      formData.append("correo", formValues.correo_conferencia);
      formData.append("temas", formValues.temas_exponer);
      formData.append("actividades", formValues.que_ofrecer);
      formData.append("requerimientos", formValues.requerimientos_espacio);
      formData.append("no_personas", formValues.personas_expositor);

      // Foto
      if (formValues.foto instanceof File) {
        formData.append("foto", formValues.foto);
      }

      // Agregar usuarioOpenpayId solo si se usa una tarjeta guardada
      if (tarjetaSeleccionada && openId) {
        formData.append("usuarioOpenpayId", openId);
      }

      // ---------------------
      // Guardar tarjeta si aplica
      // ---------------------
      if (!tarjetaSeleccionada && !usuarioInvitado && precioBoletos > 0) {
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
        await apiApplication.post("/pagos/aplicar-promo", {
          promocionId: promocion_id,
          eventoId: evento?.id,
        });
      }

      // ---------------------
      // Procesar pago
      // ---------------------
      const endpoint = usuarioInvitado
        ? "/pagos/make/conferencia/cargo_invitado"
        : "/pagos/make/conferencia/cargo";

      const { data } = await apiApplication.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("Pago exitoso:", data);

      // Verificar 3D Secure
      if (precioBoletos > 0 && data.cargo?.payment_method?.url && data.cargo?.payment_method?.type === "redirect") {
        window.location.href = data.cargo.payment_method.url;
        return;
      }

      // Redirigir si es gratis
      if (usuarioInvitado) {
        router.push(
          `/terminar_compra_invitado_conferencia_gratis/${reservaId}/${true}/${data.invitadoId}/${promocion_id}`
        );
      } else {
        router.push(
          `/terminar_compra_conferencia_gratis/${reservaId}/${true}/${data.invitadoId}/${promocion_id}`
        );
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

    if (formValues.tipoParticipante == 'invitado' && (!formValues.nombre_conferencia || !formValues.telefono_conferencia || !formValues.empresa_conferencia || !formValues.puesto_conferencia || !formValues.correo_conferencia)) {
      Swal.fire({ title: "Mensaje", text: "Completa el formulario de Invitado", icon: "warning", confirmButtonText: "OK" });
      return;
    }

    if (formValues.tipoParticipante == 'expositor' && (!formValues.nombre_conferencia || !formValues.telefono_conferencia || !formValues.empresa_conferencia || !formValues.puesto_conferencia || !formValues.correo_conferencia || !formValues.temas_exponer || !formValues.que_ofrecer || !formValues.requerimientos_espacio || !formValues.personas_expositor)) {
      Swal.fire({ title: "Mensaje", text: "Completa el formulario de Expositor", icon: "warning", confirmButtonText: "OK" });
      return;
    }

    // 📌 Si el usuario seleccionó una tarjeta guardada, saltamos las validaciones de datos de tarjeta
    if (!tarjetaSeleccionada && precioBoletos > 0) {
      // 📌 Validaciones de pago solo si NO hay una tarjeta guardada seleccionada
      if (!formValues.nombre || !/^[a-zA-Z\s]+$/.test(formValues.nombre)) {
        Swal.fire({ title: "Mensaje", text: "El nombre del titular no es válido o no puede ir vacío.", icon: "warning", confirmButtonText: "OK" });
        return;
      }
      if (!validarNumeroTarjeta(formValues.tarjeta)) {
        Swal.fire({ title: "Mensaje", text: "El número de tarjeta no es válido. Verifica que esté completo y sea correcto (de 14 a 19 dígitos).", icon: "warning", confirmButtonText: "OK" });
        return;
      }
      if (!expiracion || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiracion)) {
        Swal.fire({ title: "Mensaje", text: "La fecha de vencimiento debe estar en formato MM/YY.", icon: "warning", confirmButtonText: "OK" });
        return;
      }

      // 📌 Verificar que la tarjeta no esté vencida
      const [mes, año] = expiracion.split("/").map(Number);
      const añoActual = new Date().getFullYear() % 100; // Obtener los últimos 2 dígitos del año
      const mesActual = new Date().getMonth() + 1; // Enero = 0, sumamos 1

      if (año < añoActual || (año === añoActual && mes < mesActual)) {
        Swal.fire({ title: "Mensaje", text: "La tarjeta está vencida.", icon: "warning", confirmButtonText: "OK" });
        return;
      }

      if (!validarCVC(formValues.cvv, formValues.tarjeta)) {
        Swal.fire({ title: "Mensaje", text: "El código de seguridad (CVV) no es válido.", icon: "warning", confirmButtonText: "OK" });
        return;
      }

    }

    try {

      await procesarPago();

    } catch (error: any) {

      Swal.fire({ title: "Error", text: error.message || "Ocurrió un error al comprar.", icon: "error", confirmButtonText: "OK" });

    }

  };

  // Actualizar el contador cada segundo y manejar pestaña inactiva
  useEffect(() => {
    if (fechaExpiracion === null) return;

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

    return Number(total.toFixed(2));
  };

  const increment = () => setBoletos((prev) => (prev < limite && ((modalProps?.asientosDisponibles && (prev < modalProps?.asientosDisponibles)) || !modalProps?.asientosDisponibles) ? prev + 1 : prev));
  const decrement = () => setBoletos((prev) => (prev > 1 ? prev - 1 : 1));

  const handleClickSeccionAdicional = async (seccion: any) => {
    setPrecioBoletos(+seccion.precioSeccion);
    setIsModalOpen(true);
    setModalProps(seccion);
    if (evento && evento.udsPorCategoria) setUds(parseFloat(seccion.uds));
    setSeccionId(seccion.id);

    // Saltar paso 1
    await handleReservarAsientos(seccion.id);
    setStep((prevStep) => prevStep + 1);

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
        evento_id: eventoId
      };

      const res = await apiApplication.post('/promociones/validar_clave_web', params);

      if (res.data.id) {
        const promo = res.data;
        console.log("🚀 ~ handleCheckDiscount ~ promo:", promo)
        setPromocion(promo);

        const categoriasValidas = promo.categorias.map((cat: { categoriaGeneral: { nombre: string; }; }) => cat.categoriaGeneral?.nombre).filter((cat: string) => cat !== null && cat !== undefined);

        console.log("🚀 ~ handleCheckDiscount ~ categoriasValidas:", categoriasValidas)
        if (!promo.aplicaTodoEvento && !categoriasValidas.includes(modalProps?.nombreEspecial)) {
          toast.error(`El código de descuento no es válido para la sección ${modalProps?.nombreEspecial}.`);
          return;
        }

        // Simulando cuenta 
        setPromocionID(res.data.id);
        setDiscountPorcent(parseFloat(res.data.porcentaje));
        console.log(discountPorcent);
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

        // const nuevoTotal = Math.max(0, (boletos * precioBoletos) - descuentoAplicado);
        setDiscountAmount(descuentoAplicado);
        // setTotalWithDiscount(nuevoTotal);

        toast.success(`Descuento aplicado correctamente!`);

      } else {
        toast.error(`Código de descuento inválido.`);
      }

    } catch (err) {
      toast.error(`Código de descuento inválido.`);
      setDiscountAmount(0);
      // setTotalWithDiscount(boletos * precioBoletos);
    } finally {
      setIsCheckingCode(false);
    }
  };

   useEffect(() => {
    if (claveAccesoEvento == claveAcceso) {
      setAcceso(true);
    } else {
      setAcceso(false);
    }
  }, [claveAcceso]);

  return (
    <div>

      {cargando && (
        <Loader />
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

        <>
          <ConferenciaHero conferencia={evento} />
          <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 relative mb-10 mt-36">
            <div className="grid lg:grid-cols-2 gap-4">
              <aside className="p-3 md:p-4 bg-white rounded-2xl shadow-sm border border-gray-200 space-y-4 hidden">
                <Link href={`/cosmotech/${evento.id}`} className='bg-gray-900 text-white rounded-full px-4 py-2 inline-flex items-center gap-x-2'><FaArrowLeftLong className='flex-none' />Regresar al inicio</Link>
                <figure>
                  <img className='rounded-2xl aspect-video object-cover max-h-[30rem]' src={evento.imagenPromocion || '/beneficio_4.webp'} alt="" />
                </figure>
                <h3 className='font-semibold text-2xl text-gray-800'>{evento.nombre}</h3>
                <p className='text-base lg:text-lg text-gray-600 flex items-center gap-x-2 font-medium'><HiOutlineCalendarDateRange className='flex-none' size={36} />{formatDate(evento.fecha)}</p>
                <p className='text-base lg:text-lg text-gray-600 flex items-center gap-x-2 font-medium'><IoLocationOutline className='flex-none' size={36} />{evento.ubicacion}</p>
                <span className='bg-amber-100 text-amber-700 uppercase px-3 py-1 text-sm rounded-full font-semibold inline-block'>Importante</span>
                <p className='text-base lg:text-lg text-gray-600  font-medium'>Después de registrarte <strong>recibirás un código QR</strong> digital que deberás descargar. <br />Este será tu pase de entrada al evento.</p>
              </aside>
              <section className='mx-auto col-span-2 p-3 md:p-4 bg-white rounded-2xl shadow-sm border border-gray-200'>
                <h3 className='text-2xl font-semibold text-center text-gray-800 mb-2'>Registrate aquí</h3>
                <p className='text-center text-gray-600'>Complete el formulario para registrarte en nuestro evento.</p>
                {seccionesAdicionales?.map((seccion, index) => (
                  <div
                    key={seccion.id || index}
                    className="border border-gray-200 rounded-xl bg-white shadow-sm p-2 lg:p-3 flex flex-col items-start justify-between min-w-60"
                  >
                    <h5 className="text-base font-light text-gray-700 flex flex-wrap items-center gap-x-1">
                      <span
                        className="rounded-md w-8 h-8 grid place-items-center"
                        style={{ backgroundColor: seccion.colorGeneral }}
                      >
                        <TbTicket className="text-white" size={20} />
                      </span>
                      <span className="text-lg">{seccion.nombreEspecial}</span>
                    </h5>
                    {/* Nombre de la seccion, solo si la tiene: sirve para diferenciar generales adicionales */}
                    {seccion.nombre && seccion.nombre !== seccion.nombreEspecial && (
                      <p className="text-sm text-gray-500">Sección {seccion.nombre}</p>
                    )}

                    <p className="my-2 font-semibold text-xl text-gray-800 text-center w-full">
                      {Math.abs(Number(seccion.precioSeccion)) < 0.01
                        ? "Invitado"
                        : formatearDinero(Number(seccion.precioSeccion))}
                    </p>

                    <button
                      onClick={() => handleClickSeccionAdicional(seccion)}
                      disabled={
                        seccion?.asientosDisponibles === null ||
                        seccion?.asientosDisponibles === 0
                      }
                      className={`mt-auto w-full px-3 py-2 rounded-md bg-accentBase hover:bg-emphasis text-white text-sm transition-colors ${
                        seccion?.asientosDisponibles === null ||
                        seccion?.asientosDisponibles === 0
                          ? "cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {seccion?.asientosDisponibles <= 0 ? "Agotados" : "Registrarse"}
                    </button>
                  </div>
                ))}
              </section>
            </div>
          </div>
          <ConferenciaFooter conferencia={evento} />
        </>


      )}

      {/* Modal de compra */}
      {isModalOpen && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className={`bg-white p-2 md:p-4 rounded-2xl shadow-2xl w-11/12 max-h-[95vh] overflow-y-auto relative ${step === 1 ? 'max-w-lg' : 'max-w-4xl'}`}>

            {/* Botón de cerrar */}
            <button
              onClick={(e) => handleModalClose(e)}
              className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IoIosClose className="text-3xl" />
            </button>

            {/* Contenido Paso 1 */}
            {step === 1 && (
              <>
                {/* Encabezado */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
                  <div className="text-xl font-semibold text-gray-800 capitalize">
                    {modalProps?.asientosDisponibles
                      ? `${modalProps?.nombreEspecial}, ${modalProps?.bloque} - ${modalProps?.tipo_seccion}`
                      : `${modalProps?.nombre}, ${modalProps?.bloque} - ${modalProps?.tipo_seccion}`}
                  </div>
                  <div className="mt-2 md:mt-0 text-sm text-gray-600">
                    Disponibles:
                    <span className="ml-2 px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold shadow-sm">
                      {modalProps?.asientosDisponibles}
                    </span>
                  </div>
                </div>

                {/* Precios */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg w-10 h-10 flex items-center justify-center" style={{ backgroundColor: `${modalProps?.colorGeneral}` }}>
                      <TbTicket className="text-white text-lg" />
                    </div>
                    <span className="text-gray-800 font-medium">{modalProps?.tipo_seccion ?? "N/A"}</span>
                  </div>
                  {Math.abs(Number(precioBoletos)) < 0.01 ? (
                    <p className="text-accentLight font-semibold text-lg ml-auto">Invitado</p>
                  ) : (
                    <div className="flex items-center justify-between md:justify-end gap-2">
                      <p className="text-gray-500 text-sm">Precio por asiento:</p>
                      <span className="font-bold text-2xl text-accentLight">
                        ${Number(precioBoletos).toFixed(2)}
                      </span>
                    </div>
                  )}

                </div>

                <hr className="my-5 border-gray-200" />

                {/* Selector de boletos */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-5 gap-4">
                  <label htmlFor="boletos_general" className="text-gray-600 font-medium">Cantidad de boletos</label>
                  <div className="flex items-center border border-gray-300 rounded-full overflow-hidden">
                    <button onClick={decrement} className="w-10 h-10 grid place-items-center text-gray-600 hover:bg-gray-100 transition">
                      <FiMinus />
                    </button>
                    <input
                      id="boletos_general"
                      type="number"
                      value={boletos}
                      onChange={handleBoletosChange}
                      min="1"
                      max={limite}
                      className="w-16 text-center border-l border-r border-gray-300 focus:outline-none"
                    />
                    <button onClick={increment} className="w-10 h-10 bg-accentBase text-white grid place-items-center hover:bg-accentHover transition">
                      <FiPlus className="text-xl" />
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center text-3xl font-bold text-accentLight mb-6">
                  <span>Total:</span>
                  <span>
                    {Math.abs(precioBoletos * boletos) < 0.01 ? "Invitado" : `$${(precioBoletos * boletos).toFixed(2)}`}
                  </span>
                </div>

                {/* Botón siguiente */}
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={modalProps?.asientosDisponibles === null || modalProps?.asientosDisponibles === 0}
                  className={`w-full py-3 rounded-lg text-white font-semibold transition-colors ${modalProps?.asientosDisponibles ? 'bg-accentBase hover:bg-accentHover' : 'bg-gray-300 cursor-not-allowed'}`}
                >
                  Siguiente
                </button>
              </>
            )}

            {/* Contenido del Paso 2 */}
            {step === 2 && (

              <div className='grid grid-cols-2 gap-3 text-gray-500'>

                {/* SECCION IZQUIERDA */}
                <section className="col-span-2 lg:col-span-1 flex- flex-col gap-4 hidden">

                  {/* INFO DEL EVENTO */}
                  <div className="bg-gray-50 p-4 rounded-xl shadow-sm flex flex-col gap-2">
                    {/* <p className="bg-gray-100 text-center inline-block px-3 py-1 rounded-full text-sm text-gray-600">
                      {boletos} {boletos === 1 ? 'asiento' : 'asientos'} {boletos === 1 ? 'seleccionado' : 'seleccionados'}
                    </p> */}
                    <p className="text-sm text-gray-500">Conferencia <span className="block font-medium text-gray-800">{evento?.nombre}</span></p>
                    <p className="text-sm text-gray-500">Fecha <span className="block font-medium text-gray-800">{evento?.fecha ? formatDate(evento.fecha) : 'Fecha no disponible'}</span></p>
                    <img className="rounded-md w-24 h-24 object-cover mt-2 self-end" src={evento?.imagenPromocion} alt="" />
                  </div>

                  {/* ORDENES DE ARTÍCULOS */}
                  {Math.abs(Number(calcularTotal())) < 0.01
                    ? ""
                    : (
                      <div className="bg-gray-50 p-4 rounded-xl shadow-sm flex flex-col gap-2">
                        <h3 className="font-semibold text-lg text-gray-800">Orden de artículos</h3>
                        <div className="flex justify-between text-sm text-gray-500 px-1 mb-2">
                          <span>Boleto</span>
                          <span>Precio</span>
                        </div>
                        <ul className="grid gap-2 overflow-y-auto max-h-32 pr-1">
                          {Array.from({ length: boletos }).map((_, index) => (
                            <li key={index} className="bg-white rounded-lg p-2 flex items-center gap-2 shadow-sm border border-gray-200">
                              <div className="rounded-lg w-7 h-7 flex items-center justify-center" style={{ backgroundColor: `${modalProps?.colorGeneral}` }}>
                                <TbTicket className="text-white text-lg" />
                              </div>
                              <div className="w-full">
                                <p className="font-medium text-gray-800">Asiento {modalProps?.tipo_seccion}</p>
                                <div className="flex justify-between text-gray-600">
                                  <span className='text-sm'>{modalProps?.nombreEspecial}, {modalProps?.nombre}, {modalProps?.bloque}</span>
                                  <span className="font-medium text-sm">
                                    {Math.abs(Number(precioBoletos)) < 0.01 ? "Invitado" : `$${precioBoletos}`}
                                  </span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  }

                  {/* PROMOCIÓN */}
                  {habilitaPromocion && (
                    <div className="bg-gray-50 p-4 rounded-xl shadow-sm flex items-center justify-between gap-2 text-sm">
                      <span>Código de descuento:</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Escriba el código"
                          className="w-36 p-2 border border-gray-300 rounded-md text-right placeholder-gray-400 uppercase"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value)}
                        />
                        <button
                          type="button"
                          className={`px-2 rounded-md text-white transition-colors ${isCheckingCode ? 'bg-gray-300' : 'bg-accentBase hover:bg-accentHover'}`}
                          onClick={handleCheckDiscount}
                          disabled={isCheckingCode}
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RESUMEN DE COMPRA */}
                  <div className="bg-gray-50 p-4 rounded-xl shadow-sm flex flex-col gap-2">
                    <h3 className="font-semibold text-lg text-gray-800">Resumen</h3>
                    <div className="flex flex-col gap-1 text-sm text-gray-600">
                      <p className="flex justify-between">
                        {boletos} x {boletos === 1 ? "entrada" : "boletos"}:{" "}
                        <span className="font-medium">
                          {Math.abs(Number(precioBoletos)) < 0.01
                            ? "Invitado"
                            : `$${(boletos * precioBoletos).toFixed(2)}`}
                        </span>
                      </p>

                      {discountAmount > 0 && (
                        <p className="flex justify-between">
                          Descuento {promocion.nombre}:{" "}
                          <span className="font-medium">-${discountAmount}</span>
                        </p>
                      )}

                      {/* Mostrar estos campos solo si el total no es cero */}
                      {Math.abs(Number(calcularTotal())) >= 0.01 && (
                        <>
                          <p className="flex justify-between">
                            Subtotal:{" "}
                            <span className="font-medium">
                              ${((boletos * precioBoletos) - discountAmount).toFixed(2)}
                            </span>
                          </p>

                          <p className="flex justify-between">
                            Cargo por servicio:{" "}
                            <span className="font-medium">
                              ${(uds * ((boletos * precioBoletos) - discountAmount)).toFixed(2)}
                            </span>
                          </p>

                          <p className="flex justify-between">
                            Cargo por uso de tarjeta:{" "}
                            <span className="font-medium">
                              ${(udt * ((boletos * precioBoletos) - discountAmount)).toFixed(2)}
                            </span>
                          </p>
                          {ivaApplied && (
                            <p className="flex justify-between">
                              IVA:{" "}
                              <span className="font-medium">
                                ${(iva * ((boletos * precioBoletos) - discountAmount)).toFixed(2)}
                              </span>
                            </p>
                          )}
                        </>
                      )}

                      <hr className="my-2 border-gray-200" />

                      <p className="flex justify-between font-bold text-xl lg:text-2xl text-accentLight">
                        {Math.abs(Number(calcularTotal())) < 0.01
                          ? ""
                          : `Total`}
                        <span className='ml-auto'>
                          {Math.abs(Number(calcularTotal())) < 0.01
                            ? "Invitado"
                            : `$${Number(calcularTotal()).toFixed(2)}`}
                        </span>
                      </p>
                    </div>
                  </div>

                </section>

                {/* SECCION DERECHA */}
                <section className="col-span-2 lg:col-span-2 flex flex-col gap-4 relative">
                  {/* TIMER */}
                  {reservaExitosa && (
                    <div className="w-full max-w-2xl mx-auto p-4 bg-gray-100 rounded-xl shadow-sm flex flex-col gap-2">
                      {renderTimer()}
                    </div>
                  )}

                  {/* FORMULARIO */}
                  <div className="w-full max-w-2xl mx-auto p-4 bg-gray-100 rounded-xl shadow-sm flex flex-col gap-4 relative">

                    <div className="scrolldown absolute right-50 z-50 -top-10 -left-10">
                      <div className="chevrons">
                        <div className="chevrondown"></div>
                        <div className="chevrondown"></div>
                      </div>
                    </div>

                    {/* CAMPOS */}
                    <div className="">
                      <h2 className="text-xl text-center font-semibold text-gray-700 mb-4">
                        Registro para la conferencia
                      </h2>

                      {/* Selector de tipo de participante */}
                      <div className="flex justify-center gap-4 mb-6">
                        <button
                          type="button"
                          className={`px-6 py-1 rounded-full font-semibold text-xs transition-all duration-200 ${formValues.tipoParticipante === 'invitado'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          onClick={() => setFormValues({ ...formValues, tipoParticipante: 'invitado' })}
                        >
                          Invitado
                        </button>

                        <button
                          type="button"
                          className={`px-6 py-2 rounded-full font-semibold text-xs transition-all duration-200 ${formValues.tipoParticipante === 'expositor'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          onClick={() => setFormValues({ ...formValues, tipoParticipante: 'expositor' })}
                        >
                          Expositor
                        </button>
                      </div>

                      {/* Campos comunes */}
                      {(formValues.tipoParticipante === 'invitado' || (formValues.tipoParticipante === 'expositor' && acceso == true)) && (

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

                          {/* NOMBRE */}
                          <div className='col-span-2 lg:col-span-1'>
                            <label className="text-sm text-gray-600 font-medium mb-1 block">Nombre completo</label>
                            <input
                              type="text"
                              name="nombre_conferencia"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                              placeholder="Nombre completo"
                              value={formValues.nombre_conferencia}
                              onChange={(e) => setFormValues({ ...formValues, nombre_conferencia: e.target.value })}
                              required
                            />
                          </div>

                          <div className='col-span-2 lg:col-span-1'>
                            <label className="text-sm text-gray-600 font-medium mb-1 block">Número de teléfono</label>
                            <input
                              type="tel"
                              name="telefono_conferencia"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                              placeholder="Número de teléfono"
                              value={formValues.telefono_conferencia}
                              onChange={(e) => setFormValues({ ...formValues, telefono_conferencia: e.target.value })}
                              required
                            />
                          </div>

                          <div className='col-span-2 lg:col-span-1'>
                            <label className="text-sm text-gray-600 font-medium mb-1 block">Empresa</label>
                            <input
                              type="text"
                              name="empresa_conferencia"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                              placeholder="Empresa"
                              value={formValues.empresa_conferencia}
                              onChange={(e) => setFormValues({ ...formValues, empresa_conferencia: e.target.value })}
                              required
                            />
                          </div>

                          <div className='col-span-2 lg:col-span-1'>
                            <label className="text-sm text-gray-600 font-medium mb-1 block">Puesto</label>
                            <input
                              type="text"
                              name="puesto_conferencia"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                              placeholder="Puesto"
                              value={formValues.puesto_conferencia}
                              onChange={(e) => setFormValues({ ...formValues, puesto_conferencia: e.target.value })}
                              required
                            />
                          </div>

                          <div className='col-span-2 lg:col-span-1'>
                            <label className="text-sm text-gray-600 font-medium mb-1 flex items-center gap-x-2">
                              Correo electrónico
                              {/* <span className="text-xs text-red-400 ml-auto">(Aquí recibirás tus boletos)</span> */}
                            </label>
                            <input
                              type="email"
                              name="correo_conferencia"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                              placeholder="Correo electrónico"
                              value={formValues.correo_conferencia}
                              onChange={(e) => setFormValues({ ...formValues, correo_conferencia: e.target.value })}
                              required
                            />
                          </div>

                          {/* FOTO */}
                          <div className="col-span-2 lg:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Foto</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                // Validar tipo de archivo
                                if (!file.type.startsWith("image/")) {
                                  Swal.fire({
                                    title: "Archivo inválido",
                                    text: "Por favor selecciona una imagen válida (jpg, png, webp, etc.)",
                                    icon: "warning",
                                    confirmButtonColor: "#7c3aed",
                                  });
                                  e.target.value = "";
                                  return;
                                }

                                const img = new Image();
                                img.src = URL.createObjectURL(file);

                                img.onload = () => {
                                  const { width, height } = img;

                                  const preguntarContinuar = (
                                    mensaje: string,
                                    icono: SweetAlertIcon = "warning"
                                  ) => {
                                    Swal.fire({
                                      title: "Tamaño no recomendado",
                                      text: mensaje,
                                      icon: icono,
                                      showCancelButton: true,
                                      confirmButtonText: "Continuar de todos modos",
                                      cancelButtonText: "Elegir otra imagen",
                                      confirmButtonColor: "#7c3aed",
                                      cancelButtonColor: "#ef4444",
                                    }).then((result) => {
                                      if (result.isConfirmed) {
                                        setFormValues({ ...formValues, foto: file });
                                      } else {
                                        e.target.value = "";
                                      }
                                    });
                                  };

                                  if (width < 300 || height < 300) {
                                    preguntarContinuar(
                                      `Tu imagen mide ${width}x${height}px. El mínimo recomendado es 300x300 px.`,
                                      "info"
                                    );
                                  } else if (width > 400 || height > 400) {
                                    preguntarContinuar(
                                      `Tu imagen mide ${width}x${height}px. El máximo recomendado es 400x400 px.`,
                                      "info"
                                    );
                                  } else {
                                    setFormValues({ ...formValues, foto: file });
                                  }

                                  URL.revokeObjectURL(img.src);
                                };
                              }}
                              className="w-full border border-gray-300 rounded-lg p-0.5 text-gray-800 bg-gray-50 
                              file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium 
                              file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                            />

                            <span className="text-gray-500 text-xs mb-1 hidden">
                              (Las imágenes deben medir un mínimo de 300x300 px y un máximo de 400x400 px)
                            </span>
                            {/* Previsualización de la foto */}
                            {formValues.foto && (
                              <div className="mt-3 flex items-center justify-center">
                                <img
                                  src={
                                    formValues.foto instanceof File
                                      ? URL.createObjectURL(formValues.foto)
                                      : formValues.foto
                                  }
                                  alt="Foto del invitado"
                                  className="w-28 h-28 object-contain border rounded-lg shadow-sm"
                                />
                              </div>
                            )}
                          </div>

                        </div>

                      )}

                      {/* Campos adicionales si es Expositor */}
                      {(formValues.tipoParticipante === 'expositor' && acceso == true) && (
                        <div className="mt-6 space-y-4">
                          <div>
                            <label className="text-sm text-gray-600 font-medium mb-1 block">Temas a exponer</label>
                            <textarea
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                              rows={2}
                              placeholder="Describe los temas que abordarás..."
                              value={formValues.temas_exponer || ''}
                              onChange={(e) => setFormValues({ ...formValues, temas_exponer: e.target.value })}
                            ></textarea>
                          </div>

                          <div>
                            <label className="text-sm text-gray-600 font-medium mb-1 block">¿Qué vas a ofrecer?</label>
                            <textarea
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                              rows={2}
                              placeholder="Menciona lo que ofrecerás en tu espacio..."
                              value={formValues.que_ofrecer || ''}
                              onChange={(e) => setFormValues({ ...formValues, que_ofrecer: e.target.value })}
                            ></textarea>
                          </div>

                          <div>
                            <label className="text-sm text-gray-600 font-medium mb-1 block">Requerimientos del espacio</label>
                            <textarea
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                              rows={2}
                              placeholder="Ejemplo: conexión eléctrica, mesas, sillas, etc."
                              value={formValues.requerimientos_espacio || ''}
                              onChange={(e) => setFormValues({ ...formValues, requerimientos_espacio: e.target.value })}
                            ></textarea>
                          </div>

                          <div>
                            <label className="text-sm text-gray-600 font-medium mb-1 block">¿Cuántas personas serán?</label>
                            <input
                              type="number"
                              min="1"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                              placeholder="Número de personas"
                              value={formValues.personas_expositor || ''}
                              onChange={(e) => setFormValues({ ...formValues, personas_expositor: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {/* Clave de acceso para un expositor */}
                      {formValues.tipoParticipante === 'expositor' && acceso === false && (
                        <div className="mt-6">
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                            <label
                              htmlFor="claveAcceso"
                              className="block text-sm font-semibold text-accentBase mb-2"
                            >
                              Ingresa tu clave de acceso
                            </label>

                            <div className="relative">
                              <input
                                id="claveAcceso"
                                type="text"
                                className="w-full px-4 py-2 pr-10 border border-blue-300 rounded-lg shadow-inner bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all text-gray-700 placeholder-gray-400"
                                placeholder="Ejemplo: EXPO-1234"
                                onChange={(e) => setClaveAcceso(e.target.value)}
                              />

                              {/* Ícono opcional */}
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-accentBase">
                                <IoKey className='flex-none' size={24} />
                              </span>
                            </div>

                            <p className="text-xs text-gray-500 mt-2">
                              Esta clave te la proporcionó el administrador del evento.
                            </p>
                          </div>
                        </div>
                      )}


                    </div>

                    {(precioBoletos > 0) && (

                      <>

                        {/* METODO DE PAGO */}
                        <h3 className="font-semibold text-lg text-gray-800">Seleccionar método de pago</h3>

                        <div className="flex gap-2">

                          <label className="w-full text-sm font-medium h-10 relative hover:bg-zinc-100 flex items-center px-2 gap-2 rounded-lg has-[:checked]:text-blue-500 has-[:checked]:bg-blue-50 has-[:checked]:ring-blue-300 has-[:checked]:ring-1 select-none">
                            <input
                              className="w-4 h-4 absolute accent-current right-3"
                              type="radio"
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
                                checked={tabMetodo === 'tarjetas_guardadas'}
                                onChange={() => setTabMetodo('tarjetas_guardadas')}
                              />
                              Tarjetas guardadas
                            </label>
                          )}

                        </div>

                        {/* TARJETAS */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <p className="text-gray-500 text-sm">Tarjetas de crédito</p>
                            <div className="flex flex-wrap gap-3 mt-2">
                              <img className="w-10 h-6 object-contain" src="/visa.png" alt="Visa" />
                              <img className="w-10 h-6 object-contain" src="/masterCard.png" alt="MasterCard" />
                              <img className="w-10 h-6 object-contain" src="/americanExpress.png" alt="American Express" />
                              <img className="w-12 h-6 object-contain" src="/carnet.png" alt="Carnet" />
                            </div>
                          </div>

                          <div>
                            <p className="text-gray-500 text-sm">Tarjetas de débito</p>
                            <div className="flex flex-wrap gap-3 mt-2">
                              <img className="w-12 h-6 object-contain" src="/BBVA.png" alt="BBVA" />
                              <img className="w-12 h-6 object-contain" src="/santander.png" alt="Santander" />
                              <img className="w-12 h-6 object-contain" src="/hsbc.png" alt="HSBC" />
                              <img className="w-12 h-6 object-contain" src="/scotiabank.png" alt="Scotiabank" />
                              <img className="w-12 h-6 object-contain" src="/inbursa.png" alt="Inbursa" />
                              <img className="w-12 h-6 object-contain" src="/ixe.png" alt="IXE" />
                            </div>
                          </div>
                        </div>

                        {/* NUEVA TARJETA */}
                        {tabMetodo === 'nueva_tarjeta' && (
                          <div className="flex flex-col gap-3">

                            <div className="flex flex-col gap-1">
                              <label className="text-sm text-gray-500 font-semibold">Nombre del titular</label>
                              <input
                                type="text"
                                placeholder="Nombre en la tarjeta"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                value={formValues.nombre}
                                onChange={(e) => setFormValues({ ...formValues, nombre: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-sm text-gray-500 font-semibold">Número de la tarjeta</label>
                              <input
                                type="text"
                                placeholder="Número de tarjeta"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                value={formValues.tarjeta}
                                onChange={(e) => setFormValues({ ...formValues, tarjeta: e.target.value.replace(/\D/g, '') })}
                                maxLength={19}
                              />
                            </div>

                            <div className="flex gap-2">
                              <div className="flex-1 flex flex-col gap-1">
                                <label className="text-sm text-gray-500 font-semibold">Fecha de vencimiento</label>
                                <input
                                  type="text"
                                  placeholder="MM/AA"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                  value={expiracion}
                                  onChange={handleExpiracionChange}
                                  maxLength={5}
                                />
                              </div>

                              <div className="flex-1 flex flex-col gap-1">
                                <label className="text-sm text-gray-500 font-semibold">CVV</label>
                                <input
                                  type="text"
                                  placeholder="CVV"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                  value={formValues.cvv}
                                  onChange={(e) => setFormValues({ ...formValues, cvv: e.target.value.replace(/\D/g, '') })}
                                  maxLength={4}
                                />
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              <figure className="flex justify-end items-center gap-2">
                                <small className="text-gray-500 text-xs">Transacciones realizadas vía:</small>
                                <img className="w-24 h-12 object-contain" src="/openpay.webp" alt="OpenPay" />
                              </figure>
                              <figure className="flex items-center gap-2">
                                <LuBadgeCheck className="text-green-500 text-3xl" />
                                <small className="text-gray-500 text-xs">Tus pagos se realizan de forma segura con encriptación de 256 bits</small>
                              </figure>
                            </div>

                          </div>
                        )}

                        {/* TARJETAS GUARDADAS */}
                        {tabMetodo === 'tarjetas_guardadas' && tarjetas.length > 0 && (
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
                              <img width={100} height={60} src="/openpay.webp" alt="" />
                            </figure>
                          </div>
                        )}

                      </>

                    )}

                  </div>

                  {/* FOOTER */}
                  <footer className="flex flex-col gap-2 max-w-2xl mx-auto">
                    <p className="text-center text-xs text-gray-500">
                      Al hacer clic en el botón, confirmas que has leído y aceptas nuestros términos y condiciones, así como nuestra política de privacidad.
                    </p>
                    {reservaExitosa && (
                      <>
                        <button
                          onClick={handleVenderGenerales}
                          className="w-full px-4 py-2 bg-accentBase hover:bg-accentHover text-white rounded-lg transition-colors"
                        >
                          Registrarse
                        </button>
                        <button
                          onClick={handleCancelarCompra}
                          className="w-full px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </footer>

                </section>

              </div>

            )}

          </div>
        </div>
      )}

    </div>
  );

};

export default FormConferenciaPage;