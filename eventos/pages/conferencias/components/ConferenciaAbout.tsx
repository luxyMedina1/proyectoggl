
import Objetivos from "./Objetivos"

function ConferenciaAbout({ beneficios }: any) {
  console.log("🚀 ~ ConferenciaAbout ~ beneficios:", beneficios)
  const textoConSaltos = beneficios[0]?.descripcion.replace(/\.\s*/g, ".\n");
  return (
    <div className="my-10">
      <h3 className="text-center text-3xl lg:text-4xl xl:text-5xl text-blue-950 font-bold">¿Que es CosmoTech?</h3>
      <div className="py-10 container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
        <div className="grid lg:grid-cols-2 gap-4">
          <Objetivos />
          <div className="border border-gray-300 rounded-xl p-2 md:p-3 lg:p-4">
            <img className="mb-2" src={`/atril.svg`} alt="imagen de beneficio" />
            <p className="text-gray-900 text-left text-base text-ellipsis overflow-hidden whitespace-pre-line">{textoConSaltos || ''}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConferenciaAbout