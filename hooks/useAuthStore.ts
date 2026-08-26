import Swal from "sweetalert2";
import { useDispatch, useSelector } from "react-redux";
import { clearErrorMessage, onChangeLoaderStatus, onChecking, onLogin, onLogout } from "../store/auth/authSlice";
import apiApplication from "../api/apiApplication";
import { RootState } from "../store/store";
import { LoginRequestDTO } from "../types/LoginRequestDTO";
import { RegisterRequestDTO } from "../types/RegisterRequestDTO";
import { useAppStore } from "./useAppStore";
import { authStorage } from "../utils/authStorage";
import { clearAllSeeds } from "../utils/dynamicQr";

export type OtpChannel = 'whatsapp' | 'sms' | 'email';

export interface OtpMetodosActivos {
    wh: boolean;
    sms: boolean;
    email: boolean;
}

/** Construye el body de send/resend según el canal: email lleva `email`, el resto `telefono`. */
const buildOtpBody = (destino: string, canal: OtpChannel) =>
    canal === 'email' ? { email: destino, canal } : { telefono: destino, canal };

export interface OtpAuthResponse {
    user: any;
    perfilCompleto: boolean;
    isVerified: boolean;
    token: string;
    refreshToken: string | null;
}

export interface OtpSendResult {
    ok: boolean;
    /** true cuando el canal pedido (p. ej. SMS) no está disponible en backend */
    serviceUnavailable: boolean;
}

// Detecta el caso "service unavailable" del backend (503 o mensaje/código).
const isServiceUnavailable = (error: any): boolean => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const raw = `${data?.message ?? ''} ${data?.error ?? ''} ${data?.code ?? ''}`
        .toLowerCase()
        .replace(/[\s_-]/g, '');
    return status === 503 || raw.includes('serviceunavailable');
};

