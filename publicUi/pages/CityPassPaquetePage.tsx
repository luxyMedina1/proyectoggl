import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IoArrowBack } from 'react-icons/io5';
import { LuCalendarClock } from 'react-icons/lu';
import { HiOutlineTicket } from 'react-icons/hi2';
import { BsInstagram } from 'react-icons/bs';
import Swal from 'sweetalert2';
import Loader from '../components/Loader';
import { GaleriaModal } from '../components/GaleriaModal';
import { PaqueteBoletos, type ResumenCompra } from '../components/citypass/PaqueteBoletos';
// leaflet toca `window` al importarse: sin ssr:false, el primer render en el servidor truena.
const MapaAtracciones = dynamic(
    () => import('../components/citypass/MapaAtracciones').then((m) => m.MapaAtracciones),
    { ssr: false },
);
import { useCityPassStore } from '../../hooks/useCityPassStore';
import { useCiudadesStore } from '../../hooks/useCiudadesStore';
import { useAuthStore } from '../../hooks/useAuthStore';
import { useAuthModal } from '../../context/AuthModalContext';
import { slugify } from '../../utils/slugify';
import { sanitizeRichText } from '../../utils/sanitizeHtml';
import type { CityPassPaqueteDetalle } from '../../types/CityPass';

const CityPassPaquetePage = () => {
    const { slug: ciudadSlug, paqueteSlug } = useParams<{ slug: string; paqueteSlug: string }>();
    const router = useRouter();
    const { getPaquete, getLanding } = useCityPassStore();
    const { getAllCiudades } = useCiudadesStore();
    const { status, isVerified } = useAuthStore();
    const { requestLogin } = useAuthModal();

    const [loading, setLoading] = useState(true);
    const [paquete, setPaquete] = useState<CityPassPaqueteDetalle | null>(null);
    const [modal, setModal] = useState<{ imagenes: string[]; titulo: string; indice: number } | null>(null);

    useEffect(() => {
        let activo = true;
        (async () => {
            setLoading(true);
            setPaquete(null);
            try {
                // El API pide id numérico; la ruta viene por slug: resolvemos slug de
                // ciudad + paquete contra el landing.
                let paqueteId: number | undefined;
                const ciudades = await getAllCiudades();
                const ciudadId = ciudades.find((c) => slugify(c.nombre) === ciudadSlug)?.id;
                if (ciudadId) {
                    const landing = await getLanding(ciudadId);
                    if (landing && landing.configurada) {
                        paqueteId = landing.paquetes.find(
                            (p) => slugify(p.nombre) === paqueteSlug,
                        )?.id;
                    }
                }
                if (!paqueteId) return;
                const data = await getPaquete(paqueteId);
                if (activo) setPaquete(data);
            } catch (error) {
                console.error('Error cargando paquete:', error);
            } finally {
                if (activo) setLoading(false);
            }
        })();
        return () => { activo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ciudadSlug, paqueteSlug]);

    const galeriaUrls = useMemo(
        () => (paquete?.galeria ?? []).map((g) => g.url),
        [paquete],
    );

    if (loading) return <Loader />;

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

    const abrirGaleria = (imagenes: string[], titulo: string, indice = 0) => {
        if (!imagenes.length) return;
        setModal({ imagenes, titulo, indice });
    };

    // Ir al checkout con los boletos seleccionados. Si no hay sesión, abre el modal de login
    // (sin navegar a otra página) y continúa al comprar tras iniciar sesión.
    const comprar = async (resumen: ResumenCompra) => {
        if (!resumen.items.length) return;
        if (status !== 'authenticated') {
            const ok = await requestLogin();
            if (!ok) return;
        } else if (!isVerified) {
            Swal.fire({
                icon: 'info',
                title: 'Verifica tu cuenta',
                text: 'Debes verificar tu cuenta para completar la compra.',
            });
            return;
        }
        try {
            sessionStorage.setItem('citypass:checkout', JSON.stringify(resumen.items));
        } catch { /* almacenamiento no disponible: el checkout redirige si no hay items */ }
        router.push(`/citypass/checkout/${paquete.id}`);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-6 md:px-5 md:py-8 lg:px-8 2xl:px-20">
                {/* Encabezado */}
                <div className="mb-6 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="Volver"
                        className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-gray-100 text-gray-700 transition hover:bg-gray-200"
                    >
                        <IoArrowBack className="text-xl" />
                    </button>
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
                        <PaqueteBoletos
                            precios={paquete.precios}
                            textoComplementario={paquete.textoComplementario}
                            disponibleVenta={paquete.disponibleVenta}
                            onComprar={comprar}
                        />
                    </div>

                    {/* Atracciones */}
                    {paquete.atracciones.length > 0 && (
                        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2">
                            <div className="border-t border-gray-200 pt-8">
                                <h2 className="mb-6 text-center text-2xl font-bold text-gray-900 md:text-3xl">
                                    {tituloAtracciones}
                                </h2>
                                <div className="flex flex-col gap-4">
                                    {paquete.atracciones.map((atraccion) => {
                                        // Galería propia de la atracción; si no tiene, usa su imagen principal.
                                        const imagenesAtraccion = atraccion.galeria.length
                                            ? atraccion.galeria.map((g) => g.url)
                                            : atraccion.imagenPrincipal
                                              ? [atraccion.imagenPrincipal]
                                              : [];
                                        const clickable = imagenesAtraccion.length > 0;
                                        const verGaleria = () =>
                                            abrirGaleria(imagenesAtraccion, `Galería de ${atraccion.nombre}`);
                                        return (
                                            <article
                                                key={atraccion.id}
                                                onClick={clickable ? verGaleria : undefined}
                                                onKeyDown={
                                                    clickable
                                                        ? (e) => {
                                                              if (e.key === 'Enter' || e.key === ' ') {
                                                                  e.preventDefault();
                                                                  verGaleria();
                                                              }
                                                          }
                                                        : undefined
                                                }
                                                role={clickable ? 'button' : undefined}
                                                tabIndex={clickable ? 0 : undefined}
                                                title={clickable ? `Ver galería de ${atraccion.nombre}` : undefined}
                                                className={`flex items-center gap-4 rounded-2xl border border-gray-200 p-4 ${
                                                    clickable
                                                        ? 'cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accentBase'
                                                        : ''
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-gray-900">{atraccion.nombre}</h3>
                                                    {atraccion.descripcion && (
                                                        // La descripción viene con HTML: se respeta el markup y se limita a 3 líneas.
                                                        <div
                                                            className="citypass-rich-text mt-1 text-sm text-gray-500 line-clamp-3"
                                                            dangerouslySetInnerHTML={{
                                                                __html: sanitizeRichText(atraccion.descripcion),
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                                {atraccion.imagenPrincipal && (
                                                    <img
                                                        src={atraccion.imagenPrincipal}
                                                        alt={atraccion.nombre}
                                                        className="h-24 w-32 flex-none rounded-xl object-cover"
                                                    />
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Galería del paquete */}
                {galeriaUrls.length > 0 && (
                    <section className="mt-16">
                        <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 md:text-3xl">
                            Galería del paquete
                        </h2>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {paquete.galeria.map((img, i) => (
                                <button
                                    type="button"
                                    key={`${img.url}-${i}`}
                                    onClick={() => abrirGaleria(galeriaUrls, 'Galería del paquete', i)}
                                    aria-label={`Ver foto ${i + 1} en grande`}
                                    className="group relative aspect-[3/4] overflow-hidden rounded-2xl"
                                >
                                    <img
                                        src={img.url}
                                        alt={img.atraccionNombre || `Foto ${i + 1}`}
                                        loading="lazy"
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                    <span className="absolute right-3 top-3 text-white drop-shadow-lg">
                                        <BsInstagram className="text-xl" />
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Mapa */}
                <MapaAtracciones puntos={paquete.mapa?.puntos ?? []} />
            </div>

            <GaleriaModal
                imagenes={modal?.imagenes ?? []}
                abierto={modal !== null}
                indiceInicial={modal?.indice ?? 0}
                titulo={modal?.titulo}
                onClose={() => setModal(null)}
            />
        </div>
    );
};

export default CityPassPaquetePage;
