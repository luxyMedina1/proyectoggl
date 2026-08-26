import { FaArrowRightLong } from "react-icons/fa6";
import { GrLocation } from "react-icons/gr";

function HotelCard({ hotel }: any) {
    // console.log("🚀 ~ HotelCard ~ hotel:", hotel)
    return (
        <div className="grid gap-y-6 py-5">
            <div className="space-y-3">
                <h3 className="text-3xl font-semibold text-[#03045E] leading-normal">{hotel.nombre}</h3>
                <div className="flex flex-wrap gap-y-3 items-center gap-x-3">
                    <p className="flex items-center gap-x-2 text-lg text-gray-600"><GrLocation className="flex-none size-7" />{hotel.direccion}</p>
                    <a href={`${hotel.web}`} target="_blank" className="flex items-center gap-x-3 bg-blue-950 px-4 py-2 rounded-lg text-white font-medium">
                        Google Maps
                        <div className="bg-white w-7 h-7 rounded-full grid place-items-center">
                            <FaArrowRightLong className="flex-none text-blue-950" />
                        </div>
                    </a>
                </div>
            </div>
            <div className="grid grid-cols-6 gap-6">
                <figure className={`col-span-6 ${hotel.descripcion === '' ? 'lg:col-span-6' : 'lg:col-span-4'}`}>
                    <img className="rounded-2xl w-full h-full object-cover" src={`${hotel.foto}`} alt="hotel image" />
                </figure>
                <div className={`col-span-6 ${hotel.descripcion === '' ? 'lg:col-span-6' : 'lg:col-span-2'}`}>
                    {hotel.descripcion && (
                        <>
                            <h4 className="text-2xl font-semibold text-gray-800 mb-3">Acerca del hotel</h4>
                            <p className="text-gray-700 font-light text-sm">
                                {hotel.descripcion || ''}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default HotelCard