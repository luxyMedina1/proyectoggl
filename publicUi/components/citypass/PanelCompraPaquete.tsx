'use client';

import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import { PaqueteBoletos, type ResumenCompra } from './PaqueteBoletos';
import { useAuthStore } from '../../../hooks/useAuthStore';
import { useAuthModal } from '../../../context/AuthModalContext';
import type { CityPassPrecio } from '../../../types/CityPass';

interface Props {
    paqueteId: number;
    precios: CityPassPrecio[];
    textoComplementario: string | null;
    disponibleVenta: boolean;
}

// Isla de cliente: el panel de boletos en sí ya vivía en su propio componente
// (`PaqueteBoletos`); esto solo envuelve el `onComprar` porque necesita hooks de
// cliente (sesión, modal de login, `sessionStorage`, navegación).
export const PanelCompraPaquete = ({ paqueteId, precios, textoComplementario, disponibleVenta }: Props) => {
    const router = useRouter();
    const { status, isVerified } = useAuthStore();
    const { requestLogin } = useAuthModal();

    // Ir al checkout con los boletos seleccionados. Si no hay sesión, abre el modal de login
    // (sin navegar a otra página) y continúa al comprar tras iniciar sesión.
    const comprar = async (resumen: ResumenCompra) => {
        if (!resumen.items.length) return;
        if (status !== 'authenticated') {
            const ok = await requestLogin();
            if (!ok) return;
        } else if (!isVerified) {
            Swal.fire({
                icon: 'info',
                title: 'Verifica tu cuenta',
                text: 'Debes verificar tu cuenta para completar la compra.',
            });
            return;
        }
        try {
            sessionStorage.setItem('citypass:checkout', JSON.stringify(resumen.items));
        } catch { /* almacenamiento no disponible: el checkout redirige si no hay items */ }
        router.push(`/citypass/checkout/${paqueteId}`);
    };

    return (
        <PaqueteBoletos
            precios={precios}
            textoComplementario={textoComplementario}
            disponibleVenta={disponibleVenta}
            onComprar={comprar}
        />
    );
};
