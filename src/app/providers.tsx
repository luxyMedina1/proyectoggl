'use client';

import { StoreProvider } from '@/lib/store/StoreProvider';

// TODO(auth-phase): mount <Loader/> / <AuthModalProvider> / <ToastContainer/> here,
// same position they occupy around the router <Outlet/> in v2's App.tsx.
export function Providers({ children }: { children: React.ReactNode }) {
    return <StoreProvider>{children}</StoreProvider>;
}
