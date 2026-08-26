import type { CityPassLandingConfigurada } from '../../../types/CityPass';
import { sanitizeRichText } from '../../../utils/sanitizeHtml';

interface Props {
    hero: CityPassLandingConfigurada['hero'];
}

// Banner con imagen de fondo, título y descripción alineados a la derecha.
export const CityPassHero = ({ hero }: Props) => (
    <section className="relative mt-6 overflow-hidden rounded-3xl bg-emphasis">
        {hero.imagen && (
            <img
                src={hero.imagen}
                alt={hero.titulo}
                className="absolute inset-0 h-full w-full object-cover"
            />
        )}
        <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/30 to-transparent" />
        <div className="relative flex min-h-[220px] items-end justify-end p-6 md:min-h-[320px] md:p-10">
            <div className="max-w-md text-right text-white">
                <h1 className="text-2xl font-bold leading-tight drop-shadow md:text-4xl">
                    {hero.titulo}
                </h1>
                {hero.descripcion && (
                    // La descripción viene con HTML desde la configuración: se respeta el markup.
                    <div
                        className="citypass-rich-text mt-3 text-sm text-white/90 drop-shadow md:text-base"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(hero.descripcion) }}
                    />
                )}
            </div>
        </div>
    </section>
);
