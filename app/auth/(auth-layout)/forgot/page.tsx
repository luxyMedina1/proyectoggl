"use client";

import { useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { FaRegCircle } from "react-icons/fa";
import apiApplication from "../../../../api/apiApplication";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [cargando, setCargando] = useState(false);

    const handleRecuperarPassword = async () => {
        if (!email) {
            Swal.fire("Error", "Por favor, ingresa un correo electrónico.", "error");
            return;
        }

        setCargando(true);
        try {
            const response = await apiApplication.post(`/correos/forgot-password/${email}`);
            if (response.status === 201 || response.status === 200) {
                Swal.fire(
                    response.data.message,
                    "Hemos enviado un correo con instrucciones para restablecer tu contraseña.",
                    "success"
                );
            } else {
                throw new Error("No se pudo enviar el correo de recuperación.");
            }
        } catch (error: any) {
            console.error("Error al recuperar contraseña:", error);
            Swal.fire("Error", error.response?.data?.message ?? "No se pudo enviar el correo.", "error");
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="">
            <p className="text-2xl lg:text-3xl font-semibold text-gray-800">Recuperar contraseña</p>
            <p className='text-gray-500 text-lg mt-2'>Enviaremos un correo electrónico con instrucciones para que puedas restablecer tu contraseña.</p>
            <label className="mt-10 text-gray-500 text-sm block mb-2 font-medium" htmlFor="email">Ingresa el correo electrónico con el que te registraste</label>
            <input
                id="email"
                type="email"
                placeholder="Ingresa tu correo electrónico"
                className="w-full px-3 py-2 border border-gray-300 rounded-md mb-3 "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                />
            <button
                className="w-full bg-[#082348] text-white py-2 rounded-md disabled:bg-gray-400 transition-colors"
                onClick={handleRecuperarPassword}
                disabled={cargando}
                >
                {cargando ? "Enviando..." : "Recuperar Contraseña"}
            </button>
            <div className='flex items-center gap-x-3 my-5'>
                <hr className='grow' />
                <FaRegCircle className='text-gray-400' />
                <hr className='grow' />
            </div>
            <div className="p-1">
                <p className="text-center text-gray-500"><Link href="/auth/login" className="font-semibold text-emphasis underline">Iniciar sesión</Link></p>
            </div>
        </div>
    );
}
