import Loader from '@/publicUi/components/Loader';
// import ConferenciaHero from "./components/ConferenciaHero";
import NavBar from "./components/NavBar";
import ConferenciaFooter from "./components/ConferenciaFooter";
import { useConferencia } from "./hooks/useConferenciaHoteles";
import ErrorPage from "./ErrorPage";
import HotelCard from "./components/HotelCard";


function HotelesConferencia() {
    const { conferencia, error, loading } = useConferencia();
    console.log("🚀 ~ HotelesConferencia ~ conferencia:", conferencia)


    if (loading) return <Loader />;
    if (error) return <ErrorPage />;
    if (!conferencia) return null;

    return (
        <>
            {/* Hero conferencia */}
            {/* <ConferenciaHero conferencia={conferencia} /> */}
            <NavBar />
            {/* Hoteles */}
            <section className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 mt-20 mb-10">
                <div className="flex my-8">
                    <p className="bg-blue-50 rounded-full inline-flex items-center text-center justify-center px-2 py-1 text-blue-600 mx-auto">Hoteles</p>
                </div>
                <div className="grid gap-y-5 divide-y divide-gray-500">
                    {((conferencia as any).hoteles ?? []).map((hotel: any, idx: number) => (
                        <HotelCard key={idx} hotel={hotel} />
                    ))}
                </div>
            </section>

            {/* Footer */}
            <ConferenciaFooter conferencia={conferencia} />
        </>
    );
}

export default HotelesConferencia;