import React from "react";
import { RiArrowRightLine } from "react-icons/ri";
import { FaFacebook, FaXTwitter } from "react-icons/fa6";
import { FaInstagram } from "react-icons/fa";
import { Link } from '@/utils/nextRouterCompat';

type SocialLink = {
  facebook?: string;
  instagram?: string;
  x?: string;
};

type Conferencia = {
  redes_sociales?: SocialLink[];
  id: Number
};

type Props = {
  conferencia: Conferencia;
};

function ConferenciaFooter({conferencia}: Props) {
    return (
        <div className="bg-[#020B25] min-h-96 relative">
            <img className="absolute bottom-0 left-0" src="/blur_pattern.webp" alt="imagen blur" />
            <img className="absolute top-0 right-0" src="/blur_pattern_2.webp" alt="imagen blur" />
            <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 flex flex-col items-center justify-center gap-y-5 min-h-inherit">
                <div className="mb-6 glass-effect w-full max-w-5xl px-6 py-8 rounded-xl text-white flex flex-col md:flex-row gap-y-3 gap-x-6 items-center justify-between">
                    <div className="">
                        <p className="text-xl xl:text-2xl font-semibold">¿Quieres ser parte del evento?</p>
                        <p className="text-base xl:text-lg font-light">Llena este formulario y selecciona si asistes como invitado o expositor.</p>
                    </div>
                    <Link to={`/cosmotech/boletos/${conferencia.id}`} className="bg-white rounded-full text-blue-600 text-sm pl-8 pr-2 py-2 flex items-center gap-x-2">
                        Registrate aquí
                        <div className="grid place-items-center w-8 h-8 bg-blue-950 rounded-full">
                            <RiArrowRightLine className="flex-none text-white" size={22} />
                        </div>
                    </Link>
                </div>
                <div className="flex flex-wrap gap-3">
                    {conferencia.redes_sociales?.map((item: SocialLink, i: number) => (
                        <React.Fragment key={i}>
                        {item.facebook && (
                            <a href={item.facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-white grid place-items-center">
                                <FaFacebook className="text-blue-600 flex-none" size={26} />
                            </a>
                        )}
                        {item.instagram && (
                            <a href={item.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-white grid place-items-center">
                                <FaInstagram className="text-blue-600 flex-none" size={26} />
                            </a>
                        )}
                        {item.x && (
                            <a href={item.x} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-white grid place-items-center">
                                <FaXTwitter className="text-blue-600 flex-none" size={26} />
                            </a>
                        )}
                        </React.Fragment>
                    ))}
                </div>
                {/* <p className="text-white font-light text-sm">Aviso de privacidad</p> */}
            </div>
        </div>
    )
}

export default ConferenciaFooter