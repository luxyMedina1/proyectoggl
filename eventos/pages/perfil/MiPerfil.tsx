import apiApplication from "../../../api/apiApplication";
import { useEffect, useRef, useState } from "react";
import Sidebar from './components/Sidebar';
import Loader from '@/publicUi/components/Loader';
import UserAvatar from "../../../components/UserAvatar";
import Swal from "sweetalert2";

function MiPerfil() {

    const [perfil, setPerfil] = useState<Perfil | null>(null);
    const [cargando, setCargando] = useState(false);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const [actualizandoPerfil, setActualizandoPerfil] = useState(false);
    const [formNombre, setFormNombre] = useState("");
    const [formEmail, setFormEmail] = useState("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const cargarMiPerfil = async () => {
        try {
            setCargando(true);
            const { data } = await apiApplication.get('/usuarios/mi_perfil');
            setPerfil(data);
        } catch (error: any) {
            console.error("Error al obtener el perfil:", error);
            let mensajeError = "Error al obtener el perfil.";
            if (error.response && error.response.data && error.response.data.message) {
                mensajeError = error.response.data.message;
            } else if (error.message) {
                mensajeError = error.message;
            }
            Swal.fire({
                title: "Error",
                text: mensajeError,
                icon: "error",
                confirmButtonText: "OK",
            });
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        const getMiPerfil = async () => {
            await cargarMiPerfil();
        };
        getMiPerfil();
    }, []);

    useEffect(() => {
        if (perfil) {
            setFormNombre(perfil.fullName || "");
            setFormEmail(perfil.email || "");
        }
    }, [perfil]);

    const handleSeleccionFoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const archivo = event.target.files?.[0];
        if (!archivo) {
            return;
        }

        if (!['image/png', 'image/jpeg'].includes(archivo.type)) {
            Swal.fire({
                title: "Archivo no valido",
                text: "Selecciona una imagen PNG o JPG.",
                icon: "warning",
                confirmButtonText: "OK",
            });
            event.target.value = "";
            return;
        }

        try {
            setSubiendoFoto(true);
            const formData = new FormData();
            formData.append('imagenPerfil', archivo);
            await apiApplication.patch('/usuarios/update/profile-pic', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            await cargarMiPerfil();
        } catch (error: any) {
            console.error("Error al actualizar la foto de perfil:", error);
            let mensajeError = "Error al actualizar la foto de perfil.";
            if (error.response && error.response.data && error.response.data.message) {
                mensajeError = error.response.data.message;
            } else if (error.message) {
                mensajeError = error.message;
            }
            Swal.fire({
                title: "Error",
                text: mensajeError,
                icon: "error",
                confirmButtonText: "OK",
            });
        } finally {
            setSubiendoFoto(false);
            event.target.value = "";
        }
    };

    interface Perfil {
        id: number,
        fullName: string;
        email: string;
        image: string | null;
    }

    const handleActualizarPerfil = async () => {
        if (!perfil) {
            return;
        }

        const nombre = formNombre.trim();
        const email = formEmail.trim();
        const payload: { nombre?: string; email?: string } = {};

        if (nombre !== perfil.fullName) {
            payload.nombre = nombre;
        }

        if (email !== perfil.email) {
            payload.email = email;
        }

        if (Object.keys(payload).length === 0) {
            return;
        }

        try {
            setActualizandoPerfil(true);
            await apiApplication.patch('/usuarios/update/perfil', payload);
            await cargarMiPerfil();
            Swal.fire({
                title: "Listo",
                text: "Perfil actualizado.",
                icon: "success",
                confirmButtonText: "OK",
            });
        } catch (error: any) {
            console.error("Error al actualizar el perfil:", error);
            let mensajeError = "Error al actualizar el perfil.";
            if (error.response && error.response.data && error.response.data.message) {
                mensajeError = error.response.data.message;
            } else if (error.message) {
                mensajeError = error.message;
            }
            Swal.fire({
                title: "Error",
                text: mensajeError,
                icon: "error",
                confirmButtonText: "OK",
            });
        } finally {
            setActualizandoPerfil(false);
        }
    };


  return (
    <div style={{ backgroundImage: `url('/bg_perfil.svg')`, backgroundRepeat: "no-repeat", backgroundPosition: 'top', backgroundSize: '100%', paddingTop: '40px' }}>
        {cargando && (  <Loader /> )}
        <div className="container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20">
            <div className="grid grid-cols-7 gap-4 items-start mb-5">
                <Sidebar />
                <section className='bg-gray-50 shadow-md rounded-xl col-span-7 md:col-span-4 lg:col-span-5 p-4'>
                    <h2 className="text-gray-800 text-2xl 2xl:text-3xl font-semibold">Mi perfil</h2>
                    <hr className="my-3" />
                    <div className="flex items-center gap-x-3">
                        <figure className="relative h-[100px] w-[100px]">
                            <UserAvatar
                                nombre={perfil?.fullName || '?'}
                                image={perfil?.image}
                                size={100}
                                className="h-full w-full"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:opacity-100"
                                aria-label="Cambiar foto de perfil"
                            >
                                <svg
                                    viewBox="0 0 20 20"
                                    aria-hidden="true"
                                    className="h-6 w-6 fill-current"
                                >
                                    <path d="M2 14.5V18h3.5l10-10-3.5-3.5-10 10Zm15.7-9.2c.4-.4.4-1 0-1.4l-1.6-1.6c-.4-.4-1-.4-1.4 0l-1.2 1.2 3.5 3.5 1.2-1.2Z" />
                                </svg>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg"
                                onChange={handleSeleccionFoto}
                                className="hidden"
                                disabled={subiendoFoto}
                            />
                        </figure>
                        <div className="text-gray-600">
                            <p className="font-semibold text-xl">{perfil?.fullName || ''}</p>
                            <p className="text-lg">{perfil?.email}</p>
                        </div>
                    </div>
                    <fieldset className="mt-5 border border-gray-300 rounded-lg p-2 md:p-4 grid grid-cols-2 gap-4">
                        <legend className="text-gray-600 text-xl font-medium col-span-2">Información personal</legend>
                        <label className="font-medium text-gray-700 col-span-2 md:col-span-1" htmlFor="nombre">
                            Nombre completo
                            <input
                                type="text"
                                id="nombre"
                                className="block border border-gray-300 rounded-md p-2 w-full"
                                value={formNombre}
                                onChange={(event) => setFormNombre(event.target.value)}
                            />
                        </label>
                        <label className="font-medium text-gray-700 col-span-2 md:col-span-1" htmlFor="email">
                            Correo electrónico
                            <input
                                type="text"
                                id="email"
                                className="block border border-gray-300 rounded-md p-2 w-full"
                                value={formEmail}
                                onChange={(event) => setFormEmail(event.target.value)}
                            />
                        </label>
                        <div className="col-span-2 flex justify-end">
                            <button
                                type="button"
                                onClick={handleActualizarPerfil}
                                disabled={actualizandoPerfil || !perfil || (formNombre.trim() === perfil.fullName && formEmail.trim() === perfil.email) || (!formNombre.trim() || !formEmail.trim())}
                                className="rounded-md bg-emerald-600 px-4 py-2 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {actualizandoPerfil ? "Guardando..." : "Editar"}
                            </button>
                        </div>
                    </fieldset>
                </section>
            </div>
        </div>
    </div>
  );
}

export default MiPerfil;
