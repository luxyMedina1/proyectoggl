import { useState, useEffect } from "react";
import Loader from '@/publicUi/components/Loader';
// import ConferenciaHero from "./components/ConferenciaHero";
import NavBar from "./components/NavBar";
import ContactoCard from "./components/ContactoCard";
import ConferenciaFooter from "./components/ConferenciaFooter";
import PatrocinadorCard from "./components/PatrocinadorCard";
import { useConferencia } from "./hooks/useConferenciaPrograma";
import ErrorPage from "./ErrorPage";

function ProgramaConferencia() {
  const { conferencia, error, loading } = useConferencia();
  const [selectedFecha, setSelectedFecha] = useState<string | null>(null);

  useEffect(() => {
    if (conferencia && conferencia.programa?.length > 0 && !selectedFecha) {
      const primeraFecha = conferencia.programa[0].fecha;
      setSelectedFecha(primeraFecha);
    }
  }, [conferencia, selectedFecha]);

  const programa = conferencia?.programa || [];
  const sesionesDelDia = programa.find(p => p.fecha === selectedFecha)?.sesiones || [];

  const getDateParts = (fecha:string) => {
    const date = getLocalDate(fecha);
    const month = date.toLocaleString("es-MX", { month: "long" });
    const dayNumber = date.getDate();
    const weekday = date.toLocaleString("es-MX", { weekday: "long" });
    return { month, dayNumber, weekday };
  };

  const getLocalDate = (fechaStr: string) => {
    const [year, month, day] = fechaStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  if (loading) return <Loader />;
  if (error) return <ErrorPage />;
  if (!conferencia) return null;

  return (
    <div>
      {/* Hero conferencia */}
      {/* <ConferenciaHero conferencia={conferencia} /> */}
      <NavBar />
      {/* Programa */}
      <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 mt-20 mb-10">
        <section className="bg-white rounded-xl p-4">
          <div className="flex my-6">
            <p className="bg-blue-50 rounded-full inline-flex items-center text-center justify-center px-2 py-1 text-blue-600 mx-auto">{conferencia.nombre}</p>
          </div>
          <p className="text-gray-700 text-lg text-center mb-8">{conferencia.descripcion}</p>
          {/* Fechas */}
          <div className="flex flex-wrap gap-4 justify-start my-8">
            {programa
              .slice()
              .sort((a, b) => getLocalDate(a.fecha).getTime() - getLocalDate(b.fecha).getTime())
              .map((p, idx) => {
                const { month, dayNumber, weekday } = getDateParts(p.fecha);
                const isSelected = selectedFecha === p.fecha;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedFecha(p.fecha)}
                    className={`flex flex-col items-center justify-center rounded-2xl w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-32 border transition-all shadow-sm ${
                      isSelected
                        ? "bg-gray-800 text-white border-gray-600 relative after:absolute after:content-[''] after:bottom-[-20px] after:w-5 after:h-5 after:bg-inherit after:[clip-path:polygon(50%_100%,0_0,100%_0)]"
                        : "bg-white border-gray-300 text-emphasis hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-sm font-normal mb-1">{month}</span>
                    <span className="text-3xl xl:text-5xl font-bold leading-tight">{dayNumber}</span>
                    <span className="text-sm xl:text-base font-medium">{weekday}</span>
                  </button>
                );
            } )}
          </div>


          {/* Listado de sesiones */}
          <div className="mt-10">
            {sesionesDelDia.length === 0 ? (
              <p className="text-center text-gray-500">
                No hay sesiones programadas para esta fecha.
              </p>
            ) : (
              <div className="grid">
                {sesionesDelDia.map((sesion) => (
                  <div key={sesion.id} className="flex flex-col lg:flex-row lg:items-center gap-y-3 gap-x-5 border-b first:border-t border-slate-300 bg-[#f8fafc] py-3 line-pseudo min-h-[150px]">
                    <div className="w-5 h-5 rounded-full bg-emphasis flex-none"></div>
                    <div className="w-24 flex-none">
                      <p className="text-emphasis font-medium text-2xl lg:text-3xl ">
                        {sesion.hora}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-gray-800">{sesion.titulo}</h3>
                      <p className="text-gray-600 mb-2">{sesion.descripcion}</p>
                      {sesion.expositores.length > 0 && (
                        <ul className="text-gray-600 flex flex-wrap items-center gap-3 text-sm">
                          {sesion.expositores.map((exp: any, i: number) => (
                            <li className="flex items-center gap-x-2" key={i}>
                              <img width={55} height={55} className="aspect-square rounded-full object-cover" src={exp.foto || '/user_default.png'} alt="foto usuario" />
                              <p className="font-semibold">
                                {exp.nombre}
                                <span className="block font-light text-gray-500 text-sm">{exp.puesto}</span>
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Patrocinadores */}
      <section className="py-10 container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
        <h2 className="text-center lg:text-xl xl:text-2xl font-semibold text-gray-800 mb-4">Patrocinadores</h2>
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
    </div>
  );
}

export default ProgramaConferencia;