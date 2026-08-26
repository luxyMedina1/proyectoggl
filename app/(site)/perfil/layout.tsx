"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../../hooks/useAuthStore";

// Reemplazo de src/public/components/ProtectedRoute.tsx: mismo modelo que V2
// (guardia del lado del cliente, no un limite de seguridad — el backend ya
// exige Bearer token en cada request).
export default function PerfilLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { user, status } = useAuthStore();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.replace('/auth/login');
        }
    }, [status, router]);

    if (!user) {
        return null;
    }

    return <>{children}</>;
}
