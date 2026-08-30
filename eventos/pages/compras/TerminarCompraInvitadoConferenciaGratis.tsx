import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Swal from "sweetalert2";
import apiApplication from "../../../api/apiApplication"
import Loader from '@/publicUi/components/Loader';
import { LuDownload } from "react-icons/lu";
import ConfettiCanvas from "./ConfettiCanvas";
import Link from "next/link";
import { FaArrowLeftLong } from "react-icons/fa6";
import { QRCodeCanvas } from 'qrcode.react';

const TerminarCompraInvitadoConferenciaGratis = () => {

    const { reservaId, esGeneral, invitadoId, promocionId } = useParams();

    const [loading, setLoading] = useState(true);
    const [compraExitosa, setCompraExitosa] = useState(false);
    const [isVerifyMessage, setIsVerifyMessage] = useState('');
    const [emailCliente, setEmailCliente] = useState('');
    const [infoCompra, setInfoCompra] = useState<Compra | null>(null);
    const [quemadoUUID, setQuemadoUUID] = useState('');
    const qrRef = useRef<HTMLDivElement>(null);

    interface Compra {
        total: number,
        evento?: {
            nombre: string,
            recinto?: {
                nombre: string,
            },
            imagenLogo: string;
        }
    }

    useEffect(() => {
        const confirmarPago = async () => {
            if (!reservaId || !invitadoId) {
                setLoading(false);
                return Swal.fire({
                    title: "Error",
                    text: "Faltan datos para confirmar el pago.",
                    icon: "error",
                    confirmButtonText: "OK",
                });
            }

            try {
                const res_cargo = await apiApplication.post(`/pagos/check/conferencia/cargo_invitado/gratis/${invitadoId}`, {
                    reservaId: reservaId,
                    esGeneral: true,
                    promocion_id: promocionId,
                    tipo_venta: 'web'
                });

                if (res_cargo?.status === 201 || res_cargo?.status === 200) {

                    const ticket_id = res_cargo.data.ticket.id;

                    // 🔄 ENVIAR CORREO
                    const enviar_mail = await apiApplication.post(`/correos/sold-tickets-email-invitado-conferencia/${invitadoId}/${ticket_id}`);

                    setEmailCliente(enviar_mail.data.user.email);

                    setIsVerifyMessage(res_cargo.data.message || 'A ocurrido un error contacte con soporte')
                    setCompraExitosa(true);
                    setInfoCompra(res_cargo.data.ticket);
                    setQuemadoUUID(res_cargo.data.pases.generatedMaps[0].quemadoUUID);
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
    }, [reservaId, esGeneral]);

    const downloadQR = async () => {
        // console.log('click aqui alv...)
        if (qrRef.current) {
            try {
                // Import dinámico: html2canvas (~200 KB) sólo se descarga al
                // pulsar "Descargar QR", no en la carga inicial de la página.
                const { default: html2canvas } = await import('html2canvas');
                const canvas = await html2canvas(qrRef.current, {
                    scale: 4,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                });

                const url = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = `tarjeta-qr-${infoCompra?.evento?.nombre || 'evento'}.png`;
                link.href = url;
                link.click();
            } catch (error) {
                console.error('Error al generar imagen:', error);
            }
        }
    };

    return (
        <div className="relative min-h-screen grid place-items-center">
            {loading && (<Loader />)}
            <div className="flex justify-center items-center py-10" >
                <div className={`bg-white p-2 md:p-3 rounded-lg shadow-lg min-w-96 max-w-96 text-center min-h-60`}>
                    {!compraExitosa ? (
                        <h2 className='text-2xl font-bold text-gray-800'>{isVerifyMessage}</h2>
                    ) : (
                        <>
                            <ConfettiCanvas />
                            {infoCompra && (
                                <div ref={qrRef} className='rounded-2xl min-h-96 mt-10 w-full md:max-w-lg mx-auto border shadow-sm bg-white'>
                                    <div className='min-h-20 bg-gradient-to-r from-[#1c4ed6] to-[#14b8a7] text-white rounded-t-2xl p-2 md:p-4'>
                                        <img className="mx-auto" src={infoCompra.evento?.imagenLogo} alt="" />
                                    </div>
                                    <div className='p-2 md:p-4 space-y-5'>
                                        <h3 className='text-center text-blue-600 font-semibold text-2xl'>¡Te has registrado!</h3>
                                        <p className='text-sm text-gray-700'>Tu registro para <span className="font-medium">{infoCompra.evento?.nombre}</span> ha sido confirmado.Adjunto encontrarás un código QR, el cual deberás presentar el día del evento para poder acceder al recinto.</p>
                                        <div className='border border-gray-200 rounded-xl w-40 h-40 mx-auto shadow-lg'>
                                            <div className='grid place-items-center w-full h-full'>
                                                <QRCodeCanvas
                                                    value={JSON.stringify({
                                                        quemadoUUID: quemadoUUID,
                                                        general: esGeneral
                                                    })}
                                                    size={140}
                                                    level="M"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap justify-between gap-3 items-center">
                                            <Link data-html2canvas-ignore href={`/`} className='relative z-50 hover:cursor-pointer bg-gray-900 text-white rounded-full px-4 py-2 inline-flex items-center gap-x-2'><FaArrowLeftLong className='flex-none' />Regresar</Link>
                                            <button data-html2canvas-ignore onClick={downloadQR} className='relative z-50 bg-blue-600 px-5 py-2 rounded-full mx-auto text-white inline-flex items-center gap-x-2 hover:bg-blue-700 transition-colors'><LuDownload className='flex-none' size={22} />Descargar QR</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className='text-gray-600 my-4'>Tú QR fue enviado a: <span className='block text-lg font-bold text-gray-800'>{emailCliente}</span></p>
                        </>
                    )}
                </div>
            </div>

        </div>
    );
};

export default TerminarCompraInvitadoConferenciaGratis;
