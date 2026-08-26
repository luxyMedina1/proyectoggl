"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiPhone, FiMessageSquare, FiMail } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuthStore, OtpChannel, OtpMetodosActivos } from '../../hooks/useAuthStore';
import { CountryCodeSelect } from './CountryCodeSelect';
import { CountryCode, DEFAULT_COUNTRY } from '../../data/countryCodes';

type Step = 'phone' | 'otp';
type Metodo = 'telefono' | 'email';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

const onlyDigits = (s: string) => s.replace(/\D+/g, '');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
    // Si se pasa, al iniciar sesión (perfil completo) se llama en vez de navegar.
    // Útil para el modal de login: mantiene al usuario donde estaba.
    onAuthenticated?: () => void;
}

// Formulario de login por OTP (WhatsApp/SMS/correo). Reutilizable en la página y en el modal.
export const LoginForm = ({ onAuthenticated }: Props) => {
    const router = useRouter();
    const {
        getOtpMetodosActivos,
        startSendOtp,
        startResendOtp,
        startValidateOtp,
    } = useAuthStore();

    const [step, setStep] = useState<Step>('phone');
    const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [keepSession, setKeepSession] = useState(false);
    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [resendIn, setResendIn] = useState(RESEND_SECONDS);
    const [sendingChannel, setSendingChannel] = useState<OtpChannel | null>(null);
    const [smsEnabled, setSmsEnabled] = useState(true);
    const [smsNotice, setSmsNotice] = useState(false);
    const [channelUsed, setChannelUsed] = useState<OtpChannel>('whatsapp');
    const [destinoUsed, setDestinoUsed] = useState('');
    const [validating, setValidating] = useState(false);
    const [metodos, setMetodos] = useState<OtpMetodosActivos>({ wh: false, sms: false, email: false });
    const [metodo, setMetodo] = useState<Metodo>('telefono');

    const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

    const telefonoE164 = useMemo(() => `+${country.dialCode}${onlyDigits(phone)}`, [country, phone]);
    const phoneValid = onlyDigits(phone).length >= 7;
    const emailValid = EMAIL_REGEX.test(email.trim());
    const codeFilled = code.every((c) => c !== '');
    const formattedPhoneDisplay = useMemo(() => {
        const digits = onlyDigits(phone);
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }, [phone]);

    useEffect(() => {
        const fetchMetodosOtp = async () => {
            const data = await getOtpMetodosActivos();
            setMetodos(data);
            setMetodo(data.wh || data.sms ? 'telefono' : 'email');
        };
        fetchMetodosOtp();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (step !== 'otp') return;
        if (resendIn <= 0) return;
        const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
        return () => clearInterval(id);
    }, [step, resendIn]);

    const goToOtpStep = (canal: OtpChannel, destino: string) => {
        setChannelUsed(canal);
        setDestinoUsed(destino);
        setCode(Array(CODE_LENGTH).fill(''));
        setResendIn(RESEND_SECONDS);
        setStep('otp');
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
    };

    const handleSendOtp = async (canal: OtpChannel) => {
        if (sendingChannel) return;
        const esEmail = canal === 'email';
        if (esEmail ? !emailValid : !phoneValid) return;
        const destino = esEmail ? email.trim() : telefonoE164;
        setSendingChannel(canal);
        const res = await startSendOtp(destino, canal);
        setSendingChannel(null);
        if (res.serviceUnavailable) {
            setSmsEnabled(false);
            setSmsNotice(true);
            return;
        }
        if (res.ok) goToOtpStep(canal, destino);
    };

    const handleResend = async () => {
        if (resendIn > 0) return;
        const res = await startResendOtp(destinoUsed, channelUsed);
        if (res.serviceUnavailable) {
            setSmsEnabled(false);
            setChannelUsed('whatsapp');
            const wa = await startResendOtp(destinoUsed, 'whatsapp');
            if (!wa.ok) return;
        } else if (!res.ok) {
            return;
        }
        setResendIn(RESEND_SECONDS);
        setCode(Array(CODE_LENGTH).fill(''));
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
    };

    const handleValidate = async () => {
        if (!codeFilled || validating) return;
        setValidating(true);
        const data = await startValidateOtp(destinoUsed, code.join(''), keepSession, channelUsed);
        setValidating(false);
        if (!data) return;
        if (data.perfilCompleto) {
            if (onAuthenticated) onAuthenticated();
            else router.replace('/eventos');
        } else {
            // El perfil incompleto obliga a completar datos (no se puede continuar inline).
            router.replace('/auth/completar_perfil');
        }
    };

    const handleCodeChange = (i: number, raw: string) => {
        const digit = onlyDigits(raw).slice(-1);
        const next = [...code];
        next[i] = digit;
        setCode(next);
        if (digit && i < CODE_LENGTH - 1) {
            otpRefs.current[i + 1]?.focus();
        }
    };

    const handleCodeKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[i] && i > 0) {
            otpRefs.current[i - 1]?.focus();
        }
        if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.focus();
        if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) otpRefs.current[i + 1]?.focus();
        if (e.key === 'Enter') handleValidate();
    };

    const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = onlyDigits(e.clipboardData.getData('text')).slice(0, CODE_LENGTH);
        if (!pasted) return;
        e.preventDefault();
        const next = Array(CODE_LENGTH).fill('').map((_, i) => pasted[i] ?? '');
        setCode(next);
        const lastIdx = Math.min(pasted.length, CODE_LENGTH) - 1;
        otpRefs.current[Math.max(lastIdx, 0)]?.focus();
    };

    const resendText = resendIn > 0
        ? `Reenviar en 00:${String(resendIn).padStart(2, '0')} min.`
        : 'Reenviar código';

    const channelLabel =
        channelUsed === 'sms' ? 'SMS' : channelUsed === 'email' ? 'correo electrónico' : 'WhatsApp';
    const esEmailUsado = channelUsed === 'email';

    if (step === 'otp') {
        return (
            <>
                <p className="text-2xl lg:text-3xl font-semibold text-gray-800">Verifica tu código</p>
                <p className="text-gray-400 text-lg mt-2">
                    Ingresa el código de {CODE_LENGTH} dígitos que enviamos por {channelLabel}{' '}
                    {esEmailUsado ? 'al correo:' : 'al número:'}{' '}
                    <span className="font-semibold text-gray-700">
                        {esEmailUsado ? destinoUsed : `+${country.dialCode} ${formattedPhoneDisplay}`}
                    </span>
                </p>
                <div className="py-8">
                    <div className="flex justify-between gap-2 sm:gap-3">
                        {code.map((c, i) => (
                            <input
                                key={i}
                                ref={(el) => { otpRefs.current[i] = el; }}
                                value={c || ''}
                                onChange={(e) => handleCodeChange(i, e.target.value)}
                                onKeyDown={(e) => handleCodeKey(i, e)}
                                onPaste={handleCodePaste}
                                inputMode="numeric"
                                maxLength={1}
                                placeholder="-"
                                className="w-full aspect-square max-w-[56px] text-center text-2xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-accentBase"
                            />
                        ))}
                    </div>
                    <p className="text-right text-sm text-gray-500 mt-3">
                        ¿No te llegó el código?{' '}
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={resendIn > 0}
                            className={`${resendIn > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-emphasis underline'}`}
                        >
                            {resendText}
                        </button>
                    </p>
                </div>
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={handleValidate}
                        disabled={!codeFilled || validating}
                        className="w-full bg-[#082348] text-white font-normal py-3 px-4 rounded focus:outline-none disabled:opacity-60"
                    >
                        {validating ? 'Verificando…' : 'Verificar código'}
                    </button>
                </div>
                <p className="text-center mt-4">
                    <button
                        type="button"
                        onClick={() => setStep('phone')}
                        className="text-sm text-gray-500 hover:text-emphasis underline"
                    >
                        {esEmailUsado ? 'Cambiar correo' : 'Cambiar número'}
                    </button>
                </p>
            </>
        );
    }

    return (
        <>
            <p className="text-2xl lg:text-3xl font-semibold text-gray-800">Inicia sesión o crea tu cuenta</p>
            <p className="text-gray-400 text-lg mt-2">
                {metodo === 'email'
                    ? 'Ingresa tu correo electrónico y te enviaremos un código de verificación.'
                    : `Ingresa tu número celular y te enviaremos un código de verificación por WhatsApp${metodos.sms && smsEnabled ? ' o SMS' : ''}.`}
            </p>
            <div className="py-5">
                {(metodos.wh || metodos.sms) && metodos.email && (
                    <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-gray-100 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setMetodo('telefono')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${metodo === 'telefono' ? 'bg-white text-[#082348] shadow-sm' : 'text-gray-500'}`}
                        >
                            <FiPhone /> Teléfono
                        </button>
                        <button
                            type="button"
                            onClick={() => setMetodo('email')}
                            className={`flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${metodo === 'email' ? 'bg-white text-[#082348] shadow-sm' : 'text-gray-500'}`}
                        >
                            <FiMail /> Correo
                        </button>
                    </div>
                )}

                {metodo === 'telefono' ? (
                    <div className="grid grid-cols-12 gap-3 mb-3">
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
                    <div className="mb-3">
                        <label className="block text-gray-700 text-base font-medium mb-2">Correo electrónico:</label>
                        <div className="relative">
                            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="email"
                                inputMode="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp('email'); }}
                                placeholder="correo@correo.com"
                                className="shadow-sm border border-gray-300 rounded-lg w-full py-2 pl-10 pr-3 text-gray-700 focus:outline-none focus:ring-1 focus:ring-accentBase h-[42px]"
                            />
                        </div>
                    </div>
                )}

                <label className="flex items-center justify-end gap-x-2 text-sm text-gray-500 mb-5 cursor-pointer select-none">
                    <span>Mantener sesión iniciada</span>
                    <input
                        type="checkbox"
                        checked={keepSession}
                        onChange={(e) => setKeepSession(e.target.checked)}
                        className="w-5 h-5 accent-accentBase"
                    />
                </label>

                <div className="flex flex-col gap-3">
                    {metodo === 'telefono' ? (
                        <>
                            {metodos.wh && (
                                <button
                                    type="button"
                                    onClick={() => handleSendOtp('whatsapp')}
                                    disabled={!phoneValid || sendingChannel !== null}
                                    className="w-full flex items-center justify-center gap-2 bg-[#082348] text-white font-normal py-3 px-4 rounded focus:outline-none disabled:opacity-60"
                                >
                                    <FaWhatsapp className="text-lg" />
                                    {sendingChannel === 'whatsapp' ? 'Enviando…' : 'Continuar con WhatsApp'}
                                </button>
                            )}
                            {metodos.sms && smsEnabled && (
                                <button
                                    type="button"
                                    onClick={() => handleSendOtp('sms')}
                                    disabled={!phoneValid || sendingChannel !== null}
                                    className="w-full flex items-center justify-center gap-2 border border-[#082348] text-[#082348] font-normal py-3 px-4 rounded focus:outline-none disabled:opacity-60"
                                >
                                    <FiMessageSquare className="text-lg" />
                                    {sendingChannel === 'sms' ? 'Enviando…' : 'Continuar con SMS'}
                                </button>
                            )}
                            {smsNotice && (
                                <p className="text-center text-xs text-amber-600">
                                    El envío por SMS no está disponible por ahora. Continúa con WhatsApp.
                                </p>
                            )}
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleSendOtp('email')}
                            disabled={!emailValid || sendingChannel !== null}
                            className="w-full flex items-center justify-center gap-2 bg-[#082348] text-white font-normal py-3 px-4 rounded focus:outline-none disabled:opacity-60"
                        >
                            <FiMail className="text-lg" />
                            {sendingChannel === 'email' ? 'Enviando…' : 'Continuar con Correo'}
                        </button>
                    )}
                </div>
                <p className="text-center text-xs text-gray-500 mt-3">
                    ¿Es tu primera vez? No te preocupes, tu cuenta se creará automáticamente al verificar el código.
                </p>
                <p className="text-center text-xs text-gray-500 mt-3">
                    Pueden aplicar tarifas de mensajes y datos. Ver <a href="/legales/terminos_y_condiciones" className="text-blue-600 hover:underline">Términos</a> y <a href="/legales/aviso_de_privacidad" className="text-blue-600 hover:underline">Política de Privacidad</a>.
                </p>
            </div>
        </>
    );
};
