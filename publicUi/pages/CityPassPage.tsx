import { useEffect, useState } from 'react';
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MdLocationOn } from 'react-icons/md';
import Loader from '../components/Loader';
import { CityPassTabs } from '../components/citypass/CityPassTabs';
import { CityPassHero } from '../components/citypass/CityPassHero';
import { PaquetesCityPass } from '../components/citypass/PaquetesCityPass';
import { ComparativaTable } from '../components/citypass/ComparativaTable';
import { GaleriaCityPass } from '../components/citypass/GaleriaCityPass';
import { useCityPassStore } from '../../hooks/useCityPassStore';
import { useCiudadesStore } from '../../hooks/useCiudadesStore';
import { slugify, deslugify } from '../../utils/slugify';
import type { CityPassLanding } from '../../types/CityPass';

const CityPassPage = () => {
    const { slug } = useParams<{ slug: string }>();
    const router = useRouter();
    const { getLanding } = useCityPassStore();
    const { getAllCiudades } = useCiudadesStore();

    const [loading, setLoading] = useState(true);
    const [landing, setLanding] = useState<CityPassLanding | null>(null);

    useEffect(() => {
        let activo = true;
        (async () => {
            setLoading(true);
            setLanding(null);
            try {
                // El API pide ciudadId; la ruta viene por slug: lo resolvemos contra
                // la lista de ciudades.
                const ciudades = await getAllCiudades();
                const ciudadId = ciudades.find((c) => slugify(c.nombre) === slug)?.id;
                if (!ciudadId) return;
                const data = await getLanding(ciudadId);
                if (activo) setLanding(data);
            } catch (error) {
                console.error('Error cargando CityPass:', error);
            } finally {
                if (activo) setLoading(false);
            }
        })();
        return () => { activo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    const nombreCiudad = landing?.ciudad?.nombre ?? deslugify(slug);

    if (loading) return <Loader />;

    // Ciudad inexistente (404/sin match) o CityPass sin configurar → estado vacío.
    if (!landing || landing.configurada === false) {
        const mensaje =
            landing && landing.configurada === false
                ? landing.mensaje
                : `Estamos preparando el CityPass de ${nombreCiudad}. Muy pronto podrás verlo aquí.`;
        return (
            <div className="min-h-[60vh] bg-gray-50 flex items-center justify-center px-4">
                <div className="max-w-md text-center">
                    <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accentBase text-neutral">
                        <MdLocationOn className="text-3xl" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-gray-900">CityPass {nombreCiudad}</h1>
                    <p className="mb-6 text-gray-500">{mensaje}</p>
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

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-6 md:px-5 md:py-8 lg:px-8 2xl:px-20">
                <CityPassTabs categorias={landing.categorias} />
                <CityPassHero hero={landing.hero} />
                <PaquetesCityPass
                    paquetes={landing.paquetes}
                    onComprar={(paquete) =>
                        router.push(
                            `/citypass/${slugify(landing.ciudad.nombre)}/paquete/${slugify(paquete.nombre)}`,
                        )
                    }
                />
                <ComparativaTable comparativa={landing.comparativa} />
                <GaleriaCityPass galeria={landing.galeria} ciudad={landing.ciudad.nombre} />
            </div>
        </div>
    );
};

export default CityPassPage;
