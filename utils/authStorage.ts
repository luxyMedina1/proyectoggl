type Key = 'token' | 'resetToken' | 'keepSession';

const KEYS: Key[] = ['token', 'resetToken', 'keepSession'];

export const authStorage = {
    set: (key: Key, value: string, persist: boolean) => {
        const target = persist ? localStorage : sessionStorage;
        const other = persist ? sessionStorage : localStorage;
        target.setItem(key, value);
        other.removeItem(key);
    },
    get: (key: Key): string | null => {
        return localStorage.getItem(key) ?? sessionStorage.getItem(key);
    },
    remove: (key: Key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
    clearAuth: () => {
        KEYS.forEach((k) => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        });
    },
    isPersistent: (): boolean => {
        return localStorage.getItem('keepSession') === '1';
    },
};
