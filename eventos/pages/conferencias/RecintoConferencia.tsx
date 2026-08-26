import Loader from '@/publicUi/components/Loader';
// import ConferenciaHero from "./components/ConferenciaHero";
import NavBar from "./components/NavBar";
import ContactoCard from "./components/ContactoCard";
import ConferenciaFooter from "./components/ConferenciaFooter";
import { useConferencia } from "./hooks/useConferenciaRecinto";
import ErrorPage from "./ErrorPage";
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { FaPlus, FaMinus, FaArrowRightLong } from "react-icons/fa6";
import { VscDebugRestart } from "react-icons/vsc";

const ZoomControls: React.FC = () => {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="absolute lg:top-[35px] lg:left-[2px] z-10 flex flex-row-reverse justify-center gap-2 mt-4 p-2 bg-white rounded-lg shadow-lg">
      <button onClick={() => zoomIn(0.3)} className="w-8 h-8 grid place-items-center text-xl font-bold text-white bg-emphasis rounded" aria-label="Aumentar zoom">
        <FaPlus className="flex-none" />
      </button>
      <button onClick={() => zoomOut(0.3)} className="w-8 h-8 grid place-items-center text-xl font-bold text-white bg-red-600 rounded hover:bg-red-700 transition duration-150"  aria-label="Disminuir zoom">
        <FaMinus className="flex-none" />
      </button>
      <button onClick={() => resetTransform()} className="w-8 h-8 grid place-items-center text-sm text-gray-800 bg-gray-200 rounded hover:bg-gray-300 transition duration-150" aria-label="Restablecer vista">
        <VscDebugRestart className="flex-none" size={26} />
      </button>
    </div>
  );
};

function RecintoConferencia() {
    const { conferencia, error, loading } = useConferencia();

    if (loading) return <Loader />;
    if (error) return <ErrorPage />;
    if (!conferencia) return null;

    return (
        <>
            {/* Hero conferencia */}
            {/* <ConferenciaHero conferencia={conferencia} /> */}
            <NavBar />

            <section className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 py-10 mt-20 mb-10">
                <div className="flex my-8">
                    <p className="bg-blue-50 rounded-full inline-flex items-center text-center justify-center px-2 py-1 text-blue-600 mx-auto">Recinto</p>
                </div>
                <figure className="relative">
                    <a className="absolute top-28 sm:top-20 lg:top-[53px] z-10 right-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white flex items-center gap-x-2  mx-auto text-base px-3 py-2 rounded-lg" href="https://maps.app.goo.gl/ZKWMmik495WsoHZU7" target="_blank">
                        Ir a la ubicación <FaArrowRightLong className="flex-none" />
                    </a>
                    <figcaption className="text-gray-800 text-center text-2xl font-medium mt-5">
                        En esta sección podrás conocer la ubicación del recinto del evento.
                    </figcaption>
                    <TransformWrapper
                        initialScale={1}
                        minScale={0.5}
                        maxScale={4}
                        limitToBounds={true}
                        wheel={{ disabled: true }}
                    >
                            <ZoomControls /> 
                        
                            <TransformComponent
                                wrapperStyle={{ 
                                    width: '100%', 
                                    height: 'auto', 
                                    minHeight: '350px',
                                    border: '2px solid #e2e2e2',
                                    marginTop: '1rem',
                                    position: 'relative',
                                    borderRadius: '8px',
                                    cursor: 'move'
                                }}
                                contentStyle={{ }}
                            >
                            <img src={conferencia.imagenMapa || '/default_image.png'} alt="mapa del recinto de la conferencia" />
                        </TransformComponent>
                    </TransformWrapper>
                </figure>
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

export default RecintoConferencia;