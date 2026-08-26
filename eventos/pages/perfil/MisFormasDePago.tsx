import apiApplication from "../../../api/apiApplication";
import { useEffect, useState } from "react";
import { validarNumeroTarjeta, validarCVC } from "../../../utils/cardHelpers";
import Sidebar from './components/Sidebar';
import Swal from "sweetalert2";
import Loader from '@/publicUi/components/Loader';
import { CiCreditCard2 } from "react-icons/ci";
import { FaCcMastercard, FaCcVisa, FaTrashCan, FaPlus  } from "react-icons/fa6";
import { RiSecurePaymentLine } from "react-icons/ri";

function MisFormasDePago() {

    const [tarjetas, setTarjetas] = useState<Tarjetas[] | null>(null);
    const [formValues, setFormValues] = useState({nombre: '', tarjeta: '', expiracion: '', cvv: '',});
    const [expiracion, setExpiracion] = useState("");
    const [expirationYear, setExpirationYear] = useState("");
    const [expirationMonth, setExpirationMonth] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [openId, setOpenId] = useState('');
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        const getPerfilPagos = async () => {
            try {
                setCargando(true);
                const { data } = await apiApplication.get('/pagos/get/mi_perfil');
                setOpenId(data.idOpenpay);
                setTarjetas(data.tarjetas);
            } catch (error :any) {
                console.error("Error al obtener las tarjetas:", error);
                let mensajeError = "Error al obtener las tarjetas.";
                if(error.response && error.response.data && error.response.data.message){
                    mensajeError = error.response.data.message;
                } else if (error.message){
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
        getPerfilPagos();
    }, []);

    // Carga la librería de OpenPay para poder usar OpenPay.card.validateCardNumber()
    useEffect(() => {
        const scriptOpenPay = document.createElement('script');
        scriptOpenPay.src = 'https://resources.openpay.mx/lib/openpay.v1.min.js';
        scriptOpenPay.async = false;
        document.body.appendChild(scriptOpenPay);

        return () => {
            document.body.removeChild(scriptOpenPay);
        };
    }, []);

    interface Tarjetas {
        id: number,
        idtarjeta: string,
        banco: string,
        marca: string,
        nombreEnTarjeta: string,
        tarjeta: string,
        tipo: string,
    }

    const obtenerIconoTarjeta = (marca: string) => {
        switch (marca.toLowerCase()) {
          case 'visa':
            return <FaCcVisa className="text-3xl" />;
          case 'mastercard':
            return <FaCcMastercard className="text-3xl" />;
          default:
            return null;
        }
    };

    const obtenerColorTarjeta = (marca: string) => {
        switch (marca.toLowerCase()) {
          case 'visa':
            return 'bg-gradient-to-r from-[#013b87ff] to-[#07254fff]';
          case 'mastercard':
            return 'bg-gradient-to-r from-[#d92525ff] to-[#a11b1bff]';
          default:
            return null;
        }
    };

    const handleEliminarTarjeta = async (tarjetaId: string) => {
        const confirmacion = await Swal.fire({
            title: "¿Estás seguro?",
            text: "Esta acción eliminará la tarjeta de forma permanente.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Sí, eliminar",
            cancelButtonText: "Cancelar",
        });
    
        if (confirmacion.isConfirmed) {
            try {
                setCargando(true);
                const {data} = await apiApplication.delete(`/pagos/tarjeta/${openId}/${tarjetaId}`);
                Swal.fire({ title: "Eliminado", text: data.message, icon: "success", timer: 1000, showConfirmButton: false,});
                setCargando(false);
                setTarjetas(prevTarjetas => prevTarjetas ? prevTarjetas.filter(tarjeta => tarjeta.idtarjeta !== tarjetaId) : null);
            } catch (error) {
                console.error(error);
                setCargando(false);
                Swal.fire({ title: "Error", text: "Hubo un problema al eliminar la tarjeta.", icon: "error",});
            }
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

    const handleGuardarTarjeta = async () => {
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

        const { isConfirmed } = await Swal.fire({
            title: "¿Quieres guardar tu tarjeta?",
            text: "Podrás usarla en futuras compras sin necesidad de ingresarla nuevamente.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sí, guardar",
            cancelButtonText: "Cancelar",
          });
    
          if (isConfirmed) {
            try {
                setCargando(true)
                const saveCardPayload = {
                    card_number: formValues.tarjeta,
                    holder_name: formValues.nombre,
                    expiration_year: expirationYear,
                    expiration_month: expirationMonth,
                    cvv2: formValues.cvv,
                };
    
                const { data } = await apiApplication.post("/pagos/save/tarjeta", saveCardPayload);
                console.log(data);
                Swal.fire({ icon: 'success',title: 'Correcto!', text: 'Tarjeta guardada exitosamente',timer: 1000, showConfirmButton: false,});
                setCargando(false);
                setTarjetas(prevTarjetas => prevTarjetas ? [...prevTarjetas, data.tarjeta] : [data.tarjeta]);
                setFormValues({nombre: '', tarjeta: '', expiracion: '', cvv: '',});
                setExpirationMonth("");
                setExpirationYear("");
                setExpiracion("");
            } catch (error) {
                setCargando(false)
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

  return (
    <div style={{ backgroundImage: `url('/bg_perfil.svg')`, backgroundRepeat: "no-repeat", backgroundPosition: 'top', backgroundSize: '100%', paddingTop: '40px' }}>
        {cargando && (  <Loader /> )}
        <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
            <div className="grid grid-cols-7 gap-4 items-start mb-5">
                <Sidebar />
                <section className='bg-gray-50 shadow-md rounded-xl col-span-7 md:col-span-4 lg:col-span-5 p-4'>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h2 className="text-gray-800 text-2xl 2xl:text-3xl font-semibold">Mis tarjetas guardadas</h2>
                        <button onClick={() => setShowForm(true) } className="bg-gray-300 text-gray-700 hover:bg-gray-400 hover:text-gray-800 transition-colors rounded-md px-2 py-1 flex items-center"><FaPlus className="w-5 flex-none" />Agregar tarjeta</button>
                    </div>
                    {showForm && (
                        <fieldset className="mt-5 border border-gray-300 rounded-lg p-2 md:p-4 grid grid-cols-4 gap-4">
                            <legend className="text-gray-600 text-xl font-medium col-span-2">Información de la tarjeta</legend>
                            <label className="font-medium text-gray-700 col-span-4 md:col-span-2" htmlFor="nombre">
                                Nombre del titular
                                <input type="text" id="nombre" className="block border border-gray-300 rounded-md p-2 w-full" placeholder="Escriba el nombre del titular"                               value={formValues.nombre}
                                onChange={(e) => setFormValues({ ...formValues, nombre: e.target.value })}
                                />
                            </label>
                            <label className="font-medium text-gray-700 col-span-4 md:col-span-2" htmlFor="numero">
                                Número de la tarjeta
                                <input type="text" id="numero" className="block border border-gray-300 rounded-md p-2 w-full" placeholder="Tarjeta de crédito / débito" value={formValues.tarjeta}
                                onChange={(e) => { const value = e.target.value.replace(/\D/g, ''); setFormValues({ ...formValues, tarjeta: value });}}
                                maxLength={19}
                                />
                            </label>
                            <label className="font-medium text-gray-700 col-span-2 md:col-span-1" htmlFor="codigo">
                                Código de seguridad
                                <input type="text" id="codigo" className="block border border-gray-300 rounded-md p-2 w-full" placeholder="CVV" value={formValues.cvv}
                                    onChange={(e) => { const value = e.target.value.replace(/\D/g, ''); setFormValues({ ...formValues, cvv: value });}}
                                    maxLength={4}  
                                />
                            </label>
                            <label className="font-medium text-gray-700 col-span-2 md:col-span-1" htmlFor="vencimiento">
                                Fecha de vencimiento
                                <input type="text" id="vencimiento" className="block border border-gray-300 rounded-md p-2 w-full" placeholder="MM/AA" value={expiracion}
                                    onChange={handleExpiracionChange}
                                    maxLength={5}  
                                />
                            </label>
                            <small className="col-span-4 text-gray-400 flex items-center gap-x-2"><RiSecurePaymentLine className="text-lg" />La información de tu tarjeta se guardará de forma segura. </small>
                            <button onClick={() => handleGuardarTarjeta()} className="col-span-4 md:col-span-2 w-full bg-accentLight hover:bg-accentBase transition-colors px-2 py-2 rounded-lg text-neutral">Agregar</button>
                            <button onClick={() => setShowForm(false) } className="col-span-4 md:col-span-2 w-full bg-gray-200 hover:bg-gray-300 transition-colors px-2 py-2 rounded-lg text-gray-700">Cancelar</button>
                        </fieldset>
                    )}
                    <hr className="my-3" />
                    {tarjetas?.length === 0 ? (
                        <p className="text-gray-500 text-xl text-center my-5">No hay tarjetas guardadas.</p>
                    ) : (
                        tarjetas?.map(tarjeta => (
                            <div key={tarjeta.id} className="flex items-center gap-4 mb-5">
                                <div className={`rounded-lg bg-gray-600 p-2 lg:p-4 text-white w-80 min-h-28 ${obtenerColorTarjeta(tarjeta.marca)}`}>
                                    <p className="font-semibold text-lg tracking-wide flex items-center justify-between">
                                        {tarjeta.banco}
                                        <span className="uppercase">{obtenerIconoTarjeta(tarjeta.marca)}</span>
                                    </p>
                                    <p className="flex items-center gap-x-2 my-2">
                                        <CiCreditCard2 className="text-3xl" />
                                        <span className="tracking-wider">{tarjeta.tarjeta}</span>
                                    </p>
                                    <p className="capitalize flex items-center justify-between">{tarjeta.nombreEnTarjeta} <span>{tarjeta.tipo}</span></p>
                                </div>
                                <div>
                                    <button onClick={() => handleEliminarTarjeta(tarjeta.idtarjeta)} className="text-gray-400 hover:text-red-500 transition-all hover:scale-125"><FaTrashCan className="text-2xl" /></button>
                                </div>
                            </div>
                        ))
                    )}
                </section>
            </div>
        </div>
    </div>
  );
}

export default MisFormasDePago;
