import { TbTicket } from "react-icons/tb";
import { formatearDinero } from "../helpers/formatearDinero";

interface Categorias {
    categoria: string;
    color: string;
    precios: number[];
}

function ListaPreciosCategorias({ preciosCategorias }: { preciosCategorias: Categorias[] }) {
    return (
        <>
            {preciosCategorias?.map((categoria, index) => {

                const preciosValidos = categoria?.precios?.filter(precio => precio > 0) ?? [];

                if (preciosValidos.length === 0) return null;

                return (
                    <div key={index} className="px-3 py-2 shadow-sm bg-white border border-gray-300 rounded-md min-h-fit flex divide-x-2 gap-x-3 w-full sm:w-auto" >
                        <p className="font-semibold text-gray-800 flex items-center gap-x-2">
                            <span className="grid place-items-center rounded-md w-10 h-10" style={{ backgroundColor: categoria.color || '#000000' }}>
                                <TbTicket className="text-2xl text-white" />
                            </span>
                            {categoria.categoria}
                        </p>
                        <div className="text-gray-800 pl-2">
                            <span className="font-semibold text-sm">Precios:</span>
                            <ul className="list-inside mt-1 text-sm">
                                {preciosValidos.map((precio, idx) => (
                                    <li key={idx} className="font-medium">{formatearDinero(precio)}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
            })}
        </>
    );
};

export default ListaPreciosCategorias;
