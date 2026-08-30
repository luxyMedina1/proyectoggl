import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { RxHamburgerMenu } from "react-icons/rx";
import { TfiClose } from "react-icons/tfi";
import Loader from '@/publicUi/components/Loader';
import { useConferencia } from "../hooks/useConferencia";
import ErrorPage from "../ErrorPage";
import { RiArrowRightLine } from "react-icons/ri";

function NavBar() {
  const router = useRouter();
  const { conferencia, error, loading } = useConferencia();
  const pathname = usePathname();

  const [isFixed, setIsFixed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false); 
  const dropdownRef = useRef<HTMLLIElement | null>(null);
  const SCROLL_THRESHOLD = 200;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > SCROLL_THRESHOLD) {
        setIsFixed(false);
      } else {
        setIsFixed(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  if (loading) return <Loader />;
  if (error) return <ErrorPage />;
  if (!conferencia) return null;

  const pathInicio = `/cosmotech/${conferencia.id}`;
  const pathPrograma = `/cosmotech/programa/${conferencia.id}`;
  const pathSpeakers = `/cosmotech/speakers/${conferencia.id}`;
  const pathRecinto = `/cosmotech/recinto/${conferencia.id}`;
  const pathRegistro = `/cosmotech/boletos/${conferencia.id}`;
  const pathHoteles = `/cosmotech/hoteles/${conferencia.id}`;

  const isHomePath = pathname === pathInicio;
  // const isRegistroPath = location.pathname === pathRegistro;

  const getNavbarBgClass = () => {
    if (isHomePath) {
      return isFixed
        ? "bg-[#030e2e] absolute top-2 py-1 shadow-md" 
        : "bg-transparent absolute top-0 py-1 md:top-4 md:py-3"; 
    }
    return "bg-[#030e2e] absolute top-2 py-1 shadow-md"; 
  };
  
  const navBarClass = getNavbarBgClass();

  const getNavLinkClass = (path: string) => {
    const isActive = pathname === path;

    const defaultColor = "text-gray-50"; 
    const hoverColor = "hover:text-white hover:border-white"; 

    const baseClass = `${defaultColor} border-b-2 border-transparent ${hoverColor} transition duration-150 text-lg`;
    const activeClass = `${defaultColor} font-semibold border-b-2 border-white text-lg`;

    return isActive ? activeClass : baseClass;
  };

  const scrollToSection = (sectionId: string) => {
    router.push(`${pathInicio}?scrollTo=${sectionId}`);
    setDropdownOpen(false);
    setIsOpen(false);
  };

  return (
    <div className={`left-1/2 -translate-x-1/2 container mx-auto md:px-5 lg:px-8 2xl:px-20 w-full rounded-2xl shadow-sm- px-6 z-50 transition-all duration-200 ${navBarClass}`}>
      <div className="flex items-center justify-between">
        {/* Logo */}
        <Link href={pathInicio} onClick={() => { setIsOpen(false); setDropdownOpen(false); }}>
          <img src={conferencia.imagenLogo || '/default_image.png'} alt="logo empresa" className="max-h-14" />
        </Link>

        {/* Boton ham mobile */}
        <button className={`md:hidden focus:outline-none ${isHomePath ? 'text-white' : 'text-gray-50'}`} onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <TfiClose size={24} /> : <RxHamburgerMenu size={24} />}
        </button>

        {/* Enlaces desktop */}
        <ul className="hidden md:flex text-sm items-center gap-x-6">
          {/* Dropdown en click */}
          <li ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              className={`${getNavLinkClass(pathInicio)} flex items-center gap-x-2`}
            >
              Inicio
              <svg className={`w-6 h-6 transition-transform ${dropdownOpen ? "rotate-180" : "rotate-0"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Menu */}
            {dropdownOpen && (
              <ul className="absolute top-full left-0 flex flex-col bg-white text-gray-800 shadow-lg rounded-md mt-2 py-2 w-60 z-50">
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => scrollToSection("que-somos")}
                >
                  ¿Qúe es CosmoTech?
                </li>
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => scrollToSection("soluciones")}
                >
                  Soluciones
                </li>
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => scrollToSection("vision")}
                >
                  Visión
                </li>
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => scrollToSection("patrocinadores")}
                >
                  Patrocinadores
                </li>
              </ul>
            )}
          </li>
          <li>
            <Link href={pathPrograma} className={getNavLinkClass(pathPrograma)}>
              Programa
            </Link>
          </li>
          <li>
            <Link href={pathSpeakers} className={getNavLinkClass(pathSpeakers)}>
              Speakers
            </Link>
          </li>
          <li>
            <Link href={pathRecinto} className={getNavLinkClass(pathRecinto)}>
              Recinto
            </Link>
          </li>
          <li>
            <Link href={pathHoteles} className={getNavLinkClass(pathHoteles)}>
              Hoteles
            </Link>
          </li>
          {!isHomePath && (
          <li>
            <Link href={pathRegistro} className="text-base gap-x-2 flex items-center bg-white text-blue-600 px-2 py-1 rounded-full">
              Registrate aquí
              <div className="grid place-items-center w-5 h-5 bg-blue-600 rounded-full flex-none">
                <RiArrowRightLine className="flex-none text-white" />
              </div>
            </Link>
          </li>
          )}
        </ul>
      </div>

      {/* Menu desplegable mobile */}
      {isOpen && (
        <div className="md:hidden mt-4 border-t border-gray-200 pt-3 pb-2 bg-white rounded-b-lg p-4">
          <ul className="flex flex-col gap-3 text-sm">
            <li>
              <button onClick={() => { scrollToSection("que-somos"); }} className="text-gray-800 text-left w-full">
                Inicio - ¿Qúe es CosmoTech?
              </button>
            </li>
            <li>
              <button onClick={() => { scrollToSection("soluciones"); }} className="text-gray-800 text-left w-full">
                Inicio - Soluciones
              </button>
            </li>
            <li>
              <button onClick={() => { scrollToSection("vision"); }} className="text-gray-800 text-left w-full">
                Inicio - Visión
              </button>
            </li>
            <li>
              <button onClick={() => { scrollToSection("patrocinadores"); }} className="text-gray-800 text-left w-full">
                Inicio - Patrocinadores
              </button>
            </li>
            <li>
              <Link href={pathPrograma} className="text-gray-800" onClick={() => setIsOpen(false)}>
                Programa
              </Link>
            </li>
            <li>
              <Link href={pathSpeakers} className="text-gray-800" onClick={() => setIsOpen(false)}>
                Speakers
              </Link>
            </li>
            <li>
              <Link href={pathRecinto} className="text-gray-800" onClick={() => setIsOpen(false)}>
                Recinto
              </Link>
            </li>
            <li>
              <Link href={pathHoteles} className="text-gray-800" onClick={() => setIsOpen(false)}>
                Hoteles
              </Link>
            </li>
            {!isHomePath && (
            <li>
              <Link href={pathRegistro} className="text-base gap-x-2 flex items-center bg-white text-blue-600 px-2 py-1 rounded-full">
                Registrate aquí
                <div className="grid place-items-center w-5 h-5 bg-blue-600 rounded-full flex-none">
                  <RiArrowRightLine className="flex-none text-white" />
                </div>
              </Link>
            </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default NavBar;