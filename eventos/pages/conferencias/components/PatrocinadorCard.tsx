
function PatrocinadorCard({patrocinador}: any) {
    return (
       <div className="border p-3 rounded-lg" key={patrocinador.id}>
            <figure className="mb-3">
                <img className="w-32 object-contain aspect-[3/2] mix-blend-color-burn" src={patrocinador.logo || '/default_image.png'} alt="imagen patrocinador" />
            </figure>
            <p className="border p-1 rounded-lg text-sm text-center text-gray-600">{patrocinador.nombre}</p>
        </div>
    )
}

export default PatrocinadorCard