import { useState } from 'react';
import { useRouter } from "next/navigation";
import { IoSearch } from 'react-icons/io5';
import { MdLocationOn } from 'react-icons/md';
import type { Ciudad } from '../../types/Ciudad';

interface Props {
    className?: string;
    ciudades: Ciudad[];
    ciudadId: string;
    onCiudadChange: (id: string) => void;
    onCityPass: () => void;
    cityPassDisponible: boolean;
}

// Buscador del header: input de artista + select de ciudad + botón que lleva al CityPass.
// Controlado: la ciudad seleccionada vive en HeaderLayout (compartida con el link de nav).
export const HeaderBuscador = ({
    className = '',
    ciudades,
    ciudadId,
    onCiudadChange,
    onCityPass,
    cityPassDisponible,
}: Props) => {
    const router = useRouter();
    const [texto, setTexto] = useState('');

    // El input filtra eventos en el home vía ?buscar=.
    const buscarEventos = (e: React.FormEvent) => {
        e.preventDefault();
        const q = texto.trim();
        router.push(q ? `/eventos?buscar=${encodeURIComponent(q)}` : '/eventos');
    };

    return (
        <form
            onSubmit={buscarEventos}
            className={`flex items-center h-11 bg-white rounded-full shadow-sm pr-1 ${className}`}
        >
            {/* Input de búsqueda de artista */}
            <div className="flex items-center gap-x-2 pl-4 pr-2 flex-1 min-w-0">
                <IoSearch className="flex-none text-lg text-gray-400" />
                <input
                    type="text"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Buscar artista"
                    aria-label="Buscar artista"
                    className="w-full min-w-0 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
                />
            </div>

            {/* Divisor */}
            <span className="flex-none h-6 w-px bg-gray-200" aria-hidden="true" />

            {/* Select de ciudad */}
            <div className="flex items-center gap-x-1.5 px-3 flex-none">
                <MdLocationOn className="flex-none text-lg text-gray-400" />
                <select
                    value={ciudadId}
                    onChange={(e) => onCiudadChange(e.target.value)}
                    aria-label="Selecciona una ciudad"
                    className="max-w-[8rem] bg-transparent text-sm text-gray-700 outline-none cursor-pointer"
                >
                    <option value="">Ciudad</option>
                    {ciudades.map((ciudad) => (
                        <option key={ciudad.id} value={ciudad.id}>
                            {ciudad.nombre}
                        </option>
                    ))}
                </select>
            </div>

            {/* Botón CityPass */}
            <button
                type="button"
                onClick={onCityPass}
                disabled={!cityPassDisponible}
                aria-label="Ir al CityPass"
                title="Ir al CityPass"
                className="flex-none grid place-items-center h-9 w-9 rounded-full bg-accentBase text-white transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <IoSearch className="text-lg" />
            </button>
        </form>
    );
};
