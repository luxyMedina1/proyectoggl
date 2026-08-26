"use client";

import { createContext, useContext, useRef, useState, ReactNode } from 'react';
import { IoClose } from 'react-icons/io5';
import { LoginForm } from '../auth/components/LoginForm';

interface AuthModalContextType {
    // Abre el modal de login y resuelve true si el usuario inició sesión, false si lo cerró.
    requestLogin: () => Promise<boolean>;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

export const AuthModalProvider = ({ children }: { children: ReactNode }) => {
    const [abierto, setAbierto] = useState(false);
    const resolverRef = useRef<((valor: boolean) => void) | null>(null);

    const requestLogin = () =>
        new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
            setAbierto(true);
        });

    const cerrar = (resultado: boolean) => {
        setAbierto(false);
        resolverRef.current?.(resultado);
        resolverRef.current = null;
    };

    return (
        <AuthModalContext.Provider value={{ requestLogin }}>
            {children}
            {abierto && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
                    onClick={() => cerrar(false)}
                >
                    <div
                        className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-1 flex justify-end">
                            <button type="button" onClick={() => cerrar(false)} aria-label="Cerrar">
                                <IoClose className="text-3xl text-gray-400 transition-colors hover:text-gray-600" />
                            </button>
                        </div>
                        <LoginForm onAuthenticated={() => cerrar(true)} />
                    </div>
                </div>
            )}
        </AuthModalContext.Provider>
    );
};

export const useAuthModal = (): AuthModalContextType => {
    const context = useContext(AuthModalContext);
    if (!context) {
        throw new Error('useAuthModal debe usarse dentro de un AuthModalProvider');
    }
    return context;
};
