"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../hooks/useAuthStore";
import { useAmigosStore } from "../../hooks/useAmigosStore";
import { useTransferenciasStore } from "../../hooks/useTransferenciasStore";
import { useCiudadesStore } from "../../hooks/useCiudadesStore";
import { BsTwitterX, BsFacebook, BsInstagram } from "react-icons/bs";
import { IoChevronDownOutline } from "react-icons/io5";
import { TbLogout } from "react-icons/tb";
import { LuUserRound } from "react-icons/lu";
import { MdOutlineEmail, MdPhone, MdLocationOn, MdExplore } from "react-icons/md";
import { HiMenu } from "react-icons/hi";
import { useColorConfig } from "../../context/ColorContext";
import { HeaderBuscador } from "../../components/HeaderBuscador";
import { onNotifRefresh } from "../../utils/notifEvents";
import { slugify } from "../../utils/slugify";
import type { Ciudad } from "../../types/Ciudad";

const NOTIF_POLL_MS = 60_000;

// NOTA: version simplificada de HeaderLayout. El selector de ciudad/CityPass y el
// badge de notificaciones (amigos/transferencias) dependen de modulos que aun no
// se migran (citypass, amigos, transferencias) — llegan en la Fase 4. El buscador
// (HeaderBuscador) si esta portado desde la Fase 2, pero sin ciudades disponibles
// (useCiudadesStore no portado) el select de ciudad queda vacio y el boton de
// CityPass deshabilitado hasta esa fase.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { config } = useColorConfig();
  const { checkAuthToken, startLogout, user, status } = useAuthStore();
  const { getSolicitudesRecibidas } = useAmigosStore();
  const { getPendientesRecibidas } = useTransferenciasStore();
  const { getAllCiudades } = useCiudadesStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [ciudadId, setCiudadId] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Placeholder hasta la Fase 4 (useCiudadesStore + citypass): con ciudades vacio
  // el boton queda deshabilitado (cityPassDisponible=false) y nunca se dispara.
  const irCityPass = () => {
    const destino = ciudades.find((c) => String(c.id) === ciudadId) ?? ciudades[0];
    if (!destino) return;
    router.push(`/citypass/${slugify(destino.nombre)}`);
  };

  useEffect(() => {
    let activo = true;
    getAllCiudades()
      .then((data) => { if (activo) setCiudades(data); })
      .catch((error) => console.error('Error cargando ciudades:', error));
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "checking") {
      checkAuthToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      setNotifCount(0);
      return;
    }

    let active = true;
    const fetchCount = async () => {
      if (document.hidden) return;
      const [amigos, transferencias] = await Promise.allSettled([
        getSolicitudesRecibidas(),
        getPendientesRecibidas(),
      ]);
      if (!active) return;
      const amigosCount = amigos.status === 'fulfilled' ? amigos.value.length : 0;
      const transferCount = transferencias.status === 'fulfilled' ? transferencias.value.length : 0;
      setNotifCount(amigosCount + transferCount);
    };

    fetchCount();
    const id = window.setInterval(fetchCount, NOTIF_POLL_MS);
    const offNotif = onNotifRefresh(fetchCount);
    return () => {
      active = false;
      window.clearInterval(id);
      offNotif();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.email]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <main className='min-h-screen bg-gray-50'>
      <header className="bg-gradient-to-r from-accentBase to-emphasis lg:h-24">
        <div className='container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 py-3 flex flex-row items-center justify-between h-inherit'>
          <div className="flex flex-shrink-0 items-center gap-x-2 md:gap-x-4">
            <Link className='w-28 sm:w-36 md:w-auto flex-shrink-0' href="/">
              <img
                width={170}
                height={90}
                src={config?.logoMarca}
                alt="Logo"
                className="cursor-pointer aspect-video w-full md:w-[170px] h-auto max-w-none"
                style={{ objectFit: 'contain' }}
              />
            </Link>
            <Link
              href="/explorar"
              aria-label="Explorar reels"
              className="flex flex-shrink-0 items-center gap-x-1.5 rounded-full bg-[var(--color-explore)] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95 md:gap-x-2 md:px-4 md:text-base"
            >
              Explorar
              <MdExplore className="text-lg" />
            </Link>
          </div>
          {/* Buscador + ciudad + CityPass (desktop). Siempre visible. */}
          <div className="hidden lg:flex flex-1 justify-center px-4">
            <HeaderBuscador
              className="w-full max-w-lg"
              ciudades={ciudades}
              ciudadId={ciudadId}
              onCiudadChange={setCiudadId}
              onCityPass={irCityPass}
              cityPassDisponible={ciudades.length > 0}
            />
          </div>
          {status === 'unauthenticated' ? (
            <>
              <div className='hidden md:flex items-center justify-end flex-1 flex-wrap text-neutral gap-x-4'>
                <Link href="/auth/login" className="text-lg border-b-2 border-transparent hover:border-white transition-all">Iniciar Sesión</Link>
              </div>
              <button
                className="md:hidden ml-auto text-neutral"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menú"
              >
                <HiMenu size={32} />
              </button>
              {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex">
                  <div className="bg-white w-64 h-full shadow-lg p-6 flex flex-col gap-y-4">
                    <button
                      className="self-end mb-4 text-gray-500"
                      onClick={() => setMobileMenuOpen(false)}
                      aria-label="Cerrar menú"
                    >
                      ✕
                    </button>
                    <Link
                      href="/auth/login"
                      className="text-base border-b-2 border-transparent hover:border-accentBase transition-all py-2"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Iniciar Sesión
                    </Link>
                  </div>
                  <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="hidden md:flex relative items-center mb-1 ml-auto md:ml-0">
                <Link href="/perfil/mis_compras" className='text-neutral px-4 py-2 rounded-t-md border-b-2 border-transparent hover:bg-accent-emphasis hover:border-b-2 hover:border-accentLight transition-colors mr-4' >
                  Mis eventos
                </Link>
                <button
                  onClick={() => setMenuVisible(!menuVisible)}
                  className="relative bg-emphasis text-neutral px-4 inline-flex items-center gap-x-2 py-2 rounded-md transition-colors"
                >
                  <IoChevronDownOutline /> {user?.fullName}
                </button>
                {menuVisible && (
                  <div ref={menuRef} className="absolute right-0 top-14 lg:top-10 mt-2 w-60 bg-white rounded-lg shadow-lg z-10">
                    <Link href="/perfil/mi_perfil" className="flex items-center gap-x-2 w-full text-left p-2 text-gray-600 hover:bg-gray-200 rounded-t-lg">
                      <LuUserRound className='text-2xl' />Mi perfil
                    </Link>
                    <button className="w-full text-left p-2 text-gray-600 hover:bg-gray-200 flex items-center gap-x-2" onClick={startLogout}>
                      <TbLogout className='text-2xl' /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
              <button
                className="relative md:hidden ml-auto text-neutral"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menú"
              >
                <HiMenu size={32} />
              </button>
              {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex">
                  <div className="bg-white w-64 h-full shadow-lg p-6 flex flex-col gap-y-4">
                    <button
                      className="self-end mb-4 text-gray-500"
                      onClick={() => setMobileMenuOpen(false)}
                      aria-label="Cerrar menú"
                    >
                      ✕
                    </button>
                    <div className="flex flex-col gap-y-2">
                      <span className="font-semibold text-accentBase mb-2">{user?.fullName}</span>
                      <Link
                        href="/perfil/mis_compras"
                        className="text-base border-b-2 border-transparent hover:border-accentBase transition-all py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Mis eventos
                      </Link>
                      <Link
                        href="/perfil/mi_perfil"
                        className="text-base border-b-2 border-transparent hover:border-accentBase transition-all py-2 flex items-center gap-x-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <LuUserRound className='text-xl' /> Mi perfil
                      </Link>
                      <button
                        className="text-base border-b-2 border-transparent hover:border-accentBase transition-all py-2 flex items-center gap-x-2 text-left"
                        onClick={() => { setMobileMenuOpen(false); startLogout(); }}
                      >
                        <TbLogout className='text-xl' /> Cerrar sesión
                      </button>
                    </div>
                  </div>
                  <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
                </div>
              )}
            </>
          )}
        </div>
        {/* Buscador + ciudad + CityPass (móvil/tablet). Siempre visible. */}
        <div className="lg:hidden container mx-auto px-4 md:px-5 pb-3">
          <HeaderBuscador
            className="w-full"
            ciudades={ciudades}
            ciudadId={ciudadId}
            onCiudadChange={setCiudadId}
            onCityPass={irCityPass}
            cityPassDisponible={ciudades.length > 0}
          />
        </div>
      </header>

      {children}

      <footer className='bg-gradient-to-r from-accentBase to-emphasis py-8'>
        <div className="container mx-auto px-4 md:hidden grid grid-cols-1 gap-6 text-neutral">
          <div className="flex flex-col items-center justify-center">
            <img className='mb-5' width={170} height={90} src={config?.logoMarca} alt="logo empresa" />
            <p className='text-sm font-light text-center'>Descarga nuestras aplicaciones</p>
            <div className='flex items-center gap-x-2 mt-3 justify-center'>
              <img width={100} height={90} src="/app_store.png" alt="App Store" />
              <img width={100} height={90} src="/google_play.png" alt="Google Play" />
            </div>
          </div>
          {(config?.urlTwitter || config?.urlFacebook || config?.urlInstagram) && (
            <div>
              <p className="text-2xl mb-5 text-center">Redes sociales</p>
              <ul className="grid grid-cols-2 gap-3 text-sm font-light">
                {config?.urlTwitter && (
                  <li>
                    <a href={config.urlTwitter} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-x-2 py-1 px-2 glass-effect rounded-lg justify-center w-full">
                      <BsTwitterX className="text-lg flex-none w-5" /> X
                    </a>
                  </li>
                )}
                {config?.urlFacebook && (
                  <li>
                    <a href={config.urlFacebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-x-2 py-1 px-2 glass-effect rounded-lg justify-center w-full">
                      <BsFacebook className="text-lg flex-none w-5" /> Facebook
                    </a>
                  </li>
                )}
                {config?.urlInstagram && (
                  <li>
                    <a href={config.urlInstagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-x-2 py-1 px-2 glass-effect rounded-lg justify-center w-full">
                      <BsInstagram className="text-lg flex-none w-5" /> Instagram
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
          <div>
            <p className='text-2xl mb-5 text-center'>Legal</p>
            <ul className='grid grid-cols-2 gap-3 text-sm font-light'>
              <Link href="/legales/aviso_de_privacidad" className="text-center">Aviso de privacidad</Link>
              <Link href="/legales/nuestras_politicas" className="text-center">Nuestras políticas</Link>
              <Link href="/legales/terminos_y_condiciones" className="col-span-2 text-center">Términos y condiciones</Link>
              <Link href="/legales/eliminacion_de_cuenta" className="col-span-2 text-center">Eliminar cuenta app</Link>
            </ul>
          </div>
          {(config?.direccionContacto || config?.emailContacto || config?.telefonoContacto) && (
            <div>
              <p className="text-2xl mb-5 text-center">Contacto</p>
              <ul className="grid grid-cols-3 gap-3 text-sm font-light">
                {config?.direccionContacto && (
                  <li className="flex flex-col col-span-3 items-center gap-y-1">
                    <MdLocationOn className="text-xl w-5 flex-none" />
                    <span className="text-center">{config.direccionContacto}</span>
                  </li>
                )}
                {config?.emailContacto && (
                  <li className="flex flex-col col-span-2 items-center gap-y-1">
                    <MdOutlineEmail className="text-xl w-5 flex-none" />
                    <span className="text-center">{config.emailContacto}</span>
                  </li>
                )}
                {config?.telefonoContacto && (
                  <li className="flex flex-col items-center gap-y-1">
                    <MdPhone className="text-xl w-5 flex-none" />
                    <span className="text-center">{config.telefonoContacto}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
          <div className='border-t border-neutral pt-4 mt-3 text-sm font-light text-center'>
            <p className="max-w-2xl mx-auto">
              {config?.mensajeFooter ? (
                <>{config?.mensajeFooter}</>
              ) : (
                <>Consulta nuestros avisos de privacidad, asi como nuestras politicas. Conoce nuestros eventos y siguenos en nuestras redes sociales para mayor información.</>
              )}
            </p>
          </div>
        </div>
        <div className='container mx-auto px-4 md:px-5 lg:px-8 2xl:px-20 hidden md:grid grid-cols-4 gap-3 text-neutral'>
          <div className='col-span-4 md:col-span-1'>
            <img className='mb-5' width={170} height={90} src={config?.logoMarca} alt="logo empresa" />
            <p className='text-sm font-light'>Descarga nuestras aplicaciones</p>
            <div className='flex items-center gap-x-2 mt-3'>
              <img width={100} height={90} src="/app_store.png" alt="App Store" />
              <img width={100} height={90} src="/google_play.png" alt="Google Play" />
            </div>
          </div>
          <div className="col-span-4 md:col-span-1">
            {(config?.urlTwitter || config?.urlFacebook || config?.urlInstagram) && (
              <>
                <p className="text-2xl 2xl:text-2xl mb-5">Redes sociales</p>
                <ul className="text-sm font-light grid gap-y-4">
                  {config?.urlTwitter && (
                    <li>
                      <a href={config.urlTwitter} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-x-2 py-1 px-2 glass-effect rounded-lg">
                        <BsTwitterX className="text-lg flex-none w-5" /> X
                      </a>
                    </li>
                  )}
                  {config?.urlFacebook && (
                    <li>
                      <a href={config.urlFacebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-x-2 py-1 px-2 glass-effect rounded-lg">
                        <BsFacebook className="text-lg flex-none w-5" /> Facebook
                      </a>
                    </li>
                  )}
                  {config?.urlInstagram && (
                    <li>
                      <a href={config.urlInstagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-x-2 py-1 px-2 glass-effect rounded-lg">
                        <BsInstagram className="text-lg flex-none w-5" /> Instagram
                      </a>
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>
          <div className='col-span-4 md:col-span-1'>
            <p className='text-2xl 2xl:text-3xl mb-5'>Legal</p>
            <ul className='text-sm font-light grid gap-y-4'>
              <Link href="/legales/aviso_de_privacidad">Aviso de privacidad</Link>
              <Link href="/legales/nuestras_politicas">Nuestras políticas</Link>
              <Link href="/legales/terminos_y_condiciones">Términos y condiciones</Link>
              <Link href="/legales/eliminacion_de_cuenta">Eliminar cuenta app</Link>
            </ul>
          </div>
          <div className="col-span-4 md:col-span-1">
            {(config?.direccionContacto || config?.emailContacto || config?.telefonoContacto) && (
              <>
                <p className="text-2xl 2xl:text-3xl mb-5">Contacto</p>
                <ul className="text-sm font-light grid gap-y-4">
                  {config?.direccionContacto && (
                    <li className="flex items-center gap-x-2">
                      <MdLocationOn className="text-xl w-5 flex-none" />
                      {config.direccionContacto}
                    </li>
                  )}
                  {config?.emailContacto && (
                    <li className="flex items-center gap-x-2">
                      <MdOutlineEmail className="text-xl w-5 flex-none" />
                      {config.emailContacto}
                    </li>
                  )}
                  {config?.telefonoContacto && (
                    <li className="flex items-center gap-x-2">
                      <MdPhone className="text-xl w-5 flex-none" />
                      {config.telefonoContacto}
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>
          <div className='col-span-4 border-t border-neutral pt-4 mt-3 text-sm font-light text-center'>
            <p className="max-w-2xl mx-auto">
              {config?.mensajeFooter ? (
                <>{config?.mensajeFooter}</>
              ) : (
                <>Consulta nuestros avisos de privacidad, asi como nuestras politicas. Conoce nuestros eventos y siguenos en nuestras redes sociales para mayor información.</>
              )}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
