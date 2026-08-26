import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { authStorage } from '../utils/authStorage';

const getBackendUrl = () => {
    let uri = '';
    const url = process.env.NEXT_PUBLIC_URL_BACKEND;
    if (!url) {
        console.warn('Backend URL not set in .env. Using default.')
        uri = '/api/v1'//poner segun el context path de la aplicacion en produccion
    } else {
        uri = url+'/api/v1'
    }
    return uri
}

const apiApplication = axios.create({
    baseURL: getBackendUrl()
})

const SKIP_REFRESH_URLS = [
    '/auth/refresh-token',
    '/auth/otp/send',
    '/auth/otp/resend',
    '/auth/otp/validate',
    '/auth/login',
    '/auth/register',
    '/auth/google',
    '/auth/apple/verify',
];

const shouldSkipRefresh = (url?: string) => {
    if (!url) return true;
    return SKIP_REFRESH_URLS.some((u) => url.includes(u));
};

apiApplication.interceptors.request.use((config) => {
    const token = authStorage.get('token');
    const apiKey = process.env.NEXT_PUBLIC_API_KEY;
    const isRefresh = config.url?.includes('/auth/refresh-token');
    if (token && !isRefresh) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (apiKey) {
        config.headers['x-api-key'] = apiKey;
    }
    return config;
})

interface RetriableConfig extends AxiosRequestConfig {
    _retry?: boolean;
}

let refreshInFlight: Promise<string> | null = null;

const performRefresh = async (): Promise<string> => {
    const resetToken = authStorage.get('resetToken');
    if (!resetToken) throw new Error('No reset token');
    const persist = authStorage.isPersistent();
    const { data } = await apiApplication.post('/auth/refresh-token', { resetToken });
    if (!data?.token) throw new Error('Refresh failed');
    authStorage.set('token', data.token, persist);
    if (data.refreshToken) authStorage.set('resetToken', data.refreshToken, persist);
    return data.token;
};

apiApplication.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as RetriableConfig | undefined;
        if (!error.response || !original) return Promise.reject(error);
        if (error.response.status !== 401) return Promise.reject(error);
        if (original._retry) return Promise.reject(error);
        if (shouldSkipRefresh(original.url)) return Promise.reject(error);
        if (!authStorage.get('resetToken')) return Promise.reject(error);

        original._retry = true;
        try {
            if (!refreshInFlight) {
                refreshInFlight = performRefresh().finally(() => {
                    refreshInFlight = null;
                });
            }
            const newToken = await refreshInFlight;
            original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
            return apiApplication(original);
        } catch (e) {
            authStorage.clearAuth();
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
                window.location.href = '/auth/login';
            }
            return Promise.reject(e);
        }
    }
);

export default apiApplication;
