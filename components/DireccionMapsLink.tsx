import { ReactNode } from 'react';
import { mapsUrl, coordenadasMapsUrl } from '../utils/mapsHelpers';

interface Props {
    // Texto que se manda a Google Maps (recinto, direccion y ciudad si se tienen).
    consulta?: string | null;
    // Coordenadas del recinto. Si vienen ambas se usan en lugar de la direccion.
    latitud?: number | string | null;
    longitud?: number | string | null;
    // Nombre del recinto para etiquetar el pin cuando se abre por coordenadas.
    etiqueta?: string | null;
    // Texto visible; si no se pasa se muestra la consulta.
    children?: ReactNode;
    className?: string;
}

// Direccion clickeable que abre Google Maps en otra pestaña.
// Si el recinto trae latitud y longitud abre por coordenadas (etiquetando el pin
// con el nombre del recinto); si no, usa la direccion.
// Sin ninguno de los dos renderiza el texto plano, sin enlace.
export const DireccionMapsLink = ({ consulta, latitud, longitud, etiqueta, children, className = '' }: Props) => {
    const contenido = children ?? consulta;

    // Priorizar coordenadas cuando el recinto las trae; si no, caer a la direccion.
    const href = coordenadasMapsUrl(latitud, longitud, etiqueta) ?? (consulta?.trim() ? mapsUrl(consulta) : null);

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
