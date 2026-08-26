"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../../hooks/useAuthStore";
import { useColorConfig } from "../../../context/ColorContext";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { config } = useColorConfig();
  const { checkAuthToken, status } = useAuthStore();

  useEffect(() => {
    if (status === 'checking') {
      checkAuthToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [status, router]);

  if (status === 'authenticated') {
    return null;
  }

  return (
    <div className="bg-white grid grid-cols-2 justify-center items-center min-h-screen">
      <div className='col-span-2 lg:col-span-1 h-auto lg:min-h-screen'>
        <div className='auth-bg p-5 md:p-8 lg:p-10 '>
          <Link href="/">
            <img className='mb-16' width={240} height={120} src={config?.logoMarca} alt="logo company" />
          </Link>
          <h1 className='text-white text-3xl lg:text-5xl font-semibold'>Bienvenido a tu acceso exclusivo a los mejores conciertos</h1>
          <p className='text-lg lg:text-xl text-gray-300 mt-10'>Accede con tu cuenta para descubrir, comprar boletos y disfrutar de experiencias únicas en conciertos y eventos en vivo.</p>
        </div>
      </div>
      <div className="p-5 md:p-8 lg:p-10 col-span-2 lg:col-span-1">
        {children}
      </div>
    </div>
  );
}
