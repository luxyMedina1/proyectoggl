interface Props {
    /** Nombre del usuario, para la inicial y el color de fondo cuando no hay imagen. */
    nombre: string;
    /** URL de la imagen. Si falta, se pinta el fondo de color con la inicial. */
    image?: string | null;
    /** Tamaño en px (ancho y alto). */
    size?: number;
    /** Clases extra para el contenedor (bordes, sombras, etc.). */
    className?: string;
}

const PALETTE = [
    'bg-purple-500',
    'bg-emerald-500',
    'bg-sky-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-fuchsia-500',
];

// Color estable a partir del nombre (mismo nombre → mismo color).
const hashIndex = (text: string): number => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % PALETTE.length;
};

const iniciales = (nombre: string): string => {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0]!.charAt(0).toUpperCase();
    return (partes[0]!.charAt(0) + partes[1]!.charAt(0)).toUpperCase();
};

/**
 * Avatar de usuario reutilizable: muestra la imagen si existe; si no, un fondo de
 * color (derivado del nombre) con la(s) inicial(es).
 */
const UserAvatar = ({ nombre, image, size = 48, className = '' }: Props) => {
    if (image) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={image}
                alt={nombre}
                style={{ width: size, height: size }}
                className={`rounded-full object-cover flex-shrink-0 ${className}`}
            />
        );
    }
    const colorClass = PALETTE[hashIndex(nombre || '?')];
    return (
        <div
            style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.4)) }}
            className={`${colorClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
        >
            {iniciales(nombre)}
        </div>
    );
};

export default UserAvatar;
