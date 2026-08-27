"use client";

import { Suspense, useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SpinnerComponent from '../../../../../../eventos/components/spinnerComponent';
import { IoTrashOutline, IoInformationCircle } from "react-icons/io5";
import Tooltip from '../../../../../../publicUi/components/TooltipComponent';
import Loader from '../../../../../../publicUi/components/Loader';
import { toast } from 'react-toastify';
import { validarNumeroTarjeta, validarCVC } from '../../../../../../utils/cardHelpers';
import type { EventoResuelto } from '../../../../../../utils/eventoSlug';
import LocalLoader from '../../../../../../components/LocalLoader';

declare global {
  interface Window {
    OpenPay: any;
  }
}

import { useMetaPixel, usePixelsDeEvento } from '../../../../../../hooks/useMetaPixel';
import { useEventosStore } from '../../../../../../hooks/useEventosStore';
import { useAuthStore } from '../../../../../../hooks/useAuthStore';
import { useAuthModal } from '../../../../../../context/AuthModalContext';
import { MdKeyboardBackspace } from "react-icons/md";
import { TbTicket } from "react-icons/tb";
import { LuBadgeCheck } from "react-icons/lu";
import Swal from 'sweetalert2';
import apiApplication from '../../../../../../api/apiApplication';
import ListaPreciosCategorias from '../../../../../../eventos/components/ListaPreciosCategorias';
import { formatearDinero } from '../../../../../../eventos/helpers/formatearDinero';
import AsientosStatusComponent from '../../../../../../eventos/components/AsientosStatusComponent';
import { formatDate } from '../../../../../../utils/dateHelpers';

interface Asiento {
    id: number;
    numero: string;
    estado: 'disponible' | 'vendido' | 'bloqueado' | 'inaccesible' | 'reservado' | 'cortesia';
    precio: number;
    fila: string;
    categoria: string;
    color: string;
}

interface TarjetaGuardada {
  id: number,
  idtarjeta: string;
  tarjeta: string;
  banco: string,
}

interface Evento {
  id: number;
  nombre: string;
  categoria: string;
  recinto: Recinto;
  fecha: string;
  ciudad: Ciudad;
  artista: Artista;
  imagenPromocion: string;
  udsPorCategoria: boolean;
  cargosPorCategoria: {id:number, categoria:string, cargoPorCategoria:string}[];
  esGratuito: boolean;
  limiteDeAsientos: number | null;
  // Pixels de Meta del promotor de este evento (ademas de los de la marca).
  metaPixels?: string[];
}

interface Recinto {
  id: number;
  nombre: string;
}
interface Ciudad {
  id: number;
  nombre: string;
}
interface Artista {
  id: number;
  nombre: string;
}
interface Categorias {
  precios: [];
  categoria: string;
  color: string,
}

interface MejorPromo {
  id:number,
  nombre: string,
  aplicaTodoEvento: boolean,
  porcentaje: string,
  tipo:'PORCENTAJE' | 'CANTIDAD',
  cantidadPaga:number,
  cantidadCompra:number,
  descuentoCalculado:number,
  categorias: { categoria: { nombre: string } }[]
}

export default function SeccionAsientoPage() {
  return (
    <Suspense fallback={<LocalLoader />}>
      <SeccionAsientoContent />
    </Suspense>
  );
}

function SeccionAsientoContent() {

    // stores:
    const { checkAuthToken, user, status } = useAuthStore();
    const { requestLogin } = useAuthModal();
    const [reservaPendiente, setReservaPendiente] = useState(false);
    // [INVITADO DESHABILITADO] reservarInvitado retirado del destructure; el flujo de invitado redirige al login.
    const { getDetalleEventos, getFilasSeccion, reservar, cancelar, resolverSlugEvento } = useEventosStore();

    //variables de ruta
    // El primer segmento es el slug del evento; la seccion si sigue siendo un id.
    const { slug, seccionId, seccion } = useParams<{ slug: string, seccionId: string, seccion: string }>();
    const [resuelto, setResuelto] = useState<EventoResuelto | null>(null);
    const eventoId = resuelto?.eventoId;
    const searchParams = useSearchParams();
    // La funcion viene dentro del slug; los query params son compatibilidad con enlaces viejos.
    const funcionId: string | null =
        resuelto?.funcionId ?? searchParams.get('funcionId') ?? searchParams.get('funcion');

    //variables de estado
    const [filas, setFilas] = useState<any[]>([]);
    const [subtotal, setSubotal] = useState<number>(0);
    const [totalBoletos, setTotalBoletos] = useState<number>(0);
    const [tiempoRestante, setTiempoRestante] = useState<number | null>(null);
    const [fechaExpiracion, setFechaExpiracion] = useState<number | null>(null);
    const [asientosSeleccionados, setAsientosSeleccionados] = useState<Asiento[]>([]);
    const [reservaId, setReservaId] = useState<string | null>(null);
    const [reservaExitosa, setReservaExitosa] = useState<boolean>(false);
    const [formValues, setFormValues] = useState({nombre: '', tarjeta: '', expiracion: '', cvv: '',});
    const [hoveredAsiento, setHoveredAsiento] = useState<Asiento | null>(null);
    const [preciosCategorias, setPreciosCategorias] = useState<Categorias[]>([]);
    const [deviceDataId, setDeviceDataId] = useState<string | null>(null);
    const [tarjetas, setTarjetas] = useState<TarjetaGuardada[]>([]);
    const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);
    const [udt, setUdt] = useState<number>(0);
    const [uds, setUds] = useState<number>(0);
    const [iva, setIva] = useState<number>(0);
    const [expiracion, setExpiracion] = useState("");
    const [expirationYear, setExpirationYear] = useState("");
    const [expirationMonth, setExpirationMonth] = useState("");
    const [openId, setOpenId] = useState<string | null>(null);
    const [evento, setEvento] = useState<Evento>();
    // Suma el pixel del promotor de este evento a los de la marca mientras la pagina
    // este montada. Ver docs/meta-pixel-frontend.md
    usePixelsDeEvento(evento?.metaPixels);
    const { agregarAlCarrito } = useMetaPixel();
    const [compraExitosa, setCompraExitosa] = useState(false);
    const [orientacion, setOrientacion] = useState('');
    const [usuarioInvitado, setUsuarioInvitado] = useState<boolean>(false);

    const resumenRef = useRef<HTMLDivElement | null>(null);
    const pagoRef = useRef<HTMLDivElement | null>(null);

    // Codigos de descuento
    const [discountCode, setDiscountCode] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountPorcent, setDiscountPorcent] = useState(0);
    const [promocion_id, setPromocionID] = useState(0);
    const [isCheckingCode, setIsCheckingCode] = useState(false);
    const [habilitaPromocion, setHabilitaPromocion] = useState(false);
    const [cargosPorCategoria, setCargosPorCategoria] = useState<{ id: number; categoria: string; cargoPorCategoria: string }[]>([]);
    const [subtotalesPorCategoria, setSubtotalesPorCategoria] = useState<Record<string, number>>({});
    const [UDS, setUDS] = useState<number>(0);
    const [tipoPromocion, setTipoPromocion] = useState<string>('');
    const [cantidadesPromocion, setCantidadesPromocion] = useState<{ cantidadCompra: number; cantidadPaga: number } >({cantidadCompra: 0, cantidadPaga: 0});
    const [aplicaTodoEvento, setAplicaTodoEvento] = useState<boolean>(false);
    const [categoriasPromo, setCategoriasPromo] = useState<{ categoria: { nombre: string } }[]>([]);
    const [promocionesAplicanDirecto, setPromocionesAplicanDirecto] = useState<any[]>([]);
    const [promoNombre, setPromoNombre] = useState<string>('');

    // [INVITADO DESHABILITADO] setFormValuesInvitado retirado del destructure; el formulario de invitado está comentado.
    const [formValuesInvitado] = useState({nombre_invitado: '', correo_invitado: ''});

    // Mesa
    const [isMesa, setEsMesa] = useState(false);

    useEffect(() => {

      const getCredenciales = async () => {
        const res = await apiApplication.get('/pagos/get/credenciales');
        const {data} = res;
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
            const {merchantId, publicKey, sandbox} = await getCredenciales();
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

    const procesarPago = async () => {
      try {
        setCargando(true);

        // 🛑 CONFIRMACIÓN ANTES DE PROCESAR EL PAGO
        const confirmacionPago = await Swal.fire({
          title: "¿Confirmar compra?",
          text: `Estás a punto de pagar ${formatearDinero(calcularTotal())} por tus boletos. ¿Deseas continuar?`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Sí, pagar",
          cancelButtonText: "Cancelar",
        });

        if (!confirmacionPago.isConfirmed) {
          setCargando(false);
          return; // 🚨 Salir si el usuario cancela el pago
        }

        // Construcción del payload del pago
        const payload: any = {
          reservaId,
          esGeneral: false,
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
          nombre_invitado: formValuesInvitado.nombre_invitado,
          correo_invitado: formValuesInvitado.correo_invitado,
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
          await apiApplication.post('/pagos/aplicar-promo', {promocionId:promocion_id, eventoId: evento?.id});
        }

        if (usuarioInvitado) {

          // 💳 PROCESAR EL PAGO
          const { data } = await apiApplication.post("/pagos/make/cargo_invitado", payload);
          console.log("Pago exitoso:", data);
          const transaccionId = data.cargo?.id;

          // Verificar si se requiere 3D Secure
          if (data.cargo?.payment_method?.url && data.cargo?.payment_method?.type === "redirect") {
            console.log("Se requiere autenticación 3D Secure. Redirigiendo...");
            window.location.href = data.cargo.payment_method.url;
            return;
          }

          // 🔄 CONFIRMAR EL CARGO SOLO SI NO HUBO 3D SECURE
          const res_cargo = await apiApplication.post(`/pagos/check/cargo/${transaccionId}`, {
            reservaId,
            esGeneral: false,
          });

          console.log("Ticket de pago", res_cargo);

          // ✅ MENSAJE DE ÉXITO
          setCargando(false);
          setCompraExitosa(true);

        } else {

          // 💳 PROCESAR EL PAGO
          const { data } = await apiApplication.post("/pagos/make/cargo", payload);
          console.log("Pago exitoso:", data);
          const transaccionId = data.cargo?.id;

          // Verificar si se requiere 3D Secure
          if (data.cargo?.payment_method?.url && data.cargo?.payment_method?.type === "redirect") {
            console.log("Se requiere autenticación 3D Secure. Redirigiendo...");
            window.location.href = data.cargo.payment_method.url;
            return;
          }

          // 🔄 CONFIRMAR EL CARGO SOLO SI NO HUBO 3D SECURE
          const res_cargo = await apiApplication.post(`/pagos/check/cargo/${transaccionId}`, {
            reservaId,
            esGeneral: false,
          });

          console.log("Ticket de pago", res_cargo);

          // ✅ MENSAJE DE ÉXITO
          setCargando(false);
          setCompraExitosa(true);

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

        if (error?.response?.data?.isPromoError){
          // Revertir la promoción aplicada
          setDiscountAmount(0);
          setDiscountPorcent(0);
          setPromocionID(0);
          setDiscountCode('');
          setIsCheckingCode(false);
          setSubotal(totalBoletos);
        }
      }
    };

    // Slug del evento -> { eventoId, funcionId }. Sin esto no hay a que evento pedirle nada.
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
          } else {
            setCargando(false);
            Swal.fire({ title: 'Evento no encontrado', text: 'El enlace no corresponde a un evento disponible.', icon: 'error', confirmButtonText: 'OK' });
          }
        } catch (error) {
          console.error('Error al resolver el slug del evento:', error);
          if (activo) setCargando(false);
        }
      })();
      return () => { activo = false; };
    }, [slug]);

    useEffect(() => {
      const fetchEvento = async () => {
        if (eventoId) {
          try {
            setCargando(true);
            habilitarpromocion(eventoId);
            const response = await getDetalleEventos(eventoId);
            if (funcionId && response.funciones) {
              const funcion = response.funciones.find((f: any) => f.id.toString() === funcionId);
              if (funcion) {
                response.fecha = funcion.fecha;
              }
            }
            // console.log(response.preciosCategorias);
            // setIva(parseFloat(response.ivaRate));
            setEvento(response);
          } catch (error: any) {
            console.error('Error al obtener el evento:', error);
            let mensajeError = 'Error al obtener el evento.';

            if (error.response && error.response.data && error.response.data.message) {
              mensajeError = error.response.data.message;
            } else if (error.message) {
              mensajeError = error.message;
            }
            Swal.fire({title: 'Error', text: mensajeError, icon: 'error',confirmButtonText: 'OK', });
          } finally {
            setCargando(false);
          }
        }
      };
      fetchEvento();
    }, [eventoId]);

    useEffect(() => {

      const fetchFilas = async () => {

        if (eventoId && seccionId) {
          try {

            const response = await getFilasSeccion(eventoId, seccionId, funcionId);

            setFilas(response.filas);
            setPreciosCategorias(response.preciosCategorias);
            setCargosPorCategoria(response.categoriasEvento);

            if (response.filas && response.filas.length > 0) {
              const parsedUdt = parseFloat(response.filas[0].udt);
              const parsedUds = parseFloat(response.filas[0].uds);
              setUdt(parsedUdt);
              setUds(parsedUds);
              setIva(parseFloat(response.filas[0].iva));
              setOrientacion(response.orientacionFilas);
            }

            // Validamos si es una mesa
            // ___________________________________________________

            if (response.esMesa) {

              let asientos_seleccionados = [];
              let total = 0;

              for (const fila of response.filas) {

                for (const asiento of fila.asientos) {
                  asientos_seleccionados.push(asiento);
                  total += Number(asiento.precio);
                  setSubtotalesPorCategoria(prev => ({
                    ...prev,
                    [asiento.categoria]: (prev[asiento.categoria] || 0) + Number(asiento.precio)
                  }));
                }

              }

              setAsientosSeleccionados(asientos_seleccionados);
              setTotalBoletos(total);

              setEsMesa(true);

            }

          } catch (error) {
            console.error('Error al obtener filas:', error);
          }
        }

      };

      fetchFilas();

    }, [eventoId, seccionId]);

    useEffect(() => {

      if (promocion_id != 0) {

        const asientosPorCategoriaPrecio = asientosSeleccionados.reduce((acc: { [categoria: string]: { [precio: number]: Asiento[] } }, asiento) => {
          const categoria = asiento.categoria;
          const precio = asiento.precio;
          if (!acc[categoria]) acc[categoria] = {};
          if (!acc[categoria][precio]) acc[categoria][precio] = [];
          acc[categoria][precio].push(asiento);
          return acc;
        }, {} as { [categoria: string]: { [precio: number]: Asiento[] } });

        let categoriasAplicables: string | string[] = [];
        if (!aplicaTodoEvento){
          const categoriasSeleccionadas = Object.keys(asientosPorCategoriaPrecio);
          const categoriasValidas = categoriasPromo.map((c: { categoria: { nombre: any; }; }) => c.categoria.nombre);
          categoriasAplicables = categoriasSeleccionadas.filter(cat => categoriasValidas.includes(cat));

          if (categoriasAplicables.length === 0) {
            toast.error(`Promocion solo valida para las siguientes categorías: ${categoriasValidas.join(', ')}`);
            setDiscountAmount(0);
            setDiscountPorcent(0);
            setPromocionID(0);
            setIsCheckingCode(false);
            return;
          }
        }

        let descuentoAplicado = 0;

        if (tipoPromocion === 'PORCENTAJE') {
          Object.entries(subtotalesPorCategoria).forEach(([categoria, subtotal]) => {
            if (aplicaTodoEvento || (!aplicaTodoEvento && categoriasAplicables.includes(categoria))) {
              const descuento = subtotal * (discountPorcent / 100);
              descuentoAplicado += descuento;
            }
          });

          const nuevoSubtotal = Math.max(0, totalBoletos - descuentoAplicado);
          setDiscountAmount(descuentoAplicado);
          setSubotal(nuevoSubtotal)
        }

        if (tipoPromocion === 'CANTIDAD'){
          const { cantidadCompra, cantidadPaga} = cantidadesPromocion;
          let algunaCategoriaCumple = false;

          Object.entries(asientosPorCategoriaPrecio).forEach(([categoria, preciosObj]) => {
            if (!aplicaTodoEvento && !categoriasAplicables.includes(categoria)) {
              return;
            }
            Object.entries(preciosObj as Record<string, Asiento[]>).forEach(([precio, asientos]) => {
              precio;
              const cantidad = asientos.length;
              const grupos = Math.floor(cantidad / cantidadCompra);
              if (cantidad >= cantidadCompra) {
                algunaCategoriaCumple = true;
              }
              for (let i = 0; i < grupos; i++) {
                const grupo = asientos.slice(i * cantidadCompra, (i + 1) * cantidadCompra);
                const gratis = grupo.slice(cantidadPaga);
                descuentoAplicado += gratis.reduce((acc, asiento) => acc + Number(asiento.precio), 0);
              }
            });
          });

          if (!algunaCategoriaCumple) {
            toast.error(`Debes seleccionar al menos ${cantidadCompra} asientos en una misma categoría y precio para aplicar este código.`);
            setDiscountAmount(0);
            setDiscountPorcent(0);
            setPromocionID(0);
            setIsCheckingCode(false);
            return;
          }

          setDiscountAmount(descuentoAplicado);
          setSubotal(Math.max(0, totalBoletos - descuentoAplicado));
        }


      } else {
        setSubotal(totalBoletos)
        calcularTotal();
      }

    }, [totalBoletos]);

  useEffect(() => {
    if (discountCode == ''){
      const categoriasSeleccionadas = [...new Set(asientosSeleccionados.map(asiento => asiento.categoria))];
      const promosValidas = filtrarPromocionesAplicables(promocionesAplicanDirecto, categoriasSeleccionadas);
      const mejorPromocion = obtenerMejorPromocion(promosValidas,  asientosSeleccionados);

      if (mejorPromocion) {
        setTipoPromocion(mejorPromocion.tipo);
        setAplicaTodoEvento(mejorPromocion.aplicaTodoEvento);
        setCategoriasPromo(mejorPromocion.categorias);
        setPromocionID(mejorPromocion.id);
        setPromoNombre(mejorPromocion.nombre || '');

        if (mejorPromocion.tipo === 'CANTIDAD') {
          const cantidadCompra = mejorPromocion.cantidadCompra;
          const cantidadPaga = mejorPromocion.cantidadPaga;
          setCantidadesPromocion({cantidadCompra, cantidadPaga});

          setDiscountAmount(mejorPromocion.descuentoCalculado);
          setSubotal(Math.max(0, totalBoletos - mejorPromocion.descuentoCalculado));
          setDiscountPorcent(0);
        } else if (mejorPromocion.tipo === 'PORCENTAJE') {
          setDiscountAmount(mejorPromocion.descuentoCalculado);
          setSubotal(Math.max(0, totalBoletos - mejorPromocion.descuentoCalculado));
          setDiscountPorcent(parseFloat(mejorPromocion.porcentaje));
        }
      } else {
        setTipoPromocion('');
        setAplicaTodoEvento(false);
        setCategoriasPromo([]);
        setPromocionID(0);
        setPromoNombre('');

        setDiscountAmount(0);
        setSubotal(Math.max(0, totalBoletos));
        setDiscountPorcent(0);

      }
    }
    validarDescuento(asientosSeleccionados);
  }, [subtotalesPorCategoria]);

  if (status === 'checking') {
      checkAuthToken();
  }

  const calcularTotal = () => {

    const truncar = (valor: any) => Math.trunc(valor * 1000) / 1000;

    const totalBase = truncar(subtotal);
    const totalUdt = truncar(subtotal * udt);
    const totalUds = evento?.udsPorCategoria? UDS : truncar(subtotal * uds);

    let totalFinal = totalBase + totalUdt + totalUds;

    if (iva) {
      const totalIva = truncar(subtotal * iva);
      totalFinal += totalIva;
    }

    return parseFloat(totalFinal.toFixed(2));
  };

  const handleCheckDiscount = async () => {

    if (!discountCode.trim()) {
      Swal.fire("Mensaje", "Ingresa un código valido", "warning");
      return;
    }

    setIsCheckingCode(true);

    try {

      const params =  {
        clave: discountCode.toUpperCase(),
        evento_id: eventoId
      };

      const res = await apiApplication.post('/promociones/validar_clave_web', params);

      if (res.data.id) {
        const promo = res.data;

        if (promo.promocionPaquetes) {
          if (promo.promocionPareja && asientosSeleccionados.length === 2) {
            promo.porcentaje = 10;
          } else if (promo.promocionFamilia && asientosSeleccionados.length >= 4) {
            promo.porcentaje = 15;
          } else {
            promo.porcentaje = promo.porcentaje;
            return toast.warning(`No cumple con las condiciones para el descuento`);
          }
        }

        setPromoNombre(promo.nombre || '');

        setTipoPromocion(promo.tipo);
        setAplicaTodoEvento(promo.aplicaTodoEvento);
        setCategoriasPromo(promo.categorias);


        const asientosPorCategoriaPrecio = asientosSeleccionados.reduce((acc: { [categoria: string]: { [precio: number]: Asiento[] } }, asiento) => {
          const categoria = asiento.categoria;
          const precio = asiento.precio;
          if (!acc[categoria]) acc[categoria] = {};
          if (!acc[categoria][precio]) acc[categoria][precio] = [];
          acc[categoria][precio].push(asiento);
          return acc;
        }, {} as { [categoria: string]: { [precio: number]: Asiento[] } });

        let categoriasAplicables: string | string[] = [];
        if (!promo.aplicaTodoEvento){
          const categoriasSeleccionadas = Object.keys(asientosPorCategoriaPrecio);
          const categoriasValidas = promo.categorias.map((c: { categoria: { nombre: any; }; }) => c.categoria?.nombre).filter((cat: string) => cat !== null && cat !== undefined);
          categoriasAplicables = categoriasSeleccionadas.filter(cat => categoriasValidas.includes(cat));
          const categoriasGenerales = promo.categorias.map((c: { categoriaGeneral: { nombre: any; }; }) => c.categoriaGeneral?.nombre).filter((cat: string) => cat !== null && cat !== undefined);

          if (categoriasAplicables.length === 0) {
            toast.error(`Promocion solo valida para las siguientes categorías: ${[...categoriasGenerales ,...categoriasValidas].join(', ') }`);
            setDiscountAmount(0);
            setDiscountPorcent(0);
            setPromocionID(0);
            setIsCheckingCode(false);
            return;
          }
        }

        if (res.data.tipo == 'CANTIDAD') {
          const cantidadCompra = promo.cantidadCompra;
          const cantidadPaga = promo.cantidadPaga;
          let totalDescuento = 0;
          let algunaCategoriaCumple = false;

          setCantidadesPromocion({cantidadCompra, cantidadPaga});

          Object.entries(asientosPorCategoriaPrecio).forEach(([categoria, preciosObj]) => {
            if (!promo.aplicaTodoEvento && !categoriasAplicables.includes(categoria)) {
              return;
            }
            Object.entries(preciosObj as Record<string, Asiento[]>).forEach(([precio, asientos]) => {
              precio;
              const cantidad = asientos.length;
              const grupos = Math.floor(cantidad / cantidadCompra);
              if (cantidad >= cantidadCompra) {
                algunaCategoriaCumple = true;
              }
              for (let i = 0; i < grupos; i++) {
                const grupo = asientos.slice(i * cantidadCompra, (i + 1) * cantidadCompra);
                const gratis = grupo.slice(cantidadPaga);
                totalDescuento += gratis.reduce((acc, asiento) => acc + Number(asiento.precio), 0);
              }
            });
          });

          if (!algunaCategoriaCumple) {
            toast.error(`Debes seleccionar al menos ${cantidadCompra} asientos en una misma categoría y precio para aplicar este código.`);
            setDiscountAmount(0);
            setDiscountPorcent(0);
            setPromocionID(0);
            setIsCheckingCode(false);
            return;
          }

          setDiscountAmount(totalDescuento);
          setSubotal(Math.max(0, totalBoletos - totalDescuento));
          toast.success(`Descuento aplicado correctamente`);
          setPromocionID(promo.id);
          setDiscountPorcent(0);
          setIsCheckingCode(false);
          return;
        }

        let descuentoAplicado = 0, nuevoSubtotal = 0;
        Object.entries(subtotalesPorCategoria).forEach(([categoria, subtotal]) => {
          if (promo.aplicaTodoEvento || (!promo.aplicaTodoEvento && categoriasAplicables.includes(categoria))) {
            const descuento = subtotal * (parseFloat(promo.porcentaje) / 100);
            descuentoAplicado += descuento;
            nuevoSubtotal += subtotal - descuento;
          } else {
            nuevoSubtotal += subtotal;
          }
        });

        setDiscountAmount(descuentoAplicado);
        setSubotal(Math.max(0, nuevoSubtotal));
        toast.success(`Descuento aplicado correctamente`);
        setPromocionID(promo.id);
        setDiscountPorcent(parseFloat(promo.porcentaje));
        setIsCheckingCode(false);
        return;

      }else{
        toast.error(`Código de descuento inválido.`);
      }

    } catch (err) {
      toast.error(`Código de descuento inválido.`);
      setDiscountAmount(0);
    } finally {
      setIsCheckingCode(false);
    }
  };

  const validarDescuento = async (num_asientos: any[]) => {

    if (!discountCode.trim()) {
      return;
    }

    setIsCheckingCode(true);

    try {

      const params =  {
        clave: discountCode.toUpperCase(),
        evento_id: eventoId
      };

      const res = await apiApplication.post('/promociones/validar_clave_web', params);

      if (res.data.id) {
        const promo = res.data;

        console.log("num_asientos");
        console.log(num_asientos);
        if (promo.promocionPaquetes) {
          if (promo.promocionPareja && num_asientos.length === 2) {
            promo.porcentaje = 10;
          } else if (promo.promocionFamilia && num_asientos.length >= 4) {
            promo.porcentaje = 15;
          } else {
            promo.porcentaje = promo.porcentaje;
          }
        }

        setPromoNombre(promo.nombre || '');

        setTipoPromocion(promo.tipo);
        setAplicaTodoEvento(promo.aplicaTodoEvento);
        setCategoriasPromo(promo.categorias);


        const asientosPorCategoriaPrecio = num_asientos.reduce((acc: { [categoria: string]: { [precio: number]: Asiento[] } }, asiento) => {
          const categoria = asiento.categoria;
          const precio = asiento.precio;
          if (!acc[categoria]) acc[categoria] = {};
          if (!acc[categoria][precio]) acc[categoria][precio] = [];
          acc[categoria][precio].push(asiento);
          return acc;
        }, {} as { [categoria: string]: { [precio: number]: Asiento[] } });

        let categoriasAplicables: string | string[] = [];
        if (!promo.aplicaTodoEvento){
          const categoriasSeleccionadas = Object.keys(asientosPorCategoriaPrecio);
          const categoriasValidas = promo.categorias.map((c: { categoria: { nombre: any; }; }) => c.categoria?.nombre).filter((cat: string) => cat !== null && cat !== undefined);
          categoriasAplicables = categoriasSeleccionadas.filter(cat => categoriasValidas.includes(cat));
          // const categoriasGenerales = promo.categorias.map((c: { categoriaGeneral: { nombre: any; }; }) => c.categoriaGeneral?.nombre).filter((cat: string) => cat !== null && cat !== undefined);

          if (categoriasAplicables.length === 0) {
            // toast.error(`Promocion solo valida para las siguientes categorías: ${[...categoriasGenerales ,...categoriasValidas].join(', ') }`);
            setDiscountAmount(0);
            setDiscountPorcent(0);
            setPromocionID(0);
            setIsCheckingCode(false);
            return;
          }
        }

        if (res.data.tipo == 'CANTIDAD') {
          const cantidadCompra = promo.cantidadCompra;
          const cantidadPaga = promo.cantidadPaga;
          let totalDescuento = 0;
          let algunaCategoriaCumple = false;

          setCantidadesPromocion({cantidadCompra, cantidadPaga});

          Object.entries(asientosPorCategoriaPrecio).forEach(([categoria, preciosObj]) => {
            if (!promo.aplicaTodoEvento && !categoriasAplicables.includes(categoria)) {
              return;
            }
            Object.entries(preciosObj as Record<string, Asiento[]>).forEach(([precio, asientos]) => {
              precio;
              const cantidad = asientos.length;
              const grupos = Math.floor(cantidad / cantidadCompra);
              if (cantidad >= cantidadCompra) {
                algunaCategoriaCumple = true;
              }
              for (let i = 0; i < grupos; i++) {
                const grupo = asientos.slice(i * cantidadCompra, (i + 1) * cantidadCompra);
                const gratis = grupo.slice(cantidadPaga);
                totalDescuento += gratis.reduce((acc, asiento) => acc + Number(asiento.precio), 0);
              }
            });
          });

          if (!algunaCategoriaCumple) {
            // toast.error(`Debes seleccionar al menos ${cantidadCompra} asientos en una misma categoría y precio para aplicar este código.`);
            setDiscountAmount(0);
            setDiscountPorcent(0);
            setPromocionID(0);
            setIsCheckingCode(false);
            return;
          }

          setDiscountAmount(totalDescuento);
          setSubotal(Math.max(0, totalBoletos - totalDescuento));
          // toast.success(`Descuento aplicado correctamente`);
          setPromocionID(promo.id);
          setDiscountPorcent(0);
          setIsCheckingCode(false);
          return;
        }

        let descuentoAplicado = 0, nuevoSubtotal = 0;
        Object.entries(subtotalesPorCategoria).forEach(([categoria, subtotal]) => {
          if (promo.aplicaTodoEvento || (!promo.aplicaTodoEvento && categoriasAplicables.includes(categoria))) {
            const descuento = subtotal * (parseFloat(promo.porcentaje) / 100);
            descuentoAplicado += descuento;
            nuevoSubtotal += subtotal - descuento;
          } else {
            nuevoSubtotal += subtotal;
          }
        });

        setDiscountAmount(descuentoAplicado);
        setSubotal(Math.max(0, nuevoSubtotal));
        // toast.success(`Descuento aplicado correctamente`);
        setPromocionID(promo.id);
        setDiscountPorcent(parseFloat(promo.porcentaje));
        setIsCheckingCode(false);
        return;

      }else{
        // toast.error(`Código de descuento inválido.`);
      }

    } catch (err) {
      // toast.error(`Código de descuento inválido.`);
      setDiscountAmount(0);
    } finally {
      setIsCheckingCode(false);
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
      <div className='p-3 grid place-items-center'>
        <p className='text-base font-semibold text-center'>Tiempo restante <span className='block font-normal text-sm'>(minutos)</span></p>
        <div className='flex items-center gap-x-3 text-3xl'>
          <span className='font-semibold text-red-500 w-12 h-12 p-1 rounded shadow grid place-items-center'>{minutos.toString().padStart(2, '0')}</span>
          <span className='font-semibold w-12 h-12 p-1 rounded shadow grid place-items-center'>:</span>
          <span className='font-semibold text-red-500 w-12 h-12 p-1 rounded shadow grid place-items-center'>{segundos.toString().padStart(2, '0')}</span>
        </div>
      </div>
    );
  };

  // [INVITADO DESHABILITADO] Validador de correo usado por el flujo de invitado
  // const esCorreoValido = (correo: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

  // Tras iniciar sesión en el modal, reintenta la reserva automáticamente (sin salir de la página).
  useEffect(() => {
    if (reservaPendiente && user) {
      setReservaPendiente(false);
      handleReservarAsientos({ preventDefault: () => {} } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaPendiente, user]);

  const handleReservarAsientos = async (e: any) => {
    e.preventDefault();
    if (asientosSeleccionados.length === 0) {
      return;
    }

    const idsAsientos = asientosSeleccionados.map(asiento => asiento.id);

    if (evento && evento?.limiteDeAsientos && idsAsientos.length > evento?.limiteDeAsientos) {
      Swal.fire({ title: "Mensaje", text: `El límite de asientos por compra es de ${evento?.limiteDeAsientos} boletos.`, icon: "warning", confirmButtonText: "OK" });
      return;
    }

    // Si no hay sesión, abre el modal de login (sin navegar) y continúa al iniciar sesión.
    if (!user) {
      const ok = await requestLogin();
      if (ok) setReservaPendiente(true);
      return;
    }

    try {
      if (eventoId) {

        // 📌 [INVITADO DESHABILITADO] Validaciones de nombre/correo del invitado
        // if (usuarioInvitado) {
        //   if (!formValuesInvitado.nombre_invitado) {
        //     Swal.fire({ title: "Mensaje", text: "Ingresa tú nombre", icon: "warning", confirmButtonText: "OK" });
        //     return;
        //   }
        //   if (!formValuesInvitado.correo_invitado) {
        //     Swal.fire({ title: "Mensaje", text: "Es necesario un correo electrónico valído", icon: "warning", confirmButtonText: "OK" });
        //     return;
        //   }
        //   if (!esCorreoValido(formValuesInvitado.correo_invitado)) {
        //     Swal.fire({ title: "Mensaje", text: "Ingresa un correo electrónico válido", icon: "warning", confirmButtonText: "OK" });
        //     return;
        //   }
        // }

        if (user) {
          setUsuarioInvitado(false);
          const response = await reservar(user?.email, idsAsientos, eventoId.toString(), funcionId || undefined);
          if (response && response.reservaId) {

            if (evento?.esGratuito){
              handleCompraGratis(response.reservaId);
              return;
            }

            setReservaExitosa(true);
            setReservaId(response.reservaId);
            setTimeout(() => {
              pagoRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 300);
            try {
              const has_user = await apiApplication.get("/pagos/get/mi_perfil");
              console.log(has_user);

              setOpenId(has_user.data.idOpenpay);
              setTarjetas(has_user.data.tarjetas);

            } catch (error) {
              console.log('No tiene open id crearlo...');
              const resp = await apiApplication.post("/pagos/save/usuario");
              setOpenId(resp.data.idOpenpay);
              console.error("Error al obtener/crear OpenPay ID", error);
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
        /* [INVITADO DESHABILITADO] — el usuario sin sesión es redirigido al login OTP arriba.
        else {

          // ES UN INVITADO
          setUsuarioInvitado(true);
          const response = await reservarInvitado(idsAsientos, eventoId.toString(), formValuesInvitado.nombre_invitado, formValuesInvitado.correo_invitado, funcionId);
          if (response && response.reservaId) {

            if (evento?.esGratuito){
              try {
                handleCompraGratis(response.reservaId);
              } catch (error) {
                cancelar(response.reservaId, evento.id.toString());
              }
              return;
            }

            setReservaExitosa(true);
            setReservaId(response.reservaId);
            setTimeout(() => {
              pagoRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 300);
            const fechaExpiracion = new Date(response.fechaExpiracion).getTime();
            const ahora = new Date().getTime();
            const tiempoRestante = Math.max(0, Math.floor((fechaExpiracion - ahora) / 1000));

            setTiempoRestante(tiempoRestante);

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
            return window.location.reload();
          }
        }
        */

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
    } catch (error: any) {
      console.error("Error en la reserva:", error);

      const mensaje =
        error?.response?.data?.message ||
        error?.message ||
        'Ocurrió un error al reservar. Por favor, intenta nuevamente.';

      Swal.fire({
        title: 'Atención!',
        text: mensaje,
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  };

  const handleCompraGratis = async (reservaId: string) => {
    try {
      setCargando(true);

      let resdata: any;
      try {
        const { data } = await apiApplication.post(`/eventos/${evento?.id}/gratis`, {
          esInvitado: usuarioInvitado,
          esGeneral: false,
          reservaId: reservaId,
          email: usuarioInvitado ? formValuesInvitado.correo_invitado : user?.email,
          nombre: usuarioInvitado ? formValuesInvitado.nombre_invitado : user?.fullName
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

        /* if (usuarioInvitado) {
          await apiApplication.post(`/correos/sold-tickets-email-invitado/${resdata.invitado.id}/${resdata.id}`);
        }else{
          await apiApplication.post(`/correos/sold-tickets-email/${user?.email}/${resdata.id}`);
        } */
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
  }

  const habilitarpromocion = async (id_evento_web: string) => {

    const params =  {
      evento_id: parseInt(id_evento_web)
    };

    const res = await apiApplication.post('/promociones/validar_promo_web', params);

    if (res.data.total > 0) {
      setHabilitaPromocion(true);
      if (res.data.promocionesAplicaDirecto && res.data.promocionesAplicaDirecto.length > 0) {
        for (const a of res.data.promocionesAplicaDirecto) {
          a.porcentaje_original = a.porcentaje;
        }
        setPromocionesAplicanDirecto(res.data.promocionesAplicaDirecto);
      }
    } else {
      setHabilitaPromocion(false);
    }

  };

  const handleVenderAsientos = async (e: React.FormEvent) => {
    e.preventDefault();

    // 📌 Validaciones de evento
    if (!asientosSeleccionados || asientosSeleccionados.length === 0) {
      Swal.fire({ title: "Error", text: "Debes seleccionar al menos un asiento.", icon: "warning", confirmButtonText: "OK" });
      return;
    }
    if (!eventoId || isNaN(Number(eventoId))) {
      Swal.fire({ title: "Error", text: "El evento no es válido.", icon: "error", confirmButtonText: "OK" });
      return;
    }
    if (!reservaId) {
      Swal.fire({ title: "Error", text: "La reserva no es válida.", icon: "error", confirmButtonText: "OK" });
      return;
    }

    // 📌 Si el usuario seleccionó una tarjeta guardada, saltamos las validaciones de datos de tarjeta
    if (!tarjetaSeleccionada) {
      // 📌 Validaciones de pago solo si NO hay una tarjeta guardada seleccionada
      if (!formValues.nombre || !/^[a-zA-Z\s]+$/.test(formValues.nombre)) {
        Swal.fire({ title: "Error", text: "El nombre del titular no es válido o no puede ir vacío.", icon: "error", confirmButtonText: "OK" });
        return;
      }
      if (!validarNumeroTarjeta(formValues.tarjeta)){
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
        Swal.fire({ icon: 'error', title: 'Error',text: 'No puedes eliminar la tarjeta porque no tiene un usuario Openpay.',});
        return;
      }
      const res = await apiApplication.delete(`/pagos/tarjeta/${clienteId}/${tarjetaId}`);
      Swal.fire({ icon: 'success',title: 'Tarjeta eliminada', text: res.data.message});
      setTarjetas(tarjetas => tarjetas.filter(tarjeta => tarjeta.idtarjeta !== tarjetaId));
    } catch (error) {
      console.error('Error al eliminar la tarjeta:', error);
      Swal.fire({icon: 'error', title: 'Error', text: 'Ocurrió un error al eliminar la tarjeta. Por favor, inténtalo de nuevo.'});
    }
  };

  const handleCancelarCompra = async () => {
    try {
      if (eventoId && reservaId) {
        const response = await cancelar(reservaId.toString(), eventoId.toString());
        if (response && response.success) {
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

  const handleAsientoClick = (asiento: Asiento) => {

    if (!user) {
      setUsuarioInvitado(true);
    }

    subtotalesPorCategoria;

    const estaSeleccionado = asientosSeleccionados.some(a => a.id === asiento.id);

    let nuevosAsientos: Asiento[] = [];

    if (estaSeleccionado) {

      nuevosAsientos = asientosSeleccionados.filter(a => a.id !== asiento.id);

      setAsientosSeleccionados(prev =>
        prev.filter(a => a.id !== asiento.id)
      );

      if (evento) {

          setSubtotalesPorCategoria(prev => {
              const nuevo = { ...prev };
              const nuevaCantidad = (nuevo[asiento.categoria] || 0) - Number(asiento.precio);
              if (nuevaCantidad === 0) {
                  delete nuevo[asiento.categoria];
              } else {
                  nuevo[asiento.categoria] = nuevaCantidad;
              }

              let udsTotal = 0;
              Object.entries(nuevo).forEach(([categoria, subtotal]) => {
                const cargoCategoria = cargosPorCategoria.find(c => c.categoria === categoria);
                if (cargoCategoria && cargoCategoria.cargoPorCategoria) {
                  udsTotal += subtotal * Number(cargoCategoria.cargoPorCategoria);
                }
              });
              setUDS(udsTotal);

              return nuevo;
          });
      }

      setTotalBoletos(prev => prev - +asiento.precio);

    } else {

      if (asiento.estado === 'disponible') {

        if (evento?.limiteDeAsientos && asientosSeleccionados.length >= evento.limiteDeAsientos) {
           Swal.fire({
             title: 'Límite alcanzado',
             text: `Solo puedes seleccionar hasta ${evento.limiteDeAsientos} asientos para este evento.`,
             icon: 'warning'
           });
           return;
        }

        nuevosAsientos = [...asientosSeleccionados, asiento];
        setAsientosSeleccionados(prev => [...prev, asiento]);

        // Seleccionar un asiento es la senal de intencion mas limpia de este flujo; al
        // deseleccionar no se manda nada (Meta no tiene un evento de "quitar del carrito").
        if (evento?.id) {
          agregarAlCarrito({
            eventoId: evento.id,
            nombre: evento.nombre,
            precioUnitario: Number(asiento.precio) || undefined,
          });
        }

        if (evento) {
            setSubtotalesPorCategoria(prev => {
              const nuevo = {
                ...prev,
                [asiento.categoria]: (prev[asiento.categoria] || 0) + Number(asiento.precio)
              };

              let udsTotal = 0;
              Object.entries(nuevo).forEach(([categoria, subtotal]) => {
                const cargoCategoria = cargosPorCategoria.find(c => c.categoria === categoria);
                if (cargoCategoria && cargoCategoria.cargoPorCategoria) {
                  udsTotal += subtotal * Number(cargoCategoria.cargoPorCategoria);
                }
              });
              setUDS(udsTotal);

              return nuevo;
            });
        }

        setTotalBoletos(prev => (prev + +asiento.precio));
      }

    }

    const nuevasPromociones = promocionesAplicanDirecto.map(p => {
      let porcentaje = p.porcentaje;

      if (p.promocionPaquetes) {
        if (p.promocionPareja && nuevosAsientos.length === 2) {
          porcentaje = 10;
        } else if (p.promocionFamilia && nuevosAsientos.length >= 4) {
          porcentaje = 15;
        } else {
          porcentaje = p.porcentaje_original;
        }
      }

      return { ...p, porcentaje };
    });

    setPromocionesAplicanDirecto(nuevasPromociones);

    // validarDescuento(nuevosAsientos);

  };

  const filtrarPromocionesAplicables = (promociones: any[], categorias: string | any[]) => {
    return promociones.filter((promo: { aplicaTodoEvento: any; categorias: any[]; }) => {
      // Si aplica a todo el evento, siempre es válida
      if (promo.aplicaTodoEvento) {
        return true;
      }

      const categoriasN = promo.categorias.map((c: { categoria: { nombre: any; }; }) => c.categoria?.nombre).filter((c: null | undefined) => c !== null && c !== undefined);

      // Si no aplica a todo el evento, verificar si la categoría está incluida
      return categoriasN && categoriasN.some((cat: any) => categorias.includes(cat));
    });
  };

  const obtenerMejorPromocion = (promocionesAplicables: any[], asientosSeleccionados: any[]): MejorPromo | null => {
    if (!promocionesAplicables || promocionesAplicables.length === 0) {
      return null;
    }

    let mejorPromocion = null;
    let mayorDescuento = 0;

    promocionesAplicables.forEach(promo => {
      let descuentoTotal = 0;

      // Obtener categorías de asientos seleccionados
      const categoriasAsientos = [...new Set(asientosSeleccionados.map(asiento => asiento.categoria))];

      // Filtrar categorías aplicables
      let categoriasAplicables = [];
      if (!promo.aplicaTodoEvento) {
        const categoriasValidas = promo.categorias.map((c: { categoria: { nombre: any; }; }) => c.categoria?.nombre).filter((c: null | undefined) => c !== null && c !== undefined);
        categoriasAplicables = categoriasAsientos.filter(cat => categoriasValidas.includes(cat));

        if (categoriasAplicables.length === 0) {
          return;
        }
      }

      if (promo.tipo === "PORCENTAJE") {
        // Calcular descuento por categoría
        Object.entries(subtotalesPorCategoria).forEach(([categoria, subtotal]) => {
          if (promo.aplicaTodoEvento || categoriasAplicables.includes(categoria)) {
            const descuento = subtotal * (parseFloat(promo.porcentaje) / 100);
            descuentoTotal += descuento;
          }
        });
      }
      else if (promo.tipo === "CANTIDAD") {
        const cantidadCompra = promo.cantidadCompra;
        const cantidadPaga = promo.cantidadPaga;

        const asientosPorCategoriaPrecio = asientosSeleccionados.reduce((acc, asiento) => {
          const categoria = asiento.categoria;
          const precio = asiento.precio;
          if (!acc[categoria]) acc[categoria] = {};
          if (!acc[categoria][precio]) acc[categoria][precio] = [];
          acc[categoria][precio].push(asiento);
          return acc;
        }, {});

        let algunaCategoriaCumple = false;

        Object.entries(asientosPorCategoriaPrecio).forEach(([categoria, preciosObj]) => {
          if (!promo.aplicaTodoEvento && !categoriasAplicables.includes(categoria)) {
            return; // Esta categoría no aplica
          }

          Object.entries(preciosObj as Record<string, Asiento[]>).forEach(([precio, asientos]) => {
            precio;
            const cantidad = asientos.length;
            const grupos = Math.floor(cantidad / cantidadCompra);

            if (cantidad >= cantidadCompra) {
              algunaCategoriaCumple = true;
            }

            // Para cada grupo, calcular descuento
            for (let i = 0; i < grupos; i++) {
              const grupo = asientos.slice(i * cantidadCompra, (i + 1) * cantidadCompra);
              const gratis = grupo.slice(cantidadPaga);
              descuentoTotal += gratis.reduce((acc: number, asiento: { precio: any; }) => acc + Number(asiento.precio), 0);
            }
          });
        });

        if (!algunaCategoriaCumple) {
          return; // Esta promoción no cumple los requisitos
        }
      }



      if (descuentoTotal > mayorDescuento) {
        mayorDescuento = descuentoTotal;
        mejorPromocion = {
          ...promo,
          descuentoCalculado: descuentoTotal,
        };
      }
    });

    return mejorPromocion;
  };

  // RENDERS
  // _________________________________________________

  const renderFilas = () => {
    return (
      <>
        <div className="bg-[#e6e6e8] overflow-auto container-seats rounded-lg">
          {filas.map((fila) => (
            <div key={fila.id} className="p-1">
              <div className={`flex items-center justify-${orientacion == 'left'? 'start' : orientacion =='right'? 'end' : 'center'} gap-2`}>
                <span className='w-8 flex-none h-8 bg-white border flex items-center justify-center shadow-sm text-sm square-full'>{fila.nombre}</span>
                {fila.asientos.map((asiento: Asiento) => {
                  const estaSeleccionado = asientosSeleccionados.some(
                    (a) => a.id === asiento.id
                  );

                  const colores = {
                    seleccionado: {
                      clase: "text-blue-500",
                      font: "text-gray-600",
                    },
                    disponible: {
                      clase: "text-gray-400",
                      font: "text-gray-600",
                    },
                    ocupado: {
                      clase: "text-gray-200",
                      font: "text-gray-600",
                    },
                    vendido: {
                      clase: "text-green-500",
                      font: "text-gray-600",
                    },
                    bloqueado: {
                      clase: "text-[#71717A]",
                      font: "text-gray-600",
                    },
                    reservado: {
                      clase: "text-[#71717A]",
                      font: "text-gray-600",
                    },
                    inaccesible: {
                      clase: "text-gray-200",
                      font: "text-gray-200",
                    },
                    cortesia: {
                      clase: "text-green-500",
                      font: "text-gray-600",
                    },
                  };

                  // Determinar el estado asegurando que siempre tenga un valor válido
                  const estado = estaSeleccionado ? "seleccionado" : asiento.estado || "ocupado";

                  // Verificar que el estado exista en colores, si no, usar "ocupado"
                  const { clase: colorClase, font: colorFont } = colores[estado] || colores.ocupado;

                  return (
                    <div
                      key={asiento.id}
                      // onClick={() => handleAsientoClick(asiento)}
                      onClick={!isMesa ? () => handleAsientoClick(asiento) : undefined}
                      onMouseEnter={() =>
                        asiento.estado !== "inaccesible" ? setHoveredAsiento(asiento) : null
                      }
                      onMouseLeave={() => setHoveredAsiento(null)}  // Ocultar el tooltip al salir del hover
                      className={`cursor-pointer text-center ${colorClase} relative square-full`}
                    >
                      {estaSeleccionado ? (
                        // ✅ Si el asiento está seleccionado, mostrar un check verde
                        <svg className='mx-auto' width="20" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M5.5 21C6.33 21 7 20.33 7 19.5V18H17V19.5C17 20.33 17.67 21 18.5 21C19.33 21 20 20.33 20 19.5V17C20 15.9 19.1 15 18 15H6C4.9 15 4 15.9 4 17V19.5C4 20.33 4.67 21 5.5 21ZM20 10H21C21.55 10 22 10.45 22 11V12C22 12.55 21.55 13 21 13H20C19.45 13 19 12.55 19 12V11C19 10.45 19.45 10 20 10ZM3 10H4C4.55 10 5 10.45 5 11V12C5 12.55 4.55 13 4 13H3C2.45 13 2 12.55 2 12V11C2 10.45 2.45 10 3 10ZM17 13H7V5C7 3.9 7.9 3 9 3H15C16.1 3 17 3.9 17 5V13Z" fill="#71717A"/>
                            <rect x="0.5" y="0.5" width="23" height="23" rx="11.5" fill="#112D6A"/>
                            <rect x="0.5" y="0.5" width="23" height="23" rx="11.5" stroke="#3B82F6"/>
                            <rect x="0.5" y="0.5" width="23" height="23" rx="11.5" stroke="black" strokeOpacity="0.2"/>
                          <path d="M8.33333 9.00016C8.33333 8.0277 8.71964 7.09507 9.40727 6.40744C10.0949 5.7198 11.0275 5.3335 12 5.3335C12.9725 5.3335 13.9051 5.7198 14.5927 6.40744C15.2804 7.09507 15.6667 8.0277 15.6667 9.00016C15.6667 9.97262 15.2804 10.9053 14.5927 11.5929C13.9051 12.2805 12.9725 12.6668 12 12.6668C11.0275 12.6668 10.0949 12.2805 9.40727 11.5929C8.71964 10.9053 8.33333 9.97262 8.33333 9.00016ZM6 16.6668C6 15.7828 6.35119 14.9349 6.97631 14.3098C7.60143 13.6847 8.44928 13.3335 9.33333 13.3335H14.6667C15.5507 13.3335 16.3986 13.6847 17.0237 14.3098C17.6488 14.9349 18 15.7828 18 16.6668V18.6668H6V16.6668Z" fill="white"/>
                        </svg>
                      ) : asiento.estado !== "disponible" && asiento.estado !== "inaccesible" && asiento.estado !== "reservado" ? (
                        // ❌ Si el asiento está ocupado (por descarte), mostrar una "X" roja
                        <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <g clipPath="url(#clip0_3372_85057)">
                          <g clipPath="url(#clip1_3372_85057)">
                          <path d="M3.5 18C4.33 18 5 17.33 5 16.5V15H15V16.5C15 17.33 15.67 18 16.5 18C17.33 18 18 17.33 18 16.5V14C18 12.9 17.1 12 16 12H4C2.9 12 2 12.9 2 14V16.5C2 17.33 2.67 18 3.5 18ZM18 7H19C19.55 7 20 7.45 20 8V9C20 9.55 19.55 10 19 10H18C17.45 10 17 9.55 17 9V8C17 7.45 17.45 7 18 7ZM1 7H2C2.55 7 3 7.45 3 8V9C3 9.55 2.55 10 2 10H1C0.45 10 0 9.55 0 9V8C0 7.45 0.45 7 1 7ZM15 12H5V2C5 0.9 5.9 0 7 0H13C14.1 0 15 0.9 15 2V12Z" fill="#EF4444"/>
                          <g filter="url(#filter0_d_3372_85057)">
                          <path d="M7.25 5.75C7.25 5.02065 7.53973 4.32118 8.05546 3.80546C8.57118 3.28973 9.27065 3 10 3C10.7293 3 11.4288 3.28973 11.9445 3.80546C12.4603 4.32118 12.75 5.02065 12.75 5.75C12.75 6.47935 12.4603 7.17882 11.9445 7.69454C11.4288 8.21027 10.7293 8.5 10 8.5C9.27065 8.5 8.57118 8.21027 8.05546 7.69454C7.53973 7.17882 7.25 6.47935 7.25 5.75ZM5.5 11.5C5.5 10.837 5.76339 10.2011 6.23223 9.73223C6.70107 9.26339 7.33696 9 8 9H12C12.663 9 13.2989 9.26339 13.7678 9.73223C14.2366 10.2011 14.5 10.837 14.5 11.5V13H5.5V11.5Z" fill="#F4F4F5"/>
                          </g>
                          </g>
                          </g>
                          <defs>
                            <filter id="filter0_d_3372_85057" x="4.5" y="3" width="11" height="12" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                            <feOffset dy="1"/>
                            <feGaussianBlur stdDeviation="0.5"/>
                            <feComposite in2="hardAlpha" operator="out"/>
                            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0"/>
                            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_3372_85057"/>
                            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_3372_85057" result="shape"/>
                            </filter>
                            <clipPath id="clip0_3372_85057">
                            <rect width="20" height="18" fill="white"/>
                            </clipPath>
                            <clipPath id="clip1_3372_85057">
                            <rect width="20" height="18" fill="white"/>
                            </clipPath>
                          </defs>
                        </svg>

                      ) : (
                        // 🟢 Si el asiento está disponible o inaccesible, mostrar el ícono normal
                        <svg className="mx-auto" width="20" height="18" viewBox="0 0 20 18" xmlns="http://www.w3.org/2000/svg"
                          style={{ fill: asiento.estado === "disponible" ? asiento.color : "currentColor" }}
                        >
                          <path d="M3.5 18C4.33 18 5 17.33 5 16.5V15H15V16.5C15 17.33 15.67 18 16.5 18C17.33 18 18 17.33 18 16.5V14C18 12.9 17.1 12 16 12H4C2.9 12 2 12.9 2 14V16.5C2 17.33 2.67 18 3.5 18ZM18 7H19C19.55 7 20 7.45 20 8V9C20 9.55 19.55 10 19 10H18C17.45 10 17 9.55 17 9V8C17 7.45 17.45 7 18 7ZM1 7H2C2.55 7 3 7.45 3 8V9C3 9.55 2.55 10 2 10H1C0.45 10 0 9.55 0 9V8C0 7.45 0.45 7 1 7ZM15 10H5V2C5 0.9 5.9 0 7 0H13C14.1 0 15 0.9 15 2V10Z" />
                        </svg>
                      )}

                      <div className={`text-xs ${colorFont} w-full text-center`}>
                        {asiento.numero}
                      </div>

                      {/* Tooltip que aparece al hacer hover */}
                      {hoveredAsiento?.id === asiento.id && (
                        <div className="absolute bg-gray-700 text-white text-xs p-2 rounded-md -top-14 left-1/2 transform -translate-x-1/2 z-40 flex flex-col items-start">
                          {/* Solo muestra precio si no es 'vendido', 'cortesia' ni 'bloqueado' */}
                          {(asiento.estado !== 'vendido' && asiento.estado !== 'cortesia' && asiento.estado !== 'bloqueado') && (
                            <span>{`Precio: $${asiento.precio}`}</span>
                          )}
                          {/* Siempre muestra categoría si existe */}
                          {asiento.categoria && (
                            <span>{`Categoría: ${asiento.categoria}`}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <span className='w-8 flex-none h-8 bg-white border flex items-center justify-center shadow-sm text-sm square-full'>{fila.nombre}</span>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  const renderPasarelaPago = () => {
    return(
      <form className="space-y-4 mt-5">
        <div className='grid grid-cols-8 divide-y-2 md:divide-y-0 md:divide-x-2 gap-4'>
          <div className='col-span-8 md:col-span-3'>
            <p className='text-gray-500 text-sm'>Tarjetas de crédito</p>
            <figure className='flex flex-wrap gap-3 items-center mt-3'>
              <img className='aspect-3/2 object-contain w-10' width={60} height={40} src="/visa.png" alt="" />
              <img className='aspect-3/2 object-contain w-10' width={60} height={40} src="/masterCard.png" alt="" />
              <img className='aspect-3/2 object-contain w-10' width={60} height={40} src="/americanExpress.png" alt="" />
              <img className='aspect-3/2 object-contain w-20' width={60} height={40} src="/carnet.png" alt="" />
            </figure>
          </div>
          <div className='col-span-8 md:col-span-5 pl-0 md:pl-4'>
            <p className='text-gray-500 text-sm'>Tarjetas de débito</p>
            <figure className='flex flex-wrap gap-3 items-center mt-3'>
              <img className='aspect-3/2 object-contain' width={60} height={40} src="/BBVA.png" alt="" />
              <img className='aspect-3/2 object-contain' width={60} height={40} src="/santander.png" alt="" />
              <img className='aspect-3/2 object-contain' width={60} height={40} src="/hsbc.png" alt="" />
              <img className='aspect-3/2 object-contain' width={60} height={40} src="/scotiabank.png" alt="" />
              <img className='aspect-3/2 object-contain' width={60} height={40} src="/inbursa.png" alt="" />
              <img className='aspect-3/2 object-contain' width={60} height={40} src="/ixe.png" alt="" />
            </figure>
          </div>
        </div>
                <div className="space-y-1">
                  <label htmlFor="nombre" className="text-sm text-gray-600 font-semibold pb-1 block">Nombre del titular</label>
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
                  <label htmlFor="tarjeta" className="text-sm text-gray-600 font-semibold pb-1 block">Número de la tarjeta</label>
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
                    <label htmlFor="expiracion" className="text-sm text-gray-600 font-semibold pb-1 block">Fecha de vencimiento</label>
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
                    <label htmlFor="cvv" className="text-sm text-gray-600 font-semibold pb-1 block">Código de seguridad <Tooltip tooltip="Código de seguridad de 3 a 4 dígitos al reverso de tu tarjeta."><IoInformationCircle className='text-gray-500 text-lg' /></Tooltip> </label>
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

                <div className='space-y-1 w-full md:w-1/2'>
                  {tarjetas.length > 0 && (
                    <div>
                      <h3 className="text-sm text-gray-600 font-semibold pb-1 block">Tarjetas Guardadas</h3>
                      {tarjetas.map((tarjeta) => (
                        <div className="flex items-center gap-x-3 bg-gray-100 relative hover:bg-gray-200 transition-colors rounded-lg p-2 mb-2 group" key={tarjeta.idtarjeta}>
                          <label className='w-full block text-gray-500' key={tarjeta.idtarjeta}>
                            <input
                              className='mr-2'
                              type="radio"
                              value={tarjeta.idtarjeta}
                              checked={tarjetaSeleccionada === tarjeta.idtarjeta}
                              onChange={() => setTarjetaSeleccionada(tarjeta.idtarjeta)}
                            />
                            {tarjeta.tarjeta}  ({tarjeta.banco})
                          </label>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                            <button type='button' onClick={() => handleEliminarTarjeta(tarjeta.idtarjeta) }><IoTrashOutline className='text-red-500 text-xl' /></button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className='flex flex-col md:flex-row justify-end divide-x-2 gap-4'>
                  <figure className='flex flex-col items-end'>
                    <small className='block text-gray-500 text-xs mb-1'>Transacciones realidazas vía:</small>
                    <img width={100} height={60} src="/openpay.webp" alt="" />
                  </figure>
                  <figure className='flex items-center w-full md:w-1/4'>
                    <LuBadgeCheck className='text-green-500 text-3xl w-10 flex-none' />
                    <small className='block text-gray-500 text-xs mb-1'>Tus pagos se realizan de forma segura con encriptación de 256 bits</small>
                  </figure>
                </div>


                <button
                  onClick={handleVenderAsientos}
                  disabled={cargando}
                  className="mt-4 w-full bg-accentLight hover:bg-accentBase text-neutral px-4 py-2 rounded-md"
                >
                  {cargando ? (
                    <div className='flex items-center gap-x-4 mx-auto justify-center'>
                      <span>Procesando pago</span>
                      <SpinnerComponent  />
                    </div>
                  ): 'Pagar'}
                </button>
              </form>
    );
  }

  const renderCalculadora = () => {
    return (
      <div className={`grid gap-4 ${reservaExitosa ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>

        {/* Asientos seleccionados */}
        <div>

          {reservaExitosa && (
            <>
              <button
                onClick={handleCancelarCompra}
                className="w-full border border-red-500 bg-white text-red-500 px-4 py-2 rounded-md">
                Cancelar la compra
              </button>
              <div className="mt-2 w-full">
                {renderTimer()} {/* Mostrar el temporizador aquí */}
              </div>
            </>
          )}

          <h3 className="text-lg font-semibold text-gray-600 mb-2 mt-3 text-left">Asientos seleccionados: <span>{asientosSeleccionados?.length}</span></h3>
          <div className="lg:max-h-[300px] lg:max-w-96 overflow-y-auto rounded-lg pr-2">
            {asientosSeleccionados.map((asiento) => (
              <div
                key={asiento.id}
                className="flex flex-col gap-y-1 border-t-4 border-blue-700 rounded-lg px-4 py-2 shadow mb-2"
              >
                <div className='flex items-center justify-between w-full'>
                  <div className='flex items-center gap-x-2'>
                    <span className="grid place-items-center rounded-md w-8 h-8" style={{ backgroundColor: asiento.color || '#000000' }}>
                      <TbTicket className="text-xl text-white" />
                    </span>
                    <p className='text-emphasis font-medium'>{asiento.categoria}</p>
                  </div>
                  <p className='text-emphasis font-bold'>${asiento.precio.toLocaleString()}</p>
                </div>
                <p className="text-gray-600 font-normal text-sm">Asiento: <span className='font-bold text-gray-800'>{asiento.fila + asiento.numero}</span></p>
              </div>
            ))}
          </div>
        </div>

        {/* Form Calculadora */}
        <div className={`${reservaExitosa ? 'lg:order-last' : 'lg:order-first'}`}>

          {/* [INVITADO DESHABILITADO] Formulario de datos del invitado
          {usuarioInvitado && (
            <div>
              <div className="space-y-1">
                <label htmlFor="nombre_invitado" className="text-sm text-gray-400 font-semibold pb-1 block">Nombre completo</label>
                <input
                  type="text"
                  name="nombre_invitado"
                  id="nombre_invitado"
                  placeholder="Ingresa tu nombre completo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formValuesInvitado.nombre_invitado}
                  onChange={(e) => setFormValuesInvitado({ ...formValuesInvitado, nombre_invitado: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1 mt-3">
                <label htmlFor="correo_invitado" className="text-sm text-gray-400 font-semibold pb-1 block">Correo electrónico <span className='text-xs text-red-400 ml-3'>* En este correo recibirás tus boletos *</span></label>
                <input
                  type="email"
                  name="correo_invitado"
                  id="correo_invitado"
                  placeholder="Ingresa tu correo electrónico"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={formValuesInvitado.correo_invitado}
                  inputMode="email"
                  autoComplete="email"
                  onChange={(e) => {
                    const value = e.target.value.replace(/\s/g, '');
                    setFormValuesInvitado({ ...formValuesInvitado, correo_invitado: value });
                  }}
                  required
                />
              </div>
            </div>
          )}
          */}

          {/* Aplicar descuento */}
          {habilitaPromocion && (

            <div className='col-span-2 text-xs pl-0 flex gap-2 items-center justify-between my-2 text-emphasis font-semibold'>
              Código de descuento:
              <div className="flex gap-2">
                <input onChange={(e) => setDiscountCode(e.target.value)} defaultValue={discountCode} type="text" id="codigo_descuento" placeholder='Escriba el código' className="w-36 p-2 border border-gray-400 bg-white rounded-md text-gray-900 text-right placeholder:text-gray-600" style={{ textTransform: 'uppercase' }} />
                <button type="button" className='bg-accentBase text-neutral px-2 rounded-md transition-colors' onClick={handleCheckDiscount} disabled={isCheckingCode}>
                  Aplicar
                </button>
              </div>
            </div>

          )}


          {/* Calculos */}
          <div>

            {/* {discountAmount > 0 && <p className='flex items-center justify-between text-emphasis text-lg font-semibold'>Descuento {promoNombre} ({tipoPromocion=== 'PORCENTAJE'? discountPorcent+"%": cantidadesPromocion.cantidadCompra+"X"+ cantidadesPromocion.cantidadPaga}): <span className='text-emphasis text-lg font-semibold'>-${discountAmount}</span></p>} */}
            {discountAmount > 0 && <p className='flex items-center justify-between text-emphasis text-lg font-semibold'>Descuento {promoNombre} : <span className='text-emphasis text-lg font-semibold'>-${discountAmount}</span></p>}

            <div className="flex justify-between mt-1 w-full items-center">
              <span className="text-lg text-emphasis font-semibold">Subtotal:</span>
              <span className="text-emphasis text-lg font-semibold">
                {formatearDinero(subtotal)}
              </span>
            </div>

            <div className="flex justify-between mt-4 w-full items-center">
              <span className="text-base text-emphasis font-semibold">
                Cargo por servicio:
              </span>
              <span className="text-emphasis text-base font-semibold">
                {formatearDinero(evento?.udsPorCategoria?UDS : subtotal * uds)}
              </span>
            </div>

            <div className="flex justify-between mt-1 w-full items-center">
              <span className="text-base text-emphasis font-semibold">
                Cargo por uso de tarjeta:
              </span>
              <span className="text-emphasis text-base font-semibold">
                {formatearDinero(udt * subtotal)}
              </span>
            </div>

            {iva !== null && iva !== undefined && !isNaN(iva) && iva > 0 && (
              <div className="flex justify-between mt-1 w-full items-center">
                <span className="text-base text-emphasis  font-semibold">
                  IVA
                  <Tooltip tooltip="Impuesto sobre el valor añadido"><IoInformationCircle className='text-gray-500 text-lg' /></Tooltip>
                </span>
                <span className="text-emphasis  text-base font-semibold">
                  {formatearDinero(iva * subtotal)}
                </span>
              </div>
            )}

            <div className="flex justify-between font-bold mt-4 w-full items-center border-t border-gray-300 pt-2">
              <span className="text-lg text-emphasis ">Total:</span>
              <span className="text-emphasis  text-xl font-extrabold">
                {formatearDinero(calcularTotal())}
              </span>
            </div>

            {!reservaExitosa && (
              <button
                onClick={handleReservarAsientos}
                className="mt-4 w-full bg-accentLight hover:bg-accentBase text-neutral px-4 py-2 rounded-lg font-semibold"
              >
                Continuar
              </button>
            )}

          </div>

        </div>

      </div>
    );
  }

  const handleVerResumen = () => {
    resumenRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
      {cargando && (
        <Loader />
      )}
      <div className="flex items-center gap-x-3 my-4">
        {reservaExitosa ? (
          <button onClick={handleCancelarCompra} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-md flex items-center gap-x-1"><MdKeyboardBackspace className='text-4xl' /></button>
        ) : (
          // Esta ruta es por id, asi que la funcion vuelve por query param: el detalle la
          // reescribe dentro del slug al cargar.
          <Link href={`/eventos/${slug}`} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-md flex items-center gap-x-1">
            <MdKeyboardBackspace className='text-4xl' />
          </Link>
        )}
        <h2 className="text-2xl lg:text-4xl text-gray-800 font-bold uppercase">Sección: <span className='font-bold'>{seccion} - {evento?.nombre} - {evento?.fecha ? formatDate(evento.fecha, "d 'de' MMMM 'de' yyyy") : ''}</span></h2>
      </div>

      <div ref={pagoRef} className={`flex flex-col lg:flex-${reservaExitosa ? 'row' : 'col'} gap-3 mb-10`}>

        {/* Asientos o Inputs de Pago */}
        <div className={`w-${reservaExitosa ? '4/6' : 'full'} bg-white shadow rounded-lg p-2 lg:p-4`}>
          <h3 className="text-2xl lg:text-3xl font-bold mb-2 text-gray-700 uppercase">
            {reservaExitosa ? 'Información de Pago' : (isMesa ? 'Mesa seleccionada' : 'Selecciona tus asientos')}
          </h3>
          <h4 className="text-2xl lg:text-3xl font-bold mb-2 text-purple-700 uppercase">
            {(reservaExitosa && isMesa) && 'Comprar Mesa'}
          </h4>
          {!reservaExitosa && (
            <AsientosStatusComponent />
          )}
          <div className="space-y-2">
            {!reservaExitosa ? (
              <div>
                <div className="flex items-center flex-wrap gap-3 mb-3">
                  <ListaPreciosCategorias preciosCategorias={preciosCategorias} />
                  {asientosSeleccionados.length > 0 && (
                    <button onClick={handleVerResumen} className='px-2 py-1 border border-accentLight text-accentBase hover:cursor-pointer rounded-md ml-auto pulse-shadow'>Ver resumen</button>
                  )}
                </div>
                {renderFilas()}
              </div>
            ) : (
              <div>
                {renderPasarelaPago()}
              </div>
            )}
          </div>
        </div>

        {/* Calculadora */}
        <div ref={resumenRef} className={`w-${reservaExitosa ? '2/6' : 'full'} bg-white shadow lg:min-w-80 rounded-lg p-2 lg:p-4 flex flex-col ${asientosSeleccionados.length > 0 ? 'justify-start' : 'justify-center'}`}>
          {asientosSeleccionados.length > 0 ? (
            <>
                {renderCalculadora()}

            </>
          ) : (
            <div className="text-center text-gray-500">
              <figure>
                <img className='mx-auto' width={100} height={100} src="/caja_vacia.svg" />
              </figure>
              <h3 className="text-xl lg:text-2xl text-gray-600 font-medium">No has seleccionado asientos.</h3>
              <p className="text-sm lg:text-base mt-2">
                (Selecciona algún asiento para ver detalles).
              </p>
            </div>
          )}

        </div>

      </div>

      {compraExitosa && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50" >
          <div className={`bg-neutral p-2 md:p-3 rounded-lg shadow-lg min-w-96 max-w-96 text-center`}>
            <div className='rounded-full w-12 h-12 bg-green-500 grid place-items-center mx-auto mb-5'><LuBadgeCheck className='text-neutral text-3xl' /></div>
            <h2 className='text-2xl font-bold text-gray-800'>¡Compra exitosa!</h2>
            <hr className='my-3'/>
            <p className="text-gray-600">Tus boletos para {evento?.nombre} {evento?.recinto.nombre} han sido comprados con éxito.</p>
            {/* <p className='text-gray-600 my-4'>Boleto enviado a: <span className='font-medium block'>Roberto@gmail.com</span></p> */}
            <p className='text-gray-600 my-4'>Total pagado: <span className='block text-3xl font-bold text-gray-800'>${calcularTotal()}</span></p>
            <Link href="/perfil/mis_compras" className='w-full block px-4 py-2 bg-accentBase hover:bg-emphasis mb-2 transition-colors text-neutral rounded-lg'>Ir a mis compras</Link>
            <button onClick={() => window.location.reload()} className='w-full px-4 py-2 mb-2 transition-colors text-gray-700 rounded-lg'>Continuar</button>
          </div>
        </div>
      )}

    </div>
  );


}