export const useAuthStore = () => {

    const dispatch = useDispatch();
    const { setLoaderStatus } = useAppStore();
    const { status, user, isVerified, errorMessage, loaderState } = useSelector((state: RootState) => state.auth);

    const persistTokens = (token: string, refreshToken: string | null | undefined, persist: boolean) => {
        authStorage.set('token', token, persist);
        if (refreshToken) authStorage.set('resetToken', refreshToken, persist);
        if (persist) {
            localStorage.setItem('keepSession', '1');
        } else {
            localStorage.removeItem('keepSession');
        }
    };

    const requestResetToken = async () => {
        try {
            const { data } = await apiApplication.get('/auth/get-reset-token');
            if (data?.success && data?.resetToken) {
                const persist = authStorage.isPersistent();
                authStorage.set('resetToken', data.resetToken, persist);
            }
        } catch (e) {
            console.warn('No se pudo obtener resetToken:', e);
        }
    };

    const getOtpMetodosActivos = async (): Promise<OtpMetodosActivos> => {
        try {
            const { data } = await apiApplication.get<OtpMetodosActivos>('/auth/otp/metodos-activos');
            return data;
        } catch (error) {
            console.error('Error obteniendo métodos de OTP activos:', error);
            // Fallback conservador: solo WhatsApp para no dejar el login sin opciones.
            return { wh: true, sms: false, email: false };
        }
    };

    const startSendOtp = async (destino: string, canal: OtpChannel = 'whatsapp'): Promise<OtpSendResult> => {
        dispatch(onChangeLoaderStatus(true));
        setLoaderStatus(true);
        try {
            await apiApplication.post('/auth/otp/send', buildOtpBody(destino, canal));
            return { ok: true, serviceUnavailable: false };
        } catch (error: any) {
            if (isServiceUnavailable(error)) {
                return { ok: false, serviceUnavailable: true };
            }
            const msg = error.response?.data?.message ?? 'No se pudo enviar el código';
            Swal.fire('Error', Array.isArray(msg) ? msg.join('\n') : msg, 'error');
            return { ok: false, serviceUnavailable: false };
        } finally {
            setLoaderStatus(false);
            dispatch(onChangeLoaderStatus(false));
        }
    };

    const startResendOtp = async (destino: string, canal: OtpChannel = 'whatsapp'): Promise<OtpSendResult> => {
        dispatch(onChangeLoaderStatus(true));
        setLoaderStatus(true);
        try {
            await apiApplication.post('/auth/otp/resend', buildOtpBody(destino, canal));
            return { ok: true, serviceUnavailable: false };
        } catch (error: any) {
            if (isServiceUnavailable(error)) {
                return { ok: false, serviceUnavailable: true };
            }
            const msg = error.response?.data?.message ?? 'No se pudo reenviar el código';
            Swal.fire('Error', Array.isArray(msg) ? msg.join('\n') : msg, 'error');
            return { ok: false, serviceUnavailable: false };
        } finally {
            setLoaderStatus(false);
            dispatch(onChangeLoaderStatus(false));
        }
    };

    const startValidateOtp = async (
        destino: string,
        codigo: string,
        mantenerSesion: boolean,
        canal: OtpChannel = 'whatsapp',
    ): Promise<OtpAuthResponse | null> => {
        dispatch(onChangeLoaderStatus(true));
        setLoaderStatus(true);
        try {
            const body = canal === 'email' ? { email: destino, codigo } : { telefono: destino, codigo };
            const { data } = await apiApplication.post<OtpAuthResponse>('/auth/otp/validate', body);
            persistTokens(data.token, data.refreshToken, mantenerSesion);
            const userWithFlag = { ...data.user, perfilCompleto: data.perfilCompleto };
            dispatch(onLogin({ user: userWithFlag, token: data.token, isVerified: data.isVerified }));
            if (data.perfilCompleto) {
                await requestResetToken();
            }
            return data;
        } catch (error: any) {
            const msg = error.response?.data?.message ?? 'No se pudo validar el código';
            Swal.fire('Error', Array.isArray(msg) ? msg.join('\n') : msg, 'error');
            return null;
        } finally {
            setLoaderStatus(false);
            dispatch(onChangeLoaderStatus(false));
        }
    };

    const completarPerfilOTP = async (
        payload: { email?: string; telefono?: string; fullName: string },
    ): Promise<OtpAuthResponse | null> => {
        dispatch(onChangeLoaderStatus(true));
        setLoaderStatus(true);
        try {
            const { data } = await apiApplication.patch<OtpAuthResponse>('/auth/otp/update', payload);
            const persist = authStorage.isPersistent();
            persistTokens(data.token, data.refreshToken, persist);
            const userWithFlag = { ...data.user, perfilCompleto: data.perfilCompleto };
            dispatch(onLogin({ user: userWithFlag, token: data.token, isVerified: data.isVerified }));
            await requestResetToken();
            return data;
        } catch (error: any) {
            const msg = error.response?.data?.message ?? 'No se pudo completar el perfil';
            Swal.fire('Error', Array.isArray(msg) ? msg.join('\n') : msg, 'error');
            return null;
        } finally {
            setLoaderStatus(false);
            dispatch(onChangeLoaderStatus(false));
        }
    };

    const startLogin = async(body: LoginRequestDTO) => {
        dispatch( onChecking() );
        dispatch( onChangeLoaderStatus(true) );
        setLoaderStatus(true);
        try {
            const { data } = await apiApplication.post('/auth/login',body);
            persistTokens(data.token, data.refreshToken ?? null, true);
            dispatch( onLogin(data) );
            await requestResetToken();
        } catch (error: any) {
            if (error.response) {
                const { message } = error.response.data;
                if (message && Array.isArray(message)) {
                    Swal.fire('Error', message.join('\n'), 'error');
                } else {
                    Swal.fire('Error', error.response.data.message, 'error');
                }
                dispatch(onLogout('Credenciales incorrectas'));
            } else {
                Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
            }
         } finally {
            setLoaderStatus(false);
            dispatch( onChangeLoaderStatus(false) );
        }
    }

    const startRegister = async (body: RegisterRequestDTO) => {
        dispatch(onChecking());
        dispatch(onChangeLoaderStatus(true));
        setLoaderStatus(true);

        try {
            const { repeatedPassword, ...datos } = body;

            const { data } = await apiApplication.post('/auth/register', datos);

            if (!data || !data.token) {
                throw new Error("Error en el registro, no se recibió token.");
            }

            const correoEnviado = await enviarCorreoVerificacion(datos.email);

            if (!correoEnviado) {
                throw new Error("No se pudo enviar el correo de verificación.");
            }

            persistTokens(data.token, data.refreshToken ?? null, true);

            dispatch(onLogin(data));
            await requestResetToken();

        } catch (error: any) {
            if (error.response) {
                const { message } = error.response.data;
                Swal.fire('Error', Array.isArray(message) ? message.join('\n') : message, 'error');
                dispatch(onLogout('Credenciales incorrectas'));
            } else {
                Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
            }
        } finally {
            setLoaderStatus(false);
            dispatch(onChangeLoaderStatus(false));
        }
    };

    const enviarCorreoVerificacion = async (email: string): Promise<boolean> => {
        try {
            const response = await apiApplication.post(`/correos/send-verification-email/${email}`);
            console.log(response);
            if (response.status !== 200) {
                throw new Error(`Error en la respuesta del servidor: ${response.status}`);
            }

            console.log("Correo de verificación enviado con éxito");
            Swal.fire("Verificación", "Se ha enviado un correo de verificación. Revisa tu bandeja de entrada.", "info");
            return true;

        } catch (error) {
            console.error("Error al enviar correo:", error);
            Swal.fire("Error", "Hubo un problema al enviar el correo de verificación.", "error");
            return false;
        }
    };


    const checkAuthToken = async () => {
        const token = authStorage.get('token');

        if (!token) {
            dispatch(onLogout(undefined));
            return;
        }

        dispatch(onChangeLoaderStatus(true));

        try {
            const { data } = await apiApplication.get('/auth/check-status');

            if (data.isVerified === false) {
                Swal.fire({
                    icon: "warning",
                    title: "Verificación requerida",
                    text: "Debes verificar tu correo para acceder. Revisa tu bandeja de entrada y sigue las instrucciones en el email de verificación.",
                    confirmButtonText: "Entendido",
                });

                throw new Error("Usuario no verificado");
            }

            if (data.token) {
                const persist = authStorage.isPersistent();
                authStorage.set('token', data.token, persist);
            }

            dispatch(onLogin(data));
        } catch (error: any) {
            console.error("Error en checkAuthToken:", error);

            if (error.message === "Usuario no verificado") {
                Swal.fire({
                    icon: "warning",
                    title: "Verificación requerida",
                    text: "Debes verificar tu correo para acceder. Revisa tu bandeja de entrada y sigue las instrucciones en el email de verificación.",
                    confirmButtonText: "Entendido",
                });
            }

            authStorage.clearAuth();

            dispatch(onLogout('Se ha cerrado la sesión'));

            setTimeout(() => dispatch(clearErrorMessage()), 10);
        } finally {
            dispatch(onChangeLoaderStatus(false));
        }
    };

    const showLoader = (status: boolean) => {
        dispatch( onChangeLoaderStatus(status) );
        setLoaderStatus(false);
    }

    const startLogout = () => {
        authStorage.clearAuth();
        clearAllSeeds();
        dispatch( onLogout(undefined) );
        setLoaderStatus(false);
    }

    const checkOAuthAvailability = async () => {
        const {data} = await apiApplication.get('/auth/oauth2/get-actives');
        return data;
    }

    const getOauthPublicKeys = async () => {
        const {data} = await apiApplication.get('/auth/oauth2/get-public-keys');
        return data;
    }

    const loginWithGoogle = async (credential: string) => {
        try {
            dispatch(onChecking());
            dispatch(onChangeLoaderStatus(true));
            setLoaderStatus(true);

            const response = await apiApplication.post('/auth/google', {
                token: credential
            });

            if (response.data.token) {
                persistTokens(response.data.token, response.data.refreshToken ?? null, true);

                dispatch(onLogin(response.data));
                await requestResetToken();

                console.log('✅ Login con Google exitoso');
                Swal.fire({
                    icon: 'success',
                    title: '¡Bienvenido!',
                    text: `Hola ${response.data.user.fullName}, has iniciado sesión correctamente.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error('No se recibió token del servidor');
            }

        } catch (error: any) {
            console.error('❌ Error en loginWithGoogle:', error);

            let errorMessage = 'Error al procesar el login con Google';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            Swal.fire('Error', errorMessage, 'error');
            dispatch(onLogout('Error en login con Google'));
        } finally {
            setLoaderStatus(false);
            dispatch(onChangeLoaderStatus(false));
        }
    }

    const loginWithApple = async (payload: {id_token:string, code:string, user:{firstName:string, lastName:string}}) => {
        try {
            dispatch(onChecking());
            dispatch(onChangeLoaderStatus(true));
            setLoaderStatus(true);

            const response = await apiApplication.post('/auth/apple/verify', payload);

            if (response.data.token) {
                persistTokens(response.data.token, response.data.refreshToken ?? null, true);

                dispatch(onLogin(response.data));
                await requestResetToken();

                console.log('✅ Login con Apple exitoso');
                Swal.fire({
                    icon: 'success',
                    title: '¡Bienvenido!',
                    text: `Hola ${response.data.user.fullName}, has iniciado sesión correctamente.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                throw new Error('No se recibió token del servidor');
            }
        } catch (error: any) {
            console.error('❌ Error en loginWithApple:', error);

            let errorMessage = 'Error al procesar el login con Apple';
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error.message) {
                errorMessage = error.message;
            }

            Swal.fire('Error', errorMessage, 'error');
            dispatch(onLogout('Error en login con Apple'));
        } finally {
            setLoaderStatus(false);
            dispatch(onChangeLoaderStatus(false));
        }
    }

    return {
        //* Propiedades
        status,
        user,
        isVerified,
        errorMessage,
        loaderState,
        //* Métodos
        showLoader,
        checkAuthToken,
        startLogin,
        startLogout,
        startRegister,
        checkOAuthAvailability,
        getOauthPublicKeys,
        loginWithGoogle,
        loginWithApple,
        getOtpMetodosActivos,
        startSendOtp,
        startResendOtp,
        startValidateOtp,
        completarPerfilOTP,
        requestResetToken,
    }

}
