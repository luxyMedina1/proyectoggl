// import { BsCalendar4Week } from "react-icons/bs";
// import { SlLocationPin } from "react-icons/sl";
import { RiArrowRightLine, RiArrowDownLine   } from "react-icons/ri";
// import { formatDate } from "../../../../utils/dateHelpers";
import NavBar from "./NavBar";
import { Link } from '@/utils/nextRouterCompat';

function ConferenciaHero({ conferencia }: any) {
    return (
        <div className="hero min-h-[380px] md:min-h-[668px] bg-contain bg-[#040c3b] md:bg-cover bg-no-repeat bg-center layer-darker relative" style={{backgroundImage: `url('${conferencia.imagenBanner || '/beneficio_4.webp'}')`}}>
            <NavBar />
            
            <div className="container mx-auto px-4 flex flex-col justify-center items-start min-h-inherit">
                {/* Contenido principal del hero */}
                {/* <h1 className="text-white text-3xl lg:text-4xl xl:text-5xl font-semibold mb-5 max-w-2xl xl:leading-normal">{conferencia.nombre}</h1>
                <div className="text-white pl-4 border-l-4 py-2 border-white flex items-center flex-wrap gap-y-4 gap-x-3 text-lg lg:text-xl mb-5">
                    <p className="flex items-center gap-x-2 font-light"><BsCalendar4Week className="flex-none" size={28} />{formatDate(conferencia.fecha)}</p>
                    <p className="flex items-center gap-x-2 font-light"><SlLocationPin className="flex-none" size={28} />{conferencia.ubicacion}</p>
                </div> */}
                <Link 
                    to={`/cosmotech/boletos/${conferencia.id}`} 
                    className="text-sm md:text-base lg:text-xl items-center absolute bottom-4 md:bottom-20 left-1/2 -translate-x-1/2 mx-auto gap-x-2 inline-flex bg-white text-blue-600 pl-4 md:pl-8 pr-2 py-2 md:py-1 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-300"
                >
                    Registrate aquí
                    <div className="grid place-items-center w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-full flex-none">
                        <RiArrowRightLine className="flex-none text-white text-sm md:text-base" />
                    </div>
                </Link>
            </div>

            {/* Flecha indicadora - oculta en mobile */}
            <div className="hidden md:grid place-items-center absolute -bottom-7 bg-white border-2 border-gray-500 left-1/2 -translate-x-1/2 rounded-full w-14 h-14">
                <RiArrowDownLine className="flex-none text-gray-600" size={30} />
            </div>
        </div>
    )
}

export default ConferenciaHero