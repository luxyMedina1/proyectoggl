// import { RiArrowRightUpLine } from "react-icons/ri";
import Loader from '@/publicUi/components/Loader';
import ConferenciaHero from "./components/ConferenciaHero";
// import ContactoCard from "./components/ContactoCard";
import ConferenciaFooter from "./components/ConferenciaFooter";
import PatrocinadorCard from "./components/PatrocinadorCard";
// import ConferenciaGallery from "./components/ConferenciaGallery";
import ConferenciaAbout from "./components/ConferenciaAbout";
import SolucionesCard from "./components/SolucionesCard";
import { useConferencia } from "./hooks/useConferencia";
import ErrorPage from "./ErrorPage";
import { FaGear, FaCloud, FaLaptopCode, FaShieldHalved, FaDatabase, FaChartSimple, FaServer } from 'react-icons/fa6';
import { FaCogs } from 'react-icons/fa';
import { HiOutlineSquaresPlus } from "react-icons/hi2";
import { useLocation } from '@/utils/nextRouterCompat';
import { useEffect } from "react";

interface Solucion {
  id: number;
  nombre: string;
  Icono: React.ElementType; 
  iconoSrc: string; 
}

function DetalleConferencia() {

  const location = useLocation();
  const { conferencia, error, loading } = useConferencia();

  useEffect(() => {
    if (location.state?.scrollTo) {
      const section = document.getElementById(location.state.scrollTo);
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location.state]);

  const solucionesData: Solucion[] = [
    { id: 1, nombre: 'Inteligencia Artificial Aplicada', Icono: FaGear, iconoSrc: '/soluciones/solucion1.svg' },
    { id: 2, nombre: 'Conectividad avanzada & 5G', Icono: FaLaptopCode, iconoSrc: '/soluciones/solucion2.svg' },
    { id: 3, nombre: 'Internet de las Cosas (IoT)', Icono: FaCloud, iconoSrc: '/soluciones/solucion3.svg' },
    { id: 4, nombre: 'Smart Cities & Gobierno Digital', Icono: FaShieldHalved, iconoSrc: '/soluciones/solucion4.svg' },
    { id: 5, nombre: 'Ciberseguridad & Data', Icono: FaDatabase, iconoSrc: '/soluciones/solucion5.svg' },
    { id: 6, nombre: 'Infraestructura digital & fibra óptica', Icono: FaCogs, iconoSrc: '/soluciones/solucion6.svg' },
    { id: 7, nombre: 'Automatización, Nube & Software Empresarial', Icono: FaChartSimple, iconoSrc: '/soluciones/solucion7.svg' },
    { id: 8, nombre: 'Video inteligente y seguridad pública', Icono: FaServer, iconoSrc: '/soluciones/solucion8.svg' },
  ];

  if (loading) return <Loader />;
  if (error) return <ErrorPage />;
  if (!conferencia) return null;

  return (
    <div>
      {/* Hero conferencia */}
      <ConferenciaHero conferencia={conferencia} />
      {/* Que somos */}
      <div id="que-somos">
        <ConferenciaAbout beneficios={conferencia.beneficios} />
      </div>
      {/* Soluciones */}
      <section id="soluciones" className="my-10 bg-[radial-gradient(#07184a,#020B25)]">
        <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 py-10">
          <h2 className="text-white text-center font-bold leading-normal text-3xl max-w-xl mx-auto mb-10">En CosmoTech exploramos y presentamos soluciones reales en:</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-16 gap-x-10 p-8 max-w-7xl mx-auto">
            {solucionesData.map((solucion) => ( 
              <SolucionesCard solucion={solucion} />
            ))}
          </div>
        </div>
      </section>
      <section id="vision" className="container mx-auto max-w-7xl px-4 md:px-5 lg:px-8 2xl:px-20 py-10">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="border-2 border-[#102D69] text-[#102D69] bg-white rounded-2xl p-2 md:p-4 space-y-3">
            <h3 className="font-bold text-2xl md:text-3xl">Nuestra escencia</h3>
            <div className="w-14 h-14 rounded-xl bg-[#102D69] grid place-items-center">
              <HiOutlineSquaresPlus className="flex-none text-white size-9" />
            </div>
            <p className="">
              Cosmo Tech no es solo un evento.
              Es un ecosistema, una plataforma de colaboración, un espacio donde nacen alianzas estratégicas, proyectos y oportunidades que impulsan el desarrollo regional y nacional.
              Tecnología con propósito. Innovación que transforma. Visión que conecta el presente con el futuro.
            </p>
          </div>
          <div className="border-2 border-[#102D69] text-white bg-[radial-gradient(at_top_right,#050a5a_10%,#050a5a_20%,#030d2c_80%)] rounded-2xl p-2 md:p-4 space-y-3">
            <h3 className="font-bold text-2xl md:text-3xl">Visión</h3>
            <div className="w-14 h-14 rounded-xl bg-white grid place-items-center">
              <HiOutlineSquaresPlus className="flex-none text-[#102D69] size-9" />
            </div>
            <p className="">
              Convertir a Durango en un hub tecnológico del norte del país, donde la infraestructura, la innovación y el talento se encuentran para construir ciudades más inteligentes, competitivas e inclusivas.
            </p>
          </div>
        </div>
      </section>
      {/* Beneficios */}
      {/* <section className="py-10 container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
        <div className="flex my-6">
          <p className="bg-blue-50 rounded-full inline-flex items-center text-center justify-center px-2 py-1 text-blue-600 mx-auto">{conferencia.nombre}</p>
        </div>
        <p className="text-gray-700 text-lg text-center mb-8">{conferencia.descripcion}</p>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/5">
            <span className="bg-black text-white px-3 min-w-32 justify-center font-light py-1 inline-flex rounded-full">Beneficios</span>
            <h3 className="font-bold text-xl md:text-2xl xl:text-3xl my-4 lg:my-10 text-gray-900">¿Por qué debería asistir a <span className="text-[#14b8a5]">{conferencia.nombre}</span>?</h3>
            <RiArrowRightUpLine className="flex-none" size={52} />
          </div>
          <div className="w-full md:w-4/5">
            <ConferenciaGallery beneficios={conferencia.beneficios} />
          </div>
        </div>
      </section> */}
      {/* Patrocinadores */}
      <section id="patrocinadores" className="py-10 container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
        <h2 className="text-center lg:text-xl xl:text-2xl font-semibold text-gray-800 mb-4">Patrocinadores Oficiales</h2>
        {conferencia.patrocinadores && conferencia.patrocinadores.length > 0 ? (
          <div className="flex flex-wrap items-start justify-center gap-3">
            {conferencia.patrocinadores.map((patrocinador: any) => (
              <PatrocinadorCard key={patrocinador.id} patrocinador={patrocinador} />
            ))}
          </div>
        ) : (
          <div className="text-center py-5">
            <p className="text-md text-gray-500 mt-1">
              Mantente atento para futuras actualizaciones.
            </p>
          </div>
        )}
      </section>
      {/* Contactos */}
      {/* <section className="py-10 bg-gray-100">
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
      </section> */}
      {/* Footer */}
      <ConferenciaFooter conferencia={conferencia} />
    </div>
  );
}

export default DetalleConferencia;