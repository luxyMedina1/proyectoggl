import TransferirModal from '../../../components/TransferirModal';
import { useCityPassStore } from '../../../hooks/useCityPassStore';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    boletoId: number;
    descripcion?: string;
    onSuccess?: () => void;
}

// Transferir un boleto de CityPass a un amigo (queda pendiente hasta que lo acepte).
// Envoltorio del modal reutilizable; el overlay va por encima del resto (z-[70]).
const TransferirCityPassModal = ({ isOpen, onClose, boletoId, descripcion, onSuccess }: Props) => {
    const { transferirBoleto } = useCityPassStore();

    return (
        <TransferirModal
            isOpen={isOpen}
            onClose={onClose}
            titulo="Transferir boleto"
            overlayZIndexClass="z-[70]"
            items={[{ id: boletoId, titulo: descripcion ?? `Boleto #${boletoId}` }]}
            onSuccess={onSuccess}
            onConfirmar={async (destinatario) => {
                await transferirBoleto(boletoId, destinatario.amigo.id);
                return `${destinatario.amigo.fullName} debe aceptar la transferencia para completarla.`;
            }}
        />
    );
};

export default TransferirCityPassModal;
