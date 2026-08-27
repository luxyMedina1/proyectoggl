type Key = 'token' | 'resetToken' | 'keepSession';

const KEYS: Key[] = ['token', 'resetToken', 'keepSession'];

// Next.js hace SSR del primer render en el servidor, donde no existe `window`. Varios
// componentes migrados de la SPA leen el storage directo en el cuerpo del render (no en un
// useEffect) porque en Vite el primer render ya era client-side; aqui esas mismas llamadas
// se ejecutarian en el servidor sin este guard.
const isBrowser = () => typeof window !== 'undefined';

export const authStorage = {
    set: (key: Key, value: string, persist: boolean) => {
        if (!isBrowser()) return;
        const target = persist ? localStorage : sessionStorage;
        const other = persist ? sessionStorage : localStorage;
        target.setItem(key, value);
        other.removeItem(key);
    },
    get: (key: Key): string | null => {
        if (!isBrowser()) return null;
        return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    },
    remove: (key: Key) => {
        if (!isBrowser()) return;
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
    clearAuth: () => {
        if (!isBrowser()) return;
        KEYS.forEach((k) => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });
    },
    isPersistent: (): boolean => {
        if (!isBrowser()) return false;
        return localStorage.getItem('keepSession') === '1';
    },
};
