

function SolucionesCard({solucion} : any) {
  return (
    <div key={solucion.id} className="border border-blue-800 rounded-xl max-w-48 overflow-clip mx-auto">
      <div className="bg-[linear-gradient(120deg,#243a61,#0a0e5c)] h-32 grid place-items-center">
        {/* Opción A: Usar el componente de Icono de React Icons */}
        {/* <solucion.Icono className="text-white z-10 relative" size={48} /> */}
        {/* Opción B: Usar la etiqueta <img> con la ruta original */}
        <img className="z-10 relative" src={solucion.iconoSrc} alt={solucion.nombre} />
      </div>
    
      <footer className="bg-[#030329] p-3 lg:p-4">
        <p className="text-white font-semibold text-[13px] text-center">
          {solucion.nombre}
        </p>
      </footer>
    </div>
  )
}

export default SolucionesCard