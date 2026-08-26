'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/lib/store/hooks';

export function RequireAuth({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const user = useAppSelector((s) => s.auth.user);

    useEffect(() => {
        if (!user) router.replace('/auth/login');
    }, [user, router]);

    if (!user) return null;
    return <>{children}</>;
}
