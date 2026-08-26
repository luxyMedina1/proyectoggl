"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import apiApplication from "../../../api/apiApplication";
import LocalLoader from "../../../components/LocalLoader";
import { LuBadgeCheck } from "react-icons/lu";
import ConfettiCanvas from "../../../components/ConfettiCanvas";

interface Compra {
  total: number,
  evento?:{
    nombre: string,
    recinto?: {
      nombre: string,
    }
  }
}

export default function TerminarCompraAbono() {
  return (
    <Suspense fallback={<LocalLoader />}>
      <TerminarCompraAbonoContent />
    </Suspense>
  );
}

function TerminarCompraAbonoContent() {
  const searchParams = useSearchParams();
  const transaccionId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [compraExitosa, setCompraExitosa] = useState(false);
  const [isVerifyMessage, setIsVerifyMessage] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  const [infoCompra, setInfoCompra] = useState<Compra | null>(null);

  useEffect(() => {
    const confirmarPago = async () => {
      if (!transaccionId) {
        setLoading(false);
        return Swal.fire({
          title: "Error",
          text: "Faltan datos para confirmar el pago.",
          icon: "error",
          confirmButtonText: "OK",
        });
      }

      try {
        const res_cargo = await apiApplication.post(`/pagos/check/cargo_abono/${transaccionId}`);

        console.log("Respuesta del pago:", res_cargo);

        if (res_cargo?.status === 201 || res_cargo?.status === 200) {
          setEmailCliente(res_cargo.data.email);

          setIsVerifyMessage(res_cargo.data.message)
          if(res_cargo?.data?.cargo?.pagado){
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
  }, [transaccionId]);

  return (
    <div className="relative">
      {loading && ( <LocalLoader /> )}
      <div className="flex justify-center items-center py-10" >
        <div className={`bg-white p-2 md:p-3 rounded-lg shadow-lg min-w-96 max-w-96 text-center min-h-60`}>
          <div className='rounded-full w-12 h-12 bg-green-500 grid place-items-center mx-auto mb-5'><LuBadgeCheck className='text-white text-3xl' /></div>
          {!compraExitosa ? (
            <h2 className='text-2xl font-bold text-gray-800'>{isVerifyMessage}</h2>
          ): (
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
            </>
          )}
          <hr className='my-3'/>

          <Link href="/perfil/mis_compras" className='w-full block px-4 py-2 bg-accentBase hover:bg-emphasis mb-2 transition-colors text-white rounded-lg z-10 relative'>Ir a mis compras</Link>
        </div>
      </div>

    </div>
  );
};
