import { ReactNode } from 'react';
import { mapsUrl } from '../utils/mapsHelpers';

interface Props {
    // Texto que se manda a Google Maps (recinto, direccion y ciudad si se tienen).
    consulta?: string | null;
    // Texto visible; si no se pasa se muestra la consulta.
    children?: ReactNode;
    className?: string;
}

// Direccion clickeable que abre Google Maps en otra pestaña.
// Sin consulta renderiza el texto plano, sin enlace.
export const DireccionMapsLink = ({ consulta, children, className = '' }: Props) => {
    const contenido = children ?? consulta;

    if (!consulta?.trim()) return <>{contenido}</>;

    return (
        <a
            href={mapsUrl(consulta)}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver en Google Maps"
            onClick={(e) => e.stopPropagation()}
            className={`hover:text-accentBase hover:underline transition-colors ${className}`}
        >
            {contenido}
        </a>
    );
};
