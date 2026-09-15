'use client';

import { useRouter } from 'next/navigation';
import { IoArrowBack } from 'react-icons/io5';

// Único motivo por el que el encabezado necesita un cliente: `router.back()` no
// existe en el servidor. El resto del encabezado (título) se queda en el Server
// Component que lo rodea.
export const VolverButton = () => {
    const router = useRouter();
    return (
        <button
            type="button"
            onClick={() => router.back()}
            aria-label="Volver"
            className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-gray-100 text-gray-700 transition hover:bg-gray-200"
        >
            <IoArrowBack className="text-xl" />
        </button>
    );
};
