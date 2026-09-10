"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/publicUi/components/Loader";
import { useAuthStore } from "../../../hooks/useAuthStore";

// Reemplazo de src/public/components/ProtectedRoute.tsx: mismo modelo que V2
// (guardia del lado del cliente, no un limite de seguridad — el backend ya
// exige Bearer token en cada request).
//
// Sin redux-persist el store arranca en `checking` con `user` vacio en cada
// recarga, asi que este layout tiene que disparar `checkAuthToken()` el mismo
// (no basta con que lo haga el SiteLayout padre) y pintar un Loader mientras
// resuelve — antes hacia `return null` y se veia la pantalla en blanco.
export default function PerfilLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { checkAuthToken, status } = useAuthStore();

    useEffect(() => {
        if (status === "checking") {
            checkAuthToken();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/auth/login");
        }
    }, [status, router]);

    if (status !== "authenticated") {
        return <Loader />;
    }

    return <>{children}</>;
}
