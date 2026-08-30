import { useColorConfig } from "../../../context/ColorContext";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

function PasosEliminacionCuenta() {
    const { config } = useColorConfig();
    const pathname = usePathname();
    const nombreMarca = config?.nombreMarca;
    const logo = config?.logoSmall;
    const emailContacto = config?.emailContacto;
    
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    
    // console.log("🚀 ~ PasosEliminacionCuenta ~ config:", config)

  return (
    <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 mb-5">
        <h1 className="text-2xl 2xl:text-4xl font-bold text-darker my-10 text-center max-w-xl mx-auto">¿Cómo eliminar tu cuenta en la app <span>"{nombreMarca}"</span>?</h1>
        <ol className="list-decimal grid items-center justify-center gap-y-3 max-w-xl mx-auto pl-3 lg:pl-0">
            <li className="text-xl font-medium">
                <p className="text-xl font-medium mb-3 text-darker">Abre tu app de <span>"{nombreMarca}"</span> y  ve a la sección de <strong>Perfil</strong>:</p>
                <figure className="p-2 md:p-3 lg:p-4 bg-gray-200 shadow rounded-md relative">
                    <img className="absolute max-w-16 top-5 md:top-7 left-[63%] md:left-[57%]" src={logo} alt="logo de la app" />
                    <img className="max-h-[30rem] mx-auto" src="/step_1_cuenta.webp" alt="eliminar cuenta paso 1" />
                </figure>
            </li>
            <li className="text-xl font-medium">
                <p className="text-xl font-medium mb-3 text-darker">Busca la opción <span className="text-red-600">"Eliminar Cuenta"</span> y presiona sobre el botón:</p>
                <figure className="p-2 md:p-3 lg:p-4 bg-gray-200 shadow rounded-md">
                    <img className="max-h-[30rem] mx-auto" src="/step_2_cuenta.webp" alt="eliminar cuenta paso 2" />
                </figure>
            </li>
            <li className="text-xl font-medium">
                <p className="text-xl font-medium mb-3 text-darker">Confirmar que deseas continuar con esta acción presionando en continuar:</p>
                <figure className="p-2 md:p-3 lg:p-4 bg-gray-200 shadow rounded-md">
                    <img className="max-h-[30rem] mx-auto" src="/step_3_cuenta.webp" alt="eliminar cuenta paso 3" />
                </figure>
            </li>
            <li className="text-xl font-medium">
                <p className="text-xl font-medium mb-3 text-darker">Vuelve a confirmar la solicitud escribiendo: <span className="text-red-600 block">"Deseo eliminar mi cuenta"</span></p>
                <figure className="p-2 md:p-3 lg:p-4 bg-gray-200 shadow rounded-md">
                    <img className="max-h-[30rem] mx-auto" src="/step_4_cuenta.webp" alt="eliminar cuenta paso 4" />
                </figure>
            </li>
            <li className="text-xl font-medium">
                <p className="text-xl font-medium mb-3 text-darker">Datos que se eliminarán:</p>
                <p className="text-gray-600 text-lg font-normal">Tu nombre, correo electrónico y datos de inicio de sesión.</p>
                <p className="text-gray-600 text-lg font-normal">Historial de actividad asociado a tu cuenta.</p>
            </li>
            <li className="text-xl font-medium">
                <p className="text-xl font-medium mb-3 text-darker">Datos que se conservarán (si aplica):</p>
                <p className="text-gray-600 text-lg font-normal">Algunos registros técnicos (por ejemplo, de seguridad o facturación) se mantienen durante un período limitado por motivos legales o administrativos.</p>
            </li>
            <li className="text-xl font-medium">
                <p className="text-xl font-medium mb-3 text-darker">Si tienes dudas, puedes escribir un correo a:</p>
                <a  href={`mailto:${emailContacto}`} className="text-blue-500 text-lg font-normal hover:text-blue-600 transition duration-300 underline underline-offset-4">
                    {emailContacto}
                </a>
            </li>
        </ol>
    </div>
  )
}

export default PasosEliminacionCuenta