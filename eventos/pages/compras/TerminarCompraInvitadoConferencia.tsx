import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import apiApplication from "../../../api/apiApplication"
import Loader from '@/publicUi/components/Loader';
import { LuBadgeCheck } from "react-icons/lu";
import ConfettiCanvas from "./ConfettiCanvas";
import Link from "next/link";
import { FaArrowLeftLong } from "react-icons/fa6";

const TerminarCompraInvitadoConferencia = () => {

  const { reservaId, esGeneral, invitadoId, promocionId } = useParams();
  const searchParams = useSearchParams();
  const transaccionId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [compraExitosa, setCompraExitosa] = useState(false);
  const [isVerifyMessage, setIsVerifyMessage] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [infoCompra, setInfoCompra] = useState<Compra | null>(null);

  interface Compra {
    total: number,
    evento?: {
      nombre: string,
      recinto?: {
        nombre: string,
      }
    }
  }

  useEffect(() => {
    const confirmarPago = async () => {
      if (!transaccionId || !reservaId || !invitadoId) {
        setLoading(false);
        return Swal.fire({
          title: "Error",
          text: "Faltan datos para confirmar el pago.",
          icon: "error",
          confirmButtonText: "OK",
        });
      }

      try {
        const res_cargo = await apiApplication.post(`/pagos/check/conferencia/cargo_invitado/${invitadoId}/${transaccionId}`, {
          reservaId: reservaId,
          esGeneral: true,
          promocion_id: promocionId,
          tipo_venta: 'web'
        });

        console.log("Respuesta del pago:", res_cargo);

        if (res_cargo?.status === 201 || res_cargo?.status === 200) {

          const ticket_id = res_cargo.data.id;

          // 🔄 ENVIAR CORREO
          const enviar_mail = await apiApplication.post(`/correos/sold-tickets-email-invitado-conferencia/${invitadoId}/${ticket_id}`);

          setEmailCliente(enviar_mail.data.user.email);

          setIsVerifyMessage(res_cargo.data.message)
          if (res_cargo?.data?.cargo?.pagado) {
            setCompraExitosa(true);
            setInfoCompra(res_cargo.data);
          }
        } else {
          throw new Error(res_cargo.data?.message || "No se pudo confirmar el pago.");
        }
      } catch (error: any) {
        console.error("Error confirmando el pago", error);
        Swal.fire({
          title: "Error",
          text: error?.response?.data?.message || "Hubo un problema al confirmar el pago.",
          icon: "error",
          confirmButtonText: "OK",
        })
      } finally {
        setLoading(false);
      }
    };

    confirmarPago();
  }, [transaccionId, reservaId, esGeneral]);

  return (
    <div className="relative">
      {loading && (<Loader />)}
      <div className="flex justify-center items-center py-10" >
        <div className={`bg-white p-2 md:p-3 rounded-lg shadow-lg min-w-96 max-w-96 text-center min-h-60`}>
          <div className='rounded-full w-12 h-12 bg-green-500 grid place-items-center mx-auto mb-5'><LuBadgeCheck className='text-white text-3xl' /></div>
          {!compraExitosa ? (
            <h2 className='text-2xl font-bold text-gray-800'>{isVerifyMessage}</h2>
          ) : (
            <>
              <ConfettiCanvas />
              <h2 className='text-2xl font-bold text-gray-800 mb-4'>¡Compra exitosa!</h2>
              {infoCompra && (
                <div>
                  <p className="text-gray-600">Tus boletos para <span className="font-medium">{infoCompra.evento?.nombre}</span>, <span className="font-medium">{infoCompra.evento?.recinto?.nombre}</span> han sido comprados con éxito.</p>
                  <p className="text-gray-600">Recibiras un correo a <span className="font-medium">{emailCliente}</span></p>
                </div>
              )}
              <p className='text-gray-600 my-4'>Total pagado: <span className='block text-3xl font-bold text-gray-800'>${infoCompra?.total}</span></p>
              <Link href={`/`} className='relative z-50 mt-4 hover:cursor-pointer bg-gray-900 text-white rounded-full px-4 py-2 inline-flex items-center gap-x-2'><FaArrowLeftLong className='flex-none' />Regresar al inicio</Link>
            </>
          )}
          <hr className='my-3' />

        </div>
      </div>

    </div>
  );
};

export default TerminarCompraInvitadoConferencia;
