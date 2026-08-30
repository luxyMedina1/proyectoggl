import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from "next/navigation";
import { IoArrowBack, IoTrashOutline } from 'react-icons/io5';
import { HiOutlineTicket } from 'react-icons/hi2';
import { LuBadgeCheck } from 'react-icons/lu';
import Swal from 'sweetalert2';
import apiApplication from '../../api/apiApplication';
import Loader from '../components/Loader';
import { formatearDinero } from '../../eventos/helpers/formatearDinero';
import { validarNumeroTarjeta, validarCVC } from '../../utils/cardHelpers';
import { useCityPassStore } from '../../hooks/useCityPassStore';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAuthModal } from '../../context/AuthModalContext';
import type {
    CityPassItemCompra,
    CityPassPaqueteDetalle,
    MakeCargoCityPassBody,
} from '../../types/CityPass';

interface TarjetaGuardada {
    id: number;
    idtarjeta: string;
    tarjeta: string;
    banco: string;
}

const precioMXN = (valor: number) => `${formatearDinero(valor)} MXN`;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Página de compra de CityPass (Openpay 3DS). Reemplaza la vista del paquete durante el pago.
const CityPassCheckoutPage = () => {
    const { paqueteId } = useParams<{ paqueteId: string }>();
    const router = useRouter();
    const { getPaquete, makeCargo } = useCityPassStore();
    const { status, isVerified } = useAuthStore();
    const { requestLogin } = useAuthModal();

    // Los boletos elegidos llegan desde la vista del paquete vía sessionStorage
    // (App Router no transporta estado de navegación entre rutas).
    const [items, setItems] = useState<CityPassItemCompra[]>([]);
    const [itemsHidratados, setItemsHidratados] = useState(false);
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('citypass:checkout');
            if (raw) setItems(JSON.parse(raw));
        } catch { /* almacenamiento no disponible */ }
        setItemsHidratados(true);
    }, []);

    const [paquete, setPaquete] = useState<CityPassPaqueteDetalle | null>(null);
    const [cargandoPaquete, setCargandoPaquete] = useState(true);

    const [deviceDataId, setDeviceDataId] = useState<string | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const [tarjetas, setTarjetas] = useState<TarjetaGuardada[]>([]);
    const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState<string | null>(null);
    const [tabMetodo, setTabMetodo] = useState<'nueva_tarjeta' | 'tarjetas_guardadas'>('nueva_tarjeta');
    const [formValues, setFormValues] = useState({ nombre: '', tarjeta: '', cvv: '' });
    const [expiracion, setExpiracion] = useState('');
    const [expirationMonth, setExpirationMonth] = useState('');
    const [expirationYear, setExpirationYear] = useState('');
    const [procesando, setProcesando] = useState(false);

    // Sin boletos seleccionados (ej. entró directo/recargó): regresar al paquete.
    useEffect(() => {
        if (itemsHidratados && !items.length) {
            router.replace('/eventos');
        }
    }, [itemsHidratados, items.length, router]);

    // Debe estar logueado. Si no, abre el modal de login sin salir de la página.
    useEffect(() => {
        if (status === 'unauthenticated') {
            requestLogin().then((ok) => {
                if (!ok) router.replace('/eventos');
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    // Detalle del paquete (cargos, nombre, ciudad).
    useEffect(() => {
        let activo = true;
        (async () => {
            setCargandoPaquete(true);
            try {
                const data = await getPaquete(Number(paqueteId));
                if (activo) setPaquete(data);
            } catch (error) {
                console.error('Error cargando paquete:', error);
            } finally {
                if (activo) setCargandoPaquete(false);
            }
        })();
        return () => { activo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paqueteId]);

    // Openpay (device_session_id).
    useEffect(() => {
        let scriptOpenPay: HTMLScriptElement | null = null;
        let scriptData: HTMLScriptElement | null = null;

        const setupOpenpay = async () => {
            const OpenPay = (window as any).OpenPay;
            if (!OpenPay) return;
            try {
                const { data } = await apiApplication.get('/pagos/get/credenciales');
                OpenPay.setId(data.merchantId);
                OpenPay.setApiKey(data.publicKey);
                OpenPay.setSandboxMode(data.sandbox);
                setDeviceDataId(OpenPay.deviceData.setup('formId'));
            } catch (error) {
                console.error('Error configurando Openpay:', error);
            }
        };

        if ((window as any).OpenPay) {
            setupOpenpay();
        } else {
            scriptOpenPay = document.createElement('script');
            scriptOpenPay.src = 'https://resources.openpay.mx/lib/openpay.v1.min.js';
            scriptOpenPay.async = false;
            scriptOpenPay.onload = () => {
                scriptData = document.createElement('script');
                scriptData.src = 'https://resources.openpay.mx/lib/openpay-data-js/1.2.38/openpay-data.v1.min.js';
                scriptData.async = false;
                scriptData.onload = setupOpenpay;
                document.body.appendChild(scriptData);
            };
            document.body.appendChild(scriptOpenPay);
        }

        return () => {
            if (scriptOpenPay?.parentNode) scriptOpenPay.parentNode.removeChild(scriptOpenPay);
            if (scriptData?.parentNode) scriptData.parentNode.removeChild(scriptData);
        };
    }, []);

    // Perfil de pago (id Openpay + tarjetas guardadas).
    useEffect(() => {
        let activo = true;
        (async () => {
            try {
                const { data } = await apiApplication.get('/pagos/get/mi_perfil');
                if (!activo) return;
                setOpenId(data.idOpenpay);
                setTarjetas(data.tarjetas ?? []);
            } catch {
                try {
                    const { data } = await apiApplication.post('/pagos/save/usuario');
                    if (activo) setOpenId(data.idOpenpay);
                } catch (error) {
                    console.error('Error obteniendo perfil de pago:', error);
                }
            }
        })();
        return () => { activo = false; };
    }, []);

    const subtotal = useMemo(
        () => items.reduce((acc, i) => acc + i.cantidad * i.precio, 0),
        [items],
    );
    const cargoServicio = paquete ? round2(subtotal * (Number(paquete.cargoServicioPorcentaje) || 0) / 100) : 0;
    const cargoTarjeta = paquete ? round2(subtotal * (Number(paquete.cargoTarjetaPorcentaje) || 0) / 100) : 0;
    const total = round2(subtotal + cargoServicio + cargoTarjeta);

    const handleExpiracionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 2) value = `${value.slice(0, 2)}/${value.slice(2, 4)}`;
        setExpiracion(value);
        if (value.length === 5) {
            setExpirationMonth(value.slice(0, 2));
            setExpirationYear(value.slice(3, 5));
        }
    };

    const eliminarTarjeta = async (idtarjeta: string) => {
        try {
            const perfil = await apiApplication.get('/pagos/get/mi_perfil');
            const clienteId = perfil.data.idOpenpay;
            if (!clienteId) return;
            const res = await apiApplication.delete(`/pagos/tarjeta/${clienteId}/${idtarjeta}`);
            Swal.fire({ icon: 'success', title: 'Tarjeta eliminada', text: res.data.message });
            setTarjetas((prev) => prev.filter((t) => t.idtarjeta !== idtarjeta));
            if (tarjetaSeleccionada === idtarjeta) setTarjetaSeleccionada(null);
        } catch (error) {
            console.error('Error al eliminar la tarjeta:', error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar la tarjeta.' });
        }
    };

    const pagar = async () => {
        if (!paquete) return;
        if (status !== 'authenticated' || !isVerified) {
            return Swal.fire({ icon: 'info', title: 'Sesión requerida', text: 'Debes iniciar sesión con una cuenta verificada.' });
        }

        if (tabMetodo === 'nueva_tarjeta') {
            if (!formValues.nombre || !/^[a-zA-Z\s]+$/.test(formValues.nombre)) {
                return Swal.fire({ icon: 'warning', title: 'Nombre inválido', text: 'Escribe el nombre del titular como aparece en la tarjeta.' });
            }
            if (!validarNumeroTarjeta(formValues.tarjeta)) {
                return Swal.fire({ icon: 'warning', title: 'Tarjeta inválida', text: 'Revisa el número de la tarjeta.' });
            }
            if (!expirationMonth || !expirationYear) {
                return Swal.fire({ icon: 'warning', title: 'Fecha inválida', text: 'Ingresa la fecha de vencimiento (MM/AA).' });
            }
            if (!validarCVC(formValues.cvv, formValues.tarjeta)) {
                return Swal.fire({ icon: 'warning', title: 'CVV inválido', text: 'Revisa el código de seguridad.' });
            }
        } else if (!tarjetaSeleccionada) {
            return Swal.fire({ icon: 'warning', title: 'Selecciona una tarjeta', text: 'Elige una tarjeta guardada para continuar.' });
        }

        const confirmacion = await Swal.fire({
            title: '¿Confirmar compra?',
            text: `Vas a pagar ${precioMXN(total)}. ¿Quieres continuar?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, pagar',
            cancelButtonText: 'Cancelar',
        });
        if (!confirmacion.isConfirmed) return;

        if (tabMetodo === 'nueva_tarjeta') {
            const { isConfirmed } = await Swal.fire({
                title: '¿Quieres guardar tu tarjeta?',
                text: 'Podrás usarla en futuras compras sin ingresarla de nuevo.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, guardar y pagar',
                cancelButtonText: 'No, solo pagar',
            });
            if (isConfirmed) {
                try {
                    await apiApplication.post('/pagos/save/tarjeta', {
                        card_number: formValues.tarjeta,
                        holder_name: formValues.nombre,
                        expiration_year: expirationYear,
                        expiration_month: expirationMonth,
                        cvv2: formValues.cvv,
                        device_session_id: deviceDataId,
                    });
                } catch (error) {
                    console.error('Error al guardar la tarjeta:', error);
                    Swal.fire({ icon: 'error', title: 'Aviso', text: 'No se pudo guardar la tarjeta, pero puedes continuar con el pago.' });
                }
            }
        }

        setProcesando(true);
        try {
            const usaGuardada = tabMetodo === 'tarjetas_guardadas' && !!tarjetaSeleccionada;
            const body: MakeCargoCityPassBody = {
                paqueteId: paquete.id,
                items: items.map((i) => ({ tipoBoletoId: i.tipoBoletoId, cantidad: i.cantidad })),
                tipoDispositivo: 'web',
                device_session_id: deviceDataId,
                ...(usaGuardada
                    ? { source_id: tarjetaSeleccionada as string, usuarioOpenpayId: openId }
                    : {
                          tarjeta: {
                              card_number: formValues.tarjeta,
                              holder_name: formValues.nombre,
                              expiration_year: expirationYear,
                              expiration_month: expirationMonth,
                              cvv2: formValues.cvv,
                              device_session_id: deviceDataId,
                          },
                      }),
            };

            const data = await makeCargo(body);
            const transaccionId = data.cargo?.id;

            if (data.cargo?.payment_method?.url && data.cargo?.payment_method?.type === 'redirect') {
                window.location.href = data.cargo.payment_method.url;
                return;
            }

            router.push(`/citypass/terminar_compra/${data.compraId}?id=${transaccionId}`);
        } catch (error: any) {
            setProcesando(false);
            Swal.fire({ icon: 'error', title: 'Error', text: error?.message || 'Ocurrió un error al procesar el pago.' });
        }
    };

    if (cargandoPaquete || !items.length) return <Loader />;

    if (!paquete) {
        return (
            <div className="min-h-[60vh] bg-gray-50 flex items-center justify-center px-4 text-center">
                <div>
                    <h1 className="mb-2 text-2xl font-bold text-gray-900">Paquete no disponible</h1>
                    <button
                        type="button"
                        onClick={() => router.push('/eventos')}
                        className="mt-2 rounded-lg bg-accentBase px-4 py-2 text-neutral transition-colors hover:bg-accentLight"
                    >
                        Volver a inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {procesando && <Loader />}
            <div className="container mx-auto px-4 py-6 md:px-5 md:py-8 lg:px-8 2xl:px-20">
                {/* Encabezado */}
                <div className="mb-6 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="Volver"
                        className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-gray-100 text-gray-700 transition hover:bg-gray-200"
                    >
                        <IoArrowBack className="text-xl" />
                    </button>
                    <h1 className="text-2xl font-bold uppercase text-gray-800 md:text-3xl">Finalizar compra</h1>
                </div>

                <form id="formId" onSubmit={(e) => e.preventDefault()} className="grid gap-8 lg:grid-cols-3">
                    {/* Método de pago */}
                    <section className="flex flex-col gap-4 lg:col-span-2">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-3 text-lg font-bold text-gray-900">Selecciona método de pago</h2>
                            <div className="mb-3 flex items-center gap-x-2">
                                <label className="relative flex h-10 w-full select-none items-center gap-2 rounded-lg px-2 text-sm font-medium hover:bg-zinc-100 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-500 has-[:checked]:ring-1 has-[:checked]:ring-blue-300">
                                    <input className="absolute right-3 h-4 w-4 accent-current" type="radio" checked={tabMetodo === 'nueva_tarjeta'} onChange={() => setTabMetodo('nueva_tarjeta')} />
                                    Nueva tarjeta
                                </label>
                                {tarjetas.length > 0 && (
                                    <label className="relative flex h-10 w-full select-none items-center gap-2 rounded-lg px-2 text-sm font-medium hover:bg-zinc-100 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-500 has-[:checked]:ring-1 has-[:checked]:ring-blue-300">
                                        <input className="absolute right-3 h-4 w-4 accent-current" type="radio" checked={tabMetodo === 'tarjetas_guardadas'} onChange={() => setTabMetodo('tarjetas_guardadas')} />
                                        Tarjetas guardadas
                                    </label>
                                )}
                            </div>

                            <figure className="mb-4 flex flex-wrap items-center gap-3">
                                <img className="w-8 object-contain" width={60} height={40} src="/visa.png" alt="Visa" />
                                <img className="w-8 object-contain" width={60} height={40} src="/masterCard.png" alt="Mastercard" />
                                <img className="w-8 object-contain" width={60} height={40} src="/americanExpress.png" alt="American Express" />
                                <img className="w-12 object-contain" width={60} height={40} src="/carnet.png" alt="Carnet" />
                            </figure>

                            {tabMetodo === 'nueva_tarjeta' && (
                                <div className="grid gap-3">
                                    <div className="space-y-1">
                                        <label htmlFor="nombre" className="block pb-1 text-sm font-semibold text-gray-400">Nombre del titular</label>
                                        <input
                                            type="text"
                                            id="nombre"
                                            placeholder="Nombre en la tarjeta"
                                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                                            value={formValues.nombre}
                                            onChange={(e) => setFormValues({ ...formValues, nombre: e.target.value.replace(/[^a-zA-Z\s]/g, '') })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label htmlFor="tarjeta" className="block pb-1 text-sm font-semibold text-gray-400">Número de la tarjeta</label>
                                        <input
                                            type="text"
                                            id="tarjeta"
                                            placeholder="Número de tarjeta"
                                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                                            value={formValues.tarjeta}
                                            onChange={(e) => setFormValues({ ...formValues, tarjeta: e.target.value.replace(/\D/g, '') })}
                                            maxLength={19}
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-full space-y-1">
                                            <label htmlFor="expiracion" className="block pb-1 text-sm font-semibold text-gray-400">Vencimiento</label>
                                            <input
                                                type="text"
                                                id="expiracion"
                                                placeholder="MM/AA"
                                                className="w-full rounded-md border border-gray-300 px-3 py-2"
                                                value={expiracion}
                                                onChange={handleExpiracionChange}
                                                maxLength={5}
                                            />
                                        </div>
                                        <div className="w-full space-y-1">
                                            <label htmlFor="cvv" className="block pb-1 text-sm font-semibold text-gray-400">Código de seguridad</label>
                                            <input
                                                type="text"
                                                id="cvv"
                                                placeholder="CVV"
                                                className="w-full rounded-md border border-gray-300 px-3 py-2"
                                                value={formValues.cvv}
                                                onChange={(e) => setFormValues({ ...formValues, cvv: e.target.value.replace(/\D/g, '') })}
                                                maxLength={4}
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <LuBadgeCheck className="flex-none text-2xl text-green-500" />
                                            <small className="text-xs text-gray-500">Pago seguro con encriptación de 256 bits.</small>
                                        </div>
                                        <img width={90} height={54} src="/openpay.webp" alt="Openpay" />
                                    </div>
                                </div>
                            )}

                            {tabMetodo === 'tarjetas_guardadas' && (
                                <div>
                                    <h3 className="mb-2 text-base font-semibold text-gray-500">Mis tarjetas guardadas</h3>
                                    {tarjetas.map((tarjeta) => (
                                        <div key={tarjeta.idtarjeta} className="group mb-2 flex w-full items-center gap-x-3 rounded-lg bg-gray-100 p-2 transition-colors hover:bg-gray-200">
                                            <label className="relative flex h-10 w-full select-none items-center gap-3 rounded-lg px-3 text-sm font-medium has-[:checked]:bg-blue-50 has-[:checked]:text-blue-500 has-[:checked]:ring-1 has-[:checked]:ring-blue-300">
                                                <input
                                                    className="absolute right-3 h-4 w-4 accent-current"
                                                    type="radio"
                                                    value={tarjeta.idtarjeta}
                                                    checked={tarjetaSeleccionada === tarjeta.idtarjeta}
                                                    onChange={() => setTarjetaSeleccionada(tarjeta.idtarjeta)}
                                                />
                                                {tarjeta.tarjeta} ({tarjeta.banco})
                                            </label>
                                            <span className="opacity-0 transition-opacity group-hover:opacity-100">
                                                <button type="button" onClick={() => eliminarTarjeta(tarjeta.idtarjeta)} aria-label="Eliminar tarjeta">
                                                    <IoTrashOutline className="text-xl text-red-500" />
                                                </button>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Resumen */}
                    <section className="lg:col-span-1">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
                            <h2 className="mb-1 text-lg font-bold text-gray-900">{paquete.nombre}</h2>
                            {paquete.ciudad && <p className="mb-3 text-sm text-gray-500">{paquete.ciudad.nombre}</p>}

                            <ul className="mb-3 grid gap-2">
                                {items.map((item) => (
                                    <li key={item.tipoBoletoId} className="flex items-center gap-2 rounded-md bg-gray-100 p-2 text-sm text-gray-600">
                                        <div className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-accentBase">
                                            <HiOutlineTicket className="text-white" />
                                        </div>
                                        <div className="flex w-full items-center justify-between">
                                            <span>{item.cantidad} x {item.tipoBoleto}</span>
                                            <span className="font-medium">{precioMXN(item.cantidad * item.precio)}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="border-t border-gray-100 pt-3">
                                <p className="flex items-center justify-between text-sm text-gray-600">Subtotal: <span className="font-medium">{precioMXN(subtotal)}</span></p>
                                <p className="flex items-center justify-between text-sm text-gray-600">Cargo por servicio: <span className="font-medium">{precioMXN(cargoServicio)}</span></p>
                                <p className="flex items-center justify-between text-sm text-gray-600">Cargo por uso de tarjeta: <span className="font-medium">{precioMXN(cargoTarjeta)}</span></p>
                                <div className="my-2 border-t border-gray-100" />
                                <p className="flex items-center justify-between text-xl font-bold text-emphasis">Total: <span>{precioMXN(total)}</span></p>
                            </div>

                            <p className="my-3 text-center text-xs text-gray-400">
                                Al pagar, confirmas que aceptas nuestros términos y condiciones y la política de privacidad.
                            </p>
                            <button
                                type="button"
                                onClick={pagar}
                                disabled={procesando}
                                className="w-full rounded-lg bg-accentBase py-3 text-center font-semibold text-neutral transition-colors hover:bg-accentLight disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Pagar {precioMXN(total)}
                            </button>
                        </div>
                    </section>
                </form>
            </div>
        </div>
    );
};

export default CityPassCheckoutPage;
