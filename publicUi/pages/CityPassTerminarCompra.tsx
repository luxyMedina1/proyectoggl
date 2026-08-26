import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from '@/utils/nextRouterCompat';
import Swal from 'sweetalert2';
import { LuBadgeCheck } from 'react-icons/lu';
import Loader from '../components/Loader';
import ConfettiCanvas from '../../eventos/pages/compras/ConfettiCanvas';
import { useCityPassStore } from '../../hooks/useCityPassStore';

// Página de retorno tras el 3D-Secure de Openpay: confirma el cargo y emite los boletos.
const CityPassTerminarCompra = () => {
    useParams(); // :compraId (parte de la URL de retorno de Openpay)
    const location = useLocation();
    const transaccionId = new URLSearchParams(location.search).get('id');
    const { checkCargo } = useCityPassStore();

    const [loading, setLoading] = useState(true);
    const [exito, setExito] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [boletosEmitidos, setBoletosEmitidos] = useState<number | null>(null);

    useEffect(() => {
        const confirmar = async () => {
            if (!transaccionId) {
                setLoading(false);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Faltan datos para confirmar el pago.' });
                return;
            }
            try {
                const data = await checkCargo(transaccionId);
                setMensaje(data.message);
                setBoletosEmitidos(data.boletosEmitidos ?? null);
                setExito(true);
            } catch (error: any) {
                Swal.fire({ icon: 'error', title: 'Error', text: error?.message || 'Hubo un problema al confirmar el pago.' });
            } finally {
                setLoading(false);
            }
        };
        confirmar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transaccionId]);

    return (
        <div className="relative min-h-[60vh] bg-gray-50">
            {loading && <Loader />}
            <div className="flex items-center justify-center py-10">
                <div className="min-h-60 w-96 max-w-full rounded-lg bg-white p-4 text-center shadow-lg">
                    <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-green-500">
                        <LuBadgeCheck className="text-3xl text-white" />
                    </div>
                    {exito ? (
                        <>
                            <ConfettiCanvas />
                            <h2 className="mb-4 text-2xl font-bold text-gray-800">¡Compra exitosa!</h2>
                            <p className="text-gray-600">{mensaje || 'Tu CityPass se compró correctamente.'}</p>
                            {boletosEmitidos !== null && (
                                <p className="mt-2 text-gray-600">
                                    Boletos emitidos: <span className="font-bold">{boletosEmitidos}</span>
                                </p>
                            )}
                            <p className="mt-2 text-gray-600">Recibirás un correo de confirmación.</p>
                        </>
                    ) : (
                        !loading && (
                            <h2 className="text-2xl font-bold text-gray-800">No se pudo confirmar el pago</h2>
                        )
                    )}
                    <hr className="my-3" />
                    <Link to="/eventos" className="relative z-10 mb-2 block w-full rounded-lg bg-accentBase px-4 py-2 text-neutral transition-colors hover:bg-emphasis">
                        Volver a inicio
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default CityPassTerminarCompra;
