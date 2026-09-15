import Link from "next/link";
import { MdLocationOn } from 'react-icons/md';
import { CityPassTabs } from '../components/citypass/CityPassTabs';
import { CityPassHero } from '../components/citypass/CityPassHero';
import { PaquetesCityPass } from '../components/citypass/PaquetesCityPass';
import { ComparativaTable } from '../components/citypass/ComparativaTable';
import { GaleriaCityPass } from '../components/citypass/GaleriaCityPass';
import { deslugify } from '../../utils/slugify';
import type { CityPassLanding } from '../../types/CityPass';

interface Props {
    // Ya resuelto por el Server Component de la ruta (`app/(site)/citypass/[slug]/page.tsx`)
    // con el mismo fetch cacheado que usa `generateMetadata` — sin volver a pedirlo aquí.
    landing: CityPassLanding | null;
    slug: string;
}

// Server Component: pinta la landing con los datos ya resueltos por la ruta. Las
// únicas partes interactivas (tabs, galería, botón de comprar) son islas de
// cliente pequeñas (ver sus propios archivos), no toda la página.
const CityPassPage = ({ landing, slug }: Props) => {
    const nombreCiudad = landing?.ciudad?.nombre ?? deslugify(slug);

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
                <PaquetesCityPass paquetes={landing.paquetes} ciudadSlug={slug} />
                <ComparativaTable comparativa={landing.comparativa} />
                <GaleriaCityPass galeria={landing.galeria} ciudad={landing.ciudad.nombre} />
            </div>
        </div>
    );
};

export default CityPassPage;
