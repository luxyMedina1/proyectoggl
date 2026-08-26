

function ContactoCard({contacto} : any) {
    return (
        <div key={contacto.id} className="bg-[#162340] rounded-lg px-3 py-4 text-center relative overflow-clip w-full max-w-[570px]">
            <img className="absolute -top-2 -right-2" src="/asterisk.svg" alt="asterisk" />
            <img className="max-w-40 mx-auto mb-4 rounded-full object-cover z-10 relative" src={contacto.foto} alt="" />
            <p className="text-white font-medium text-xl xl:text-2xl">{contacto.nombre}</p>
            <span className="text-white font-light text-base xl:text-lg">{contacto.puesto}</span>
            <hr className="my-3" />
            <span className="text-white font-semibold text-base xl:text-lg">{contacto.correo}</span>
        </div>
    )
}

export default ContactoCard