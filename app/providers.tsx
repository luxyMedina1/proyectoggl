"use client";

import { ReactNode, useRef } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "../store/store";
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
  // Una instancia por montaje (server: por request; client: por carga de página), no un
  // singleton de módulo — ver el comentario en store/store.ts.
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  return (
    <Provider store={storeRef.current}>
      <ColorConfigProvider
        configInicial={configInicial}
        coloresIniciales={coloresIniciales}
      >
        <AuthModalProvider>{children}</AuthModalProvider>
      </ColorConfigProvider>
    </Provider>
  );
};
