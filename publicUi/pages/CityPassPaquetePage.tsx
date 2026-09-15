import Link from "next/link";
import { LuCalendarClock } from 'react-icons/lu';
import { HiOutlineTicket } from 'react-icons/hi2';
import { VolverButton } from '../components/citypass/VolverButton';
import { PanelCompraPaquete } from '../components/citypass/PanelCompraPaquete';
import { AtraccionesPaquete } from '../components/citypass/AtraccionesPaquete';
import { GaleriaPaquete } from '../components/citypass/GaleriaPaquete';
import { MapaAtraccionesIsla } from '../components/citypass/MapaAtraccionesIsla';
import { sanitizeRichText } from '../../utils/sanitizeHtml';
import type { CityPassPaqueteDetalle } from '../../types/CityPass';

interface Props {
    // Ya resuelto por el Server Component de la ruta
    // (`app/(site)/citypass/[slug]/paquete/[paqueteSlug]/page.tsx`) con el mismo
    // fetch cacheado que usa `generateMetadata` — sin volver a pedirlo aquí.
    paquete: CityPassPaqueteDetalle | null;
}

// Server Component: pinta el detalle con el paquete ya resuelto por la ruta. Las
// únicas partes interactivas (botón volver, panel de boletos, modales de galería,
// mapa con leaflet) son islas de cliente pequeñas (ver sus propios archivos), no
// toda la página.
const CityPassPaquetePage = ({ paquete }: Props) => {
    if (!paquete) {
        return (
            <div className="min-h-[60vh] bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md text-center">
                    <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accentBase text-neutral">
                        <HiOutlineTicket className="text-3xl" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-gray-900">Paquete no encontrado</h1>
                    <p className="mb-6 text-gray-500">Este paquete no está disponible.</p>
                    <Link
                        href="/eventos"
                        className="inline-block rounded-lg bg-accentBase px-4 py-2 text-neutral transition-colors hover:bg-accentLight"
                    >
                        Volver a eventos
                    </Link>
                </div>
            </div>
        );
    }

    const validezTexto = `Válido por ${paquete.validezDias} ${paquete.validezDias === 1 ? 'día' : 'días'} desde el primer uso`;
    const admisionTexto = `Acceso a ${paquete.atraccionesCount} ${paquete.atraccionesCount === 1 ? 'atracción' : 'atracciones'}`;
    const tituloAtracciones = `Entrada a ${paquete.atraccionesCount} ${paquete.atraccionesCount === 1 ? 'atracción' : 'atracciones'}`;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-6 md:px-5 md:py-8 lg:px-8 2xl:px-20">
                {/* Encabezado */}
                <div className="mb-6 flex items-center gap-4">
                    <VolverButton />
                    <h1 className="text-2xl font-bold uppercase text-gray-800 md:text-4xl">
                        Compra de {paquete.nombre}
                    </h1>
                </div>

                {/* Contenido + panel de boletos (sticky) */}
                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Intro */}
                    <div className="lg:col-span-2 lg:col-start-1 lg:row-start-1">
                        {paquete.imagenPrincipal && (
                            <img
                                src={paquete.imagenPrincipal}
                                alt={paquete.nombre}
                                className="mb-6 aspect-[16/9] w-full rounded-2xl object-cover"
                            />
                        )}
                        <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
                            Las mejores atracciones. Ahorro inteligente. Una compra sencilla.
                        </h2>
                        {paquete.descripcion && (
                            // La descripción puede venir con HTML desde la configuración (incluidos enlaces).
                            <div
                                className="citypass-rich-text mt-4 text-gray-500"
                                dangerouslySetInnerHTML={{ __html: sanitizeRichText(paquete.descripcion) }}
                            />
                        )}

                        {/* Chips */}
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4">
                                <LuCalendarClock className="flex-none text-2xl text-accentBase" />
                                <div>
                                    <p className="font-bold text-gray-900">Validez</p>
                                    <p className="text-sm text-gray-500">{validezTexto}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4">
                                <HiOutlineTicket className="flex-none text-2xl text-accentBase" />
                                <div>
                                    <p className="font-bold text-gray-900">Admisión</p>
                                    <p className="text-sm text-gray-500">{admisionTexto}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel de boletos */}
                    <div className="lg:col-start-3 lg:row-start-1 lg:row-span-2">
                        <PanelCompraPaquete
                            paqueteId={paquete.id}
                            precios={paquete.precios}
                            textoComplementario={paquete.textoComplementario}
                            disponibleVenta={paquete.disponibleVenta}
                        />
                    </div>

                    {/* Atracciones */}
                    {paquete.atracciones.length > 0 && (
                        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2">
                            <div className="border-t border-gray-200 pt-8">
                                <h2 className="mb-6 text-center text-2xl font-bold text-gray-900 md:text-3xl">
                                    {tituloAtracciones}
                                </h2>
                                <AtraccionesPaquete atracciones={paquete.atracciones} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Galería del paquete */}
                <GaleriaPaquete galeria={paquete.galeria} />

                {/* Mapa */}
                <MapaAtraccionesIsla puntos={paquete.mapa?.puntos ?? []} />
            </div>
        </div>
    );
};

export default CityPassPaquetePage;
