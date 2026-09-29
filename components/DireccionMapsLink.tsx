import { ReactNode } from 'react';
import { mapsUrl, coordenadasMapsUrl } from '../utils/mapsHelpers';

interface Props {
    // Link de Google Maps que manda el back para el recinto. Si viene, gana.
    url?: string | null;
    // Texto que se manda a Google Maps (recinto, direccion y ciudad si se tienen).
    consulta?: string | null;
    // Coordenadas del recinto. Solo se usan si no hay url ni consulta.
    latitud?: number | string | null;
    longitud?: number | string | null;
    // Texto visible; si no se pasa se muestra la consulta.
    children?: ReactNode;
    className?: string;
}

// Direccion clickeable que abre Google Maps en otra pestaña.
// Prioridad: url del back → busqueda por texto → coordenadas.
// Sin ninguno de los tres renderiza el texto plano, sin enlace.
export const DireccionMapsLink = ({ url, consulta, latitud, longitud, children, className = '' }: Props) => {
    const contenido = children ?? consulta;

    const href =
        url?.trim() ||
        (consulta?.trim() ? mapsUrl(consulta) : null) ||
        coordenadasMapsUrl(latitud, longitud);

    if (!href) return <>{contenido}</>;

    return (
        <a
            href={href}
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
