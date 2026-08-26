import 'client-only';

type Key = 'token' | 'resetToken' | 'keepSession';
const KEYS: Key[] = ['token', 'resetToken', 'keepSession'];

const hasWindow = () => typeof window !== 'undefined';

export const authStorage = {
    set: (key: Key, value: string, persist: boolean) => {
        if (!hasWindow()) return;
        const target = persist ? localStorage : sessionStorage;
        const other = persist ? sessionStorage : localStorage;
        target.setItem(key, value);
        other.removeItem(key);
    },
    get: (key: Key): string | null => {
        if (!hasWindow()) return null;
        return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    },
    remove: (key: Key) => {
        if (!hasWindow()) return;
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
    clearAuth: () => {
        if (!hasWindow()) return;
        KEYS.forEach((k) => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });
    },
    isPersistent: (): boolean => {
        return hasWindow() && localStorage.getItem('keepSession') === '1';
    },
};
