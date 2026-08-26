import { useParams, Link } from '@/utils/nextRouterCompat'; 
import { useEffect, useState} from "react";
import Swal from "sweetalert2";
import apiApplication from "../../../api/apiApplication";
import NavBar from "./components/NavBar"
import Loader from '@/publicUi/components/Loader';
import { FaArrowLeftLong } from "react-icons/fa6";
import { IoLocationOutline } from "react-icons/io5";
import { HiOutlineCalendarDateRange } from "react-icons/hi2";
import { formatDate } from '../../../utils/dateHelpers';

interface RouteParams {
    [key: string]: string | undefined;
    eventoId: string;
}

interface Conferencia {
    id: Number;
    nombre: string;
    fecha: string;
    descripcion: string;
    ubicacion: string;
    patrocinadores: any[];
    contactos: any[];
    redes_sociales: any[];
    imagenBanner: string;
}

function RegistroConferencia() {
    const { eventoId } = useParams<RouteParams>(); 

    const [conferencia, setConferencia] = useState<Conferencia | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!eventoId) {
            setError("ID de conferencia no encontrado en la ruta.");
            return;
        }
        const getConferenciaDetalle = async () => {
            try {
                const { data } = await apiApplication.get(`/eventos/conferencia/${eventoId}`);
                setConferencia(data);
                console.log("🚀 ~ getConferenciaDetalle ~ data:", data)
            } catch (error: any) {
                console.error('Error al obtener los datos:', error);
                if (error.response && error.response.data) {
                    const errorMessage = error.response.data.message || 'Ha ocurrido un error al obtener los datos.';
                    setError(errorMessage);
                    Swal.fire("Error", errorMessage, "error");
                } else {
                    setError('Ha ocurrido un error al obtener los datos.');
                    Swal.fire("Error", "Ha ocurrido un error inesperado", "error");
                }
            }
        };
        getConferenciaDetalle();
    }, [eventoId]); 

    if (error) {
        return <div>Error al cargar la conferencia: {error}</div>;
    }
    
    if (!conferencia || Object.keys(conferencia).length === 0) {
        return <Loader />;
    }

    return (
        <>
            <NavBar />
            <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 relative mb-10 mt-36">
                <div className="grid lg:grid-cols-2 gap-4">
                    <aside className="p-3 md:p-4 bg-white rounded-2xl shadow-sm border border-gray-200 space-y-4">
                        <Link to={`/cosmotech/${eventoId}`} className='bg-gray-900 text-white rounded-full px-4 py-2 inline-flex items-center gap-x-2'><FaArrowLeftLong className='flex-none' />Regresar al inicio</Link>
                        <figure>
                            <img className='rounded-2xl aspect-video object-cover max-h-[30rem]' src={conferencia.imagenBanner || '/beneficio_4.webp'} alt="" />
                        </figure>
                        <h3 className='font-semibold text-2xl text-gray-800'>{conferencia.nombre}</h3>
                        <p className='text-base lg:text-lg text-gray-600 flex items-center gap-x-2 font-medium'><HiOutlineCalendarDateRange className='flex-none' size={36} />{formatDate(conferencia.fecha)}</p>
                        <p className='text-base lg:text-lg text-gray-600 flex items-center gap-x-2 font-medium'><IoLocationOutline className='flex-none' size={36} />{conferencia.ubicacion}</p>
                        <span className='bg-amber-100 text-amber-700 uppercase px-3 py-1 text-sm rounded-full font-semibold inline-block'>Importante</span>
                        <p className='text-base lg:text-lg text-gray-600  font-medium'>Después de registrarte <strong>recibirás un código QR</strong> digital en tu correo. <br />Este será tu pase de entrada al evento.</p>
                    </aside>
                    <section className='p-3 md:p-4 bg-white rounded-2xl shadow-sm border border-gray-200'>
                        <h3 className='text-2xl font-semibold text-center text-gray-800 mb-2'>Registro del evento</h3>
                        <p className='text-center text-gray-600'>Complete el formulario para registrarse en nuestro evento.</p>
                    </section>
                </div>
            </div>
        </>
    )
}

export default RegistroConferencia