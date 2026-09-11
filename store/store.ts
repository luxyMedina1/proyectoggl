import { configureStore } from '@reduxjs/toolkit';
import authSlice from './auth/authSlice';
import appSlice from './app/appSlice';

// Fábrica, no singleton: en Next.js (App Router) este módulo se carga una sola vez
// por proceso de servidor, no por request. Un `export const store = configureStore(...)`
// a nivel de módulo comparte esa misma instancia mutable entre TODAS las peticiones SSR —
// si una request deja `auth.status` distinto de 'checking', la siguiente request hereda
// ese estado "sucio" en su render de servidor, mientras el navegador siempre arranca
// limpio en el primer paint. Eso produce un hydration mismatch en el header en cada carga
// (rama autenticada vs. no autenticada). `Providers` crea una instancia nueva por
// request/montaje con `makeStore()` (ver app/providers.tsx).
export const makeStore = () => configureStore({
    reducer: {
        auth: authSlice.reducer,
        app: appSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false,
    }),
});

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
