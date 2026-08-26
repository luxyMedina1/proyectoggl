import Loader from '@/publicUi/components/Loader';
// import ConferenciaHero from "./components/ConferenciaHero";
import NavBar from "./components/NavBar";
import ContactoCard from "./components/ContactoCard";
import ConferenciaFooter from "./components/ConferenciaFooter";
import { useConferencia } from "./hooks/useConferenciaSpeakers";
import ErrorPage from "./ErrorPage";
import { useMemo } from "react";

function SpeakersConferencia() {
    const { conferencia, error, loading } = useConferencia();

    const speakers = useMemo(() => {
        return conferencia?.programa
            ?.flatMap(dia => dia?.sesiones?.flatMap(sesion => sesion?.expositores || []))
            ?.filter((speaker, index, self) =>
                index ===
                self.findIndex(
                    (s) =>
                        s.nombre?.trim().toLowerCase() === speaker.nombre?.trim().toLowerCase()
                )
            )
            ?.sort((a, b) => {
                if (a.orden == 0 && b.orden == 0) return 0; // ambos sin orden
                if (a.orden == 0) return 1; // a va después
                if (b.orden == 0) return -1; // b va después
                return a.orden - b.orden; // ambos tienen orden, orden normal
            }) || [];
    }, [conferencia]);
    // console.log("🚀 ~ SpeakersConferencia ~ speakers:", speakers)


    if (loading) return <Loader />;
    if (error) return <ErrorPage />;
    if (!conferencia) return null;

    return (
        <>
            {/* Hero conferencia */}
            {/* <ConferenciaHero conferencia={conferencia} /> */}
            <NavBar />
            {/* Speakers */}
            <section className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 mt-20">
                <div className="flex my-6">
                    <p className="bg-blue-50 rounded-full inline-flex items-center text-center justify-center px-2 py-1 text-blue-600 mx-auto">{conferencia.nombre}</p>
                </div>
                <p className="text-gray-700 text-lg text-center mb-10">Conoce a nuestros speakers.</p>
                <div className="grid grid-cols-8 gap-y-6">
                    <figure className="col-span-8 md:col-span-3">
                        <img className="transform mx-auto my-auto max-w-[70px] rotate-90 md:rotate-0 md:translate-y-0 md:my-0 md:mx-auto md:max-w-full max-h-[900px]" src="/Speakers.webp" alt="speakers image" />
                    </figure>
                    <div className="col-span-8 md:col-span-5 grid gap-y-8">
                        {speakers.map(speaker => (
                            <div key={speaker.id} className="flex flex-col md:flex-row gap-y-6 items-start gap-x-10">
                                <figure className="blue-box-speaker max-w-[150px] max-h-[240px]">
                                    <img className="w-full h-full" src={speaker.foto || '/user_default.png'} alt="speaker image" />
                                </figure>
                                <p className="text-gray-800 font-bold text-2xl">
                                    {speaker.nombre}
                                    <span className="block font-light text-gray-500 text-xl">{speaker.puesto}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Contactos */}
            <section className="py-10 bg-gray-100">
                <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
                <h2 className="text-center text-2xl lg:text-3xl xl:text-4xl font-semibold text-gray-900 mb-8 border-b-4 pb-2 border-blue-700 w-fit mx-auto">Contacto</h2>
                {conferencia.contactos && conferencia.contactos.length > 0 ? (
                    <div className="flex flex-wrap gap-4 md:items-center justify-center">
                        {conferencia.contactos.map((contacto: any) => (
                            <ContactoCard key={contacto.id} contacto={contacto} /> 
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-md text-gray-500 mt-2">
                            Pronto agregaremos más información.
                        </p>
                    </div>
                )}
                </div>
            </section>

            {/* Footer */}
            <ConferenciaFooter conferencia={conferencia} />
        </>
    );
}

export default SpeakersConferencia;