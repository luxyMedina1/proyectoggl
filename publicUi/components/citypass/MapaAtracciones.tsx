import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CityPassPuntoMapa } from '../../../types/CityPass';

interface Props {
    puntos: CityPassPuntoMapa[];
}

// Pin de marca (color acento vía variable CSS, se adapta al white-label).
const pinIcon = L.divIcon({
    className: '',
    html: `
        <svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.37 18.63 0 12 0z" style="fill: var(--color-accent-base)"/>
            <circle cx="12" cy="12" r="4.5" fill="#ffffff"/>
        </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -38],
});

// Ajusta el mapa para que quepan todos los puntos.
const AjustarLimites = ({ puntos }: Props) => {
    const map = useMap();
    useEffect(() => {
        if (!puntos.length) return;
        const bounds = L.latLngBounds(puntos.map((p) => [p.latitud, p.longitud] as [number, number]));
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    }, [puntos, map]);
    return null;
};

export const MapaAtracciones = ({ puntos }: Props) => {
    if (!puntos?.length) return null;

    const centro: [number, number] = [puntos[0].latitud, puntos[0].longitud];

    return (
        <section className="mt-16 mb-8">
            <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 md:text-3xl">
                Explora las ubicaciones de las atracciones
            </h2>
            <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-gray-200">
                <MapContainer
                    center={centro}
                    zoom={13}
                    scrollWheelZoom={false}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {puntos.map((punto) => (
                        <Marker key={punto.atraccionId} position={[punto.latitud, punto.longitud]} icon={pinIcon}>
                            <Popup>
                                <div className="min-w-[160px]">
                                    {punto.imagenPrincipal && (
                                        <img
                                            src={punto.imagenPrincipal}
                                            alt={punto.nombre}
                                            className="mb-2 h-20 w-full rounded-md object-cover"
                                        />
                                    )}
                                    <strong className="block text-gray-900">{punto.nombre}</strong>
                                    {punto.direccion && (
                                        <span className="text-xs text-gray-500">{punto.direccion}</span>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                    <AjustarLimites puntos={puntos} />
                </MapContainer>
            </div>
        </section>
    );
};
