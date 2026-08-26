import { useState } from 'react';
import type { CityPassCategoria } from '../../../types/CityPass';

interface Props {
    categorias: CityPassCategoria[];
}

// Tabs superiores (Atracciones / Deportivos). Las no disponibles quedan deshabilitadas.
export const CityPassTabs = ({ categorias }: Props) => {
    const primeraDisponible =
        categorias.find((c) => c.disponible)?.clave ?? categorias[0]?.clave ?? '';
    const [activa, setActiva] = useState(primeraDisponible);

    if (!categorias?.length) return null;

    return (
        <div className="flex items-center gap-x-6 border-b border-gray-200">
            {categorias.map((cat) => {
                const activo = cat.clave === activa;
                return (
                    <button
                        key={cat.clave}
                        type="button"
                        disabled={!cat.disponible}
                        onClick={() => cat.disponible && setActiva(cat.clave)}
                        className={`relative -mb-px pb-3 pt-1 text-sm md:text-base font-semibold transition-colors ${
                            activo ? 'text-accentBase' : 'text-gray-500 hover:text-gray-700'
                        } disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:text-gray-300`}
                    >
                        {cat.nombre}
                        {activo && (
                            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accentBase" />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
