import TransferirModal from '../../components/TransferirModal';
import { useTransferenciasStore } from '../../hooks/useTransferenciasStore';
import type { TipoBoletoTransfer } from '../../types/Transferencias';

export interface BoletoTransferible {
    id: number;
    tipo: TipoBoletoTransfer;
    titulo: string;
    detalle: string;
    precio: number | string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    boletos: BoletoTransferible[];
    onSuccess?: () => void;
}

// Transferencia múltiple de boletos de evento a un mismo destinatario. La UI vive en
// el componente reutilizable; aquí sólo va la lógica de envío (un POST por boleto,
// tolerante a fallos parciales con Promise.allSettled).
const MultiTransferirModal = ({ isOpen, onClose, boletos, onSuccess }: Props) => {
    const { transferirBoleto } = useTransferenciasStore();

    return (
        <TransferirModal
            isOpen={isOpen}
            onClose={onClose}
            titulo="Transferir boletos"
            items={boletos}
            permitirSeleccion
            onSuccess={onSuccess}
            onConfirmar={async (destinatario, seleccionados) => {
                const ids = new Set(seleccionados.map((s) => s.id));
                const aTransferir = boletos.filter((b) => ids.has(b.id));

                const resultados = await Promise.allSettled(
                    aTransferir.map((b) =>
                        transferirBoleto({
                            tipo: b.tipo,
                            boletoId: b.id,
                            destinatarioId: destinatario.amigo.id,
                        }),
                    ),
                );
                const exitos = resultados.filter((r) => r.status === 'fulfilled').length;
                const fallos = resultados.length - exitos;
                const primerErrorReason = (resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined)?.reason;
                const primerError = primerErrorReason instanceof Error ? primerErrorReason.message : '';

                if (exitos === 0) {
                    throw new Error(primerError || 'No se pudo enviar ninguna transferencia.');
                }

                let msg = `Se enviaron ${exitos} de ${resultados.length} transferencias a ${destinatario.amigo.fullName}. ${destinatario.amigo.fullName} debe aceptarlas para completarlas.`;
                if (fallos > 0 && primerError) msg += `\n\nAlgunas fallaron: ${primerError}`;
                return msg;
            }}
        />
    );
};

export default MultiTransferirModal;
