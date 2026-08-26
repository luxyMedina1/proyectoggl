import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          disableAutoSelect: () => void;
        };
        oauth2: {
          initCodeClient: (config: any) => any;
          hasGrantedAllScopes: (tokenResponse: any, ...scopes: string[]) => boolean;
        };
      };
    };
  }
}

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

interface UseGoogleAuthProps {
  clientId: string;
  onSuccess: (tokenResponse: any, userInfo: GoogleUser) => void;
  onError: (error: any) => void;
}

export const useGoogleAuth = ({ clientId, onSuccess, onError }: UseGoogleAuthProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const handleCredentialResponse = useCallback(async (response: any) => {
    console.log('🔑 Respuesta de credencial de Google:', response);

    if (response.credential) {
      try {
        setIsLoading(true);

        // Función auxiliar para decodificar JWT
        const parseJwt = (token: string): GoogleUser => {
          try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            return JSON.parse(jsonPayload);
          } catch (error) {
            console.error('❌ Error al decodificar JWT:', error);
            throw new Error('Token JWT inválido');
          }
        };

        // Decodificar el JWT token para obtener la información del usuario
        const userInfo = parseJwt(response.credential);
        console.log('👤 Información del usuario:', userInfo);

        // Crear el token response object
        const tokenResponse = {
          credential: response.credential,
          select_by: response.select_by,
        };

        onSuccess(tokenResponse, userInfo);
      } catch (error) {
        console.error('❌ Error al procesar la respuesta de Google:', error);
        onError(error);
      } finally {
        setIsLoading(false);
      }
    } else {
      onError(new Error('No se recibió credencial de Google'));
    }
  }, [onSuccess, onError]);

  useEffect(() => {
    if (!clientId) {
      console.error('❌ Client ID de Google no configurado en variables de entorno');
      onError(new Error('Client ID de Google no configurado'));
      return;
    }

    let initAttempts = 0;
    const maxAttempts = 50; // 5 segundos máximo

    const initializeGoogleAuth = () => {
      initAttempts++;

      if (window.google?.accounts?.id) {
        try {
          console.log('🔧 Inicializando Google Identity Services...');
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            use_fedcm_for_prompt: true,
            ux_mode: 'popup',
            prompt_parent_id: 'g_id_onload'
          });
          setIsInitialized(true);
          console.log('✅ Google Identity Services inicializado correctamente');
        } catch (error) {
          console.error('❌ Error inicializando Google Auth:', error);
          onError(error);
        }
      } else if (initAttempts < maxAttempts) {
        console.log(`⌛ Esperando Google Identity Services... (${initAttempts}/${maxAttempts})`);
        setTimeout(initializeGoogleAuth, 100);
      } else {
        console.error('❌ Timeout: No se pudo cargar Google Identity Services');
        onError(new Error('No se pudo cargar Google Identity Services'));
      }
    };

    initializeGoogleAuth();
  }, [clientId, handleCredentialResponse, onError]);

  const login = useCallback(() => {
    if (!isInitialized) {
      console.warn('⚠️ Google Auth no está inicializado');
      onError(new Error('Google Auth no está inicializado'));
      return;
    }

    if (!clientId) {
      console.error('❌ Client ID de Google no configurado');
      onError(new Error('Client ID de Google no configurado'));
      return;
    }

    setIsLoading(true);
    console.log('🚀 Iniciando login con Google...');

    // Usar un timeout para manejar el caso donde el prompt no aparece
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout del popup de Google');
      setIsLoading(false);
      onError(new Error('Timeout en el login de Google'));
    }, 10000); // 10 segundos de timeout

    try {

      if (!window.google?.accounts?.id) {
        Swal.fire({
          icon: 'warning',
          title: 'Google Login bloqueado',
          text: 'Desactiva bloqueadores de anuncios o usa otro navegador para iniciar sesión con Google.'
        });
        return;
      }


      window.google!.accounts.id.disableAutoSelect();
      window.google!.accounts.id.prompt((notification: any) => {
        clearTimeout(timeoutId);
        console.log('📢 Notificación de Google:', notification);

        if (notification.j === "suppressed_by_user") {
          // Notifica al usuario
          Swal.fire({
            icon: 'info',
            title: 'Inicio de sesión cancelado',
            text: 'Cerraste el popup de Google. Espera unos minutos o recarga la página para volver a intentarlo.'
          });
          return;
        }

        if (notification.isNotDisplayed()) {
          console.log('⏭️ Popup de Google no mostrado');
          setIsLoading(false);
          onError(new Error('El popup de Google no se pudo mostrar. Verifica la configuración del dominio.'));
        } else if (notification.isSkippedMoment()) {
          console.log('⏭️ Popup de Google saltado');
          setIsLoading(false);
          onError(new Error('Login con Google fue saltado'));
        } else if (notification.isDismissedMoment()) {
          console.log('❌ Usuario cerró el popup de Google');
          setIsLoading(false);
          onError(new Error('Usuario canceló el login'));
        }
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ Error al mostrar prompt de Google:', error);
      setIsLoading(false);
      onError(error);
    }
  }, [isInitialized, clientId, onError]);

  return {
    login,
    isLoading,
    isInitialized,
  };
};
