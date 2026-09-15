'use client';

import dynamic from 'next/dynamic';
import type { CityPassPuntoMapa } from '../../../types/CityPass';

// `ssr: false` solo se permite dentro de un Client Component: leaflet toca `window`
// al importarse, así que el primer render en el servidor truena sin este boundary.
const MapaAtracciones = dynamic(
    () => import('./MapaAtracciones').then((m) => m.MapaAtracciones),
    { ssr: false },
);

export const MapaAtraccionesIsla = ({ puntos }: { puntos: CityPassPuntoMapa[] }) => (
    <MapaAtracciones puntos={puntos} />
);
