"use client";

import { ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "../store/store";
import { ColorConfigProvider } from "../context/ColorContext";
import { AuthModalProvider } from "../context/AuthModalContext";

export const Providers = ({ children }: { children: ReactNode }) => {
    return (
        <Provider store={store}>
            <ColorConfigProvider>
                <AuthModalProvider>
                    {children}
                </AuthModalProvider>
            </ColorConfigProvider>
        </Provider>
    );
};
