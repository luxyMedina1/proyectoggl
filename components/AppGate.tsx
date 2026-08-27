"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader } from "./Loader";
import { useAuthStore } from "../hooks/useAuthStore";
import { useMetaPixel } from "../hooks/useMetaPixel";

export const AppGate = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useAuthStore();
  const { vistaDePagina } = useMetaPixel();

  // Es una SPA: sin esto Meta solo veria la primera pantalla que abrio el usuario.
  // El PageView de un pixel que se inicializa despues lo dispara el propio metaPixel.ts.
  useEffect(() => {
    vistaDePagina();
  }, [pathname, vistaDePagina]);

  useEffect(() => {
    if (
      status === "authenticated" &&
      user &&
      user.perfilCompleto === false &&
      pathname !== "/auth/completar_perfil"
    ) {
      router.replace("/auth/completar_perfil");
    }
  }, [status, user, pathname, router]);

  return (
    <>
      <Loader />
      {children}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  );
};
