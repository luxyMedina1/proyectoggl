"use client";

import { ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "../store/store";
import { ColorConfigProvider } from "../context/ColorContext";
import type { ConfigResponse } from "../context/ColorContext";
import type { BrandColors } from "@/lib/config/getSiteConfig";
import { AuthModalProvider } from "../context/AuthModalContext";

export const Providers = ({
  children,
  configInicial,
  coloresIniciales,
}: {
  children: ReactNode;
  configInicial: ConfigResponse | null;
  coloresIniciales: BrandColors;
}) => {
  return (
    <Provider store={store}>
      <ColorConfigProvider
        configInicial={configInicial}
        coloresIniciales={coloresIniciales}
      >
        <AuthModalProvider>{children}</AuthModalProvider>
      </ColorConfigProvider>
    </Provider>
  );
};
