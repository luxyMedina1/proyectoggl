import { HiOutlineLightBulb } from "react-icons/hi2";
import { TbTargetArrow } from "react-icons/tb";
import { RiUserStarLine } from "react-icons/ri";
import { BiNetworkChart } from "react-icons/bi";

function Objetivos() {
    return (
        <div className="relative grid grid-cols-2 gap-y-5 min-h-96 max-h-[400px]">
            {/* Adorno */}
            <div className="h-full min-h-96 w-40 rounded-full bg-[#030329] absolute left-1/2 z-0 -translate-x-1/2"></div>
            {/* Items */}
            <div className="absolute z-1 right-[calc(50%-28px)] top-[10%] bg-white rounded-full border border-blue-800 flex items-center gap-x-2 px-2 py-1">
                <p className="text-gray-900 text-sm">Innovación y tecnología mexicana</p>
                <span className="w-10 h-10 grid place-items-center flex-none bg-[#0931BA] rounded-full"><HiOutlineLightBulb className="flex-none text-white" size={22} /></span>
            </div>
            <div className="absolute z-1 left-[calc(50%-28px)] top-[30%] bg-white rounded-full border border-blue-800 flex flex-row-reverse items-center gap-x-2 px-2 py-1">
                <p className="text-gray-900 text-sm">Convergencia estratégica</p>
                <span className="w-10 h-10 grid place-items-center flex-none bg-[#0931BA] rounded-full"><TbTargetArrow className="flex-none text-white" size={22} /></span>
            </div>
            <div className="absolute z-1 right-[calc(50%-28px)] top-[50%] bg-white rounded-full border border-blue-800 flex items-center gap-x-2 px-2 py-1">
                <p className="text-gray-900 text-sm">Conexión a lideres</p>
                <span className="w-10 h-10 grid place-items-center flex-none bg-[#0931BA] rounded-full"><RiUserStarLine className="flex-none text-white" size={22} /></span>
            </div>
            <div className="absolute z-1 left-[calc(50%-28px)] top-[70%] bg-white rounded-full border border-blue-800 flex flex-row-reverse items-center gap-x-2 px-2 py-1">
                <p className="text-gray-900 text-sm">Transformación digital</p>
                <span className="w-10 h-10 grid place-items-center flex-none bg-[#0931BA] rounded-full"><BiNetworkChart className="flex-none text-white" size={22} /></span>
            </div>
        </div>
    )
}

export default Objetivos