"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiPhone } from 'react-icons/fi';
import { useAuthStore } from '../../../hooks/useAuthStore';
import { useColorConfig } from '../../../context/ColorContext';
import { CountryCodeSelect } from '../../../auth/components/CountryCodeSelect';
import { CountryCode, DEFAULT_COUNTRY } from '../../../data/countryCodes';

const onlyDigits = (s: string) => s.replace(/\D+/g, '');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CompletarPerfilPage() {
    const router = useRouter();
    const { config } = useColorConfig();
    const { user, status, completarPerfilOTP, startLogout, checkAuthToken } = useAuthStore();
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);

    // Si el usuario no tiene teléfono, se registró por correo → le pedimos el teléfono.
    // En caso contrario (registrado por teléfono) le pedimos el correo.
    const pideTelefono = !user?.telefono;

    useEffect(() => {
        if (status === 'checking') {
            checkAuthToken();
            return;
        }
        if (status === 'unauthenticated') {
            router.replace('/auth/login');
            return;
        }
        if (user?.perfilCompleto) {
            router.replace('/eventos');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, user]);

    useEffect(() => {
        if (user) {
            setEmail(user.email ?? '');
            setFullName(user.fullName ?? '');
        }
    }, [user]);

    const telefonoE164 = useMemo(() => `+${country.dialCode}${onlyDigits(phone)}`, [country, phone]);
    const phoneValid = onlyDigits(phone).length >= 7;
    const emailValid = EMAIL_REGEX.test(email.trim());
    const formattedPhoneDisplay = useMemo(() => {
        const digits = onlyDigits(phone);
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }, [phone]);

    const canSubmit =
        fullName.trim().length > 0 && (pideTelefono ? phoneValid : emailValid) && !saving;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        const data = await completarPerfilOTP(
            pideTelefono
                ? { telefono: telefonoE164, fullName: fullName.trim() }
                : { email: email.trim(), fullName: fullName.trim() },
        );
        setSaving(false);
        if (data) {
            router.replace('/eventos');
        }
    };

    return (
        <div className="bg-white grid grid-cols-2 justify-center items-center min-h-screen">
            <div className="col-span-2 lg:col-span-1 h-auto lg:min-h-screen">
                <div className="auth-bg p-5 md:p-8 lg:p-10">
                    <Link href="/">
                        <img className="mb-16" width={240} height={120} src={config?.logoMarca} alt="logo company" />
                    </Link>
                    <h1 className="text-white text-3xl lg:text-5xl font-semibold">Bienvenido a tu acceso exclusivo a los mejores conciertos</h1>
                    <p className="text-lg lg:text-xl text-gray-300 mt-10">
                        Antes de continuar, completa tu {pideTelefono ? 'teléfono' : 'correo'} y nombre. Esto es necesario para usar la plataforma.
                    </p>
                </div>
            </div>
            <div className="p-5 md:p-8 lg:p-10 col-span-2 lg:col-span-1">
                <div className="loginPageg">
                    <p className="text-2xl lg:text-3xl font-semibold text-gray-800">Completa tu perfil</p>
                    <p className="text-gray-400 text-lg mt-2">
                        Necesitamos un par de datos antes de seguir. No podrás continuar hasta completarlos.
                    </p>
                    <form onSubmit={handleSubmit} className="py-5">
                        <div className="mb-4">
                            <label className="block text-gray-700 text-base font-medium mb-2">Nombre completo:</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Nombre y apellidos"
                                className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-1 focus:ring-accentBase"
                                autoFocus
                            />
                        </div>
                        {pideTelefono ? (
                            <div className="grid grid-cols-12 gap-3 mb-6">
                                <div className="col-span-4 sm:col-span-3">
                                    <label className="block text-gray-700 text-base font-medium mb-2">Código:</label>
                                    <CountryCodeSelect value={country} onChange={setCountry} />
                                </div>
                                <div className="col-span-8 sm:col-span-9">
                                    <label className="block text-gray-700 text-base font-medium mb-2">Número de teléfono:</label>
                                    <div className="relative">
                                        <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            value={formattedPhoneDisplay}
                                            onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 15))}
                                            placeholder="123-123-1234"
                                            className="shadow-sm border border-gray-300 rounded-lg w-full py-2 pl-10 pr-3 text-gray-700 focus:outline-none focus:ring-1 focus:ring-accentBase h-[42px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6">
                                <label className="block text-gray-700 text-base font-medium mb-2">Correo electrónico:</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tucorreo@ejemplo.com"
                                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-1 focus:ring-accentBase"
                                />
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="w-full bg-[#082348] text-white font-normal py-3 px-4 rounded focus:outline-none disabled:opacity-60"
                        >
                            {saving ? 'Guardando…' : 'Guardar y continuar'}
                        </button>
                    </form>
                    <p className="text-center text-sm text-gray-500 mt-3">
                        <button onClick={startLogout} className="underline hover:text-emphasis">
                            Salir e iniciar sesión con otra cuenta
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
