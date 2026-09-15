"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader } from "./Loader";
import { useAuthStore } from "../hooks/useAuthStore";
import { useMetaPixel } from "../hooks/useMetaPixel";
import { useAuthModal } from "../context/AuthModalContext";

export const AppGate = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useAuthStore();
  const { vistaDePagina } = useMetaPixel();
  const { estaAbierto: modalAbierto } = useAuthModal();

  // Es una SPA: sin esto Meta solo veria la primera pantalla que abrio el usuario.
  // El PageView de un pixel que se inicializa despues lo dispara el propio metaPixel.ts.
  useEffect(() => {
    vistaDePagina();
  }, [pathname, vistaDePagina]);

  // El modal de login (AuthModalContext) resuelve el perfil incompleto el mismo
  // inline cuando el login viene de ahi (comprar, dar like, etc.) — sin navegar,
  // para no perder la pagina donde estaba el usuario. Si este efecto navegara de
  // todos modos apenas detecta perfilCompleto=false, la pagina de fondo cambiaria
  // a /auth/completar_perfil mientras el modal sigue flotando encima resolviendo
  // lo mismo: las dos pantallas encimadas. Por eso se salta mientras el modal
  // esta abierto; si el usuario lo cierra sin completar, este efecto retoma el
  // control en el siguiente render (modalAbierto vuelve a false).
  useEffect(() => {
    if (
      status === "authenticated" &&
      user &&
      user.perfilCompleto === false &&
      pathname !== "/auth/completar_perfil" &&
      !modalAbierto
    ) {
      router.replace("/auth/completar_perfil");
    }
  }, [status, user, pathname, router, modalAbierto]);

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
