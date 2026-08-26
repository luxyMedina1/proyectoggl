import TransferirModal from '../../components/TransferirModal';
import { useTransferenciasStore } from '../../hooks/useTransferenciasStore';
import type { TipoBoletoTransfer } from '../../types/Transferencias';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    tipo: TipoBoletoTransfer;
    boletoId: number;
    descripcionBoleto?: string;
    onSuccess?: () => void;
}

// Transferencia 1-a-1 de un boleto de evento. Envoltorio del modal reutilizable.
const TransferirBoletoModal = ({
    isOpen,
    onClose,
    tipo,
    boletoId,
    descripcionBoleto,
    onSuccess,
}: Props) => {
    const { transferirBoleto } = useTransferenciasStore();

    return (
        <TransferirModal
            isOpen={isOpen}
            onClose={onClose}
            titulo="Transferir boleto"
            items={[{ id: boletoId, tipo, titulo: descripcionBoleto ?? `Boleto #${boletoId}` }]}
            onSuccess={onSuccess}
            onConfirmar={async (destinatario) => {
                await transferirBoleto({ tipo, boletoId, destinatarioId: destinatario.amigo.id });
                return `${destinatario.amigo.fullName} debe aceptar la transferencia para completarla.`;
            }}
        />
    );
};

export default TransferirBoletoModal;
