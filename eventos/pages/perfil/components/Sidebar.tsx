import { useEffect, useState } from "react";
import { LuUserRound, LuLogOut, LuUsers, LuSend } from "react-icons/lu";
import { BsCreditCard } from "react-icons/bs";
import { TbTicket } from "react-icons/tb";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "../../../../hooks/useAuthStore";
import { useTransferenciasStore } from "../../../../hooks/useTransferenciasStore";
import { useAmigosStore } from "../../../../hooks/useAmigosStore";
import { onNotifRefresh } from "../../../../utils/notifEvents";

const POLL_MS = 30_000;

const Sidebar = () => {
    const pathname = usePathname();
    const { startLogout, user } = useAuthStore();
    const { getPendientesRecibidas } = useTransferenciasStore();
    const { getSolicitudesRecibidas } = useAmigosStore();
    const [pendientesCount, setPendientesCount] = useState(0);
    const [amigosCount, setAmigosCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        let active = true;
        const fetchCount = async () => {
            // No consultar si la pestaña está en segundo plano (menos peticiones).
            if (document.hidden) return;
            const [transferencias, amigos] = await Promise.allSettled([
                getPendientesRecibidas(),
                getSolicitudesRecibidas(),
            ]);
            if (!active) return;
            if (transferencias.status === 'fulfilled') setPendientesCount(transferencias.value.length);
            if (amigos.status === 'fulfilled') setAmigosCount(amigos.value.length);
        };
        fetchCount();
        const id = window.setInterval(fetchCount, POLL_MS);
        const offNotif = onNotifRefresh(fetchCount);
        return () => {
            active = false;
            window.clearInterval(id);
            offNotif();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.email]);

    const menuItems = [
        { path: "/perfil/mi_perfil", icon: <LuUserRound className="text-2xl" />, label: "Mi perfil" },
        { path: "/perfil/mis_formas_de_pago", icon: <BsCreditCard className="text-2xl" />, label: "Forma de pago" },
        { path: "/perfil/mis_compras", icon: <TbTicket className="text-2xl" />, label: "Mis compras" },
        { path: "/perfil/mis_amigos", icon: <LuUsers className="text-2xl" />, label: "Mis amigos", badge: amigosCount },
        { path: "/perfil/mis_transferencias", icon: <LuSend className="text-2xl" />, label: "Transferencias", badge: pendientesCount },
        { path: "/logout", icon: <LuLogOut className="text-2xl" />, label: "Cerrar sesión" }
    ];

    return (
        <aside className="bg-gray-50 shadow-md rounded-xl col-span-7 md:col-span-3 lg:col-span-2 lg:sticky top-0">
            <ul className="p-4 grid gap-y-5">
                {menuItems.map(({ path, icon, label, badge }) => (
                    path === "/logout" ? (
                        <button
                            key={path}
                            onClick={startLogout}
                            className="flex items-center gap-x-4 font-semibold cursor-pointer p-2 rounded-full transition-colors
                            text-gray-600 hover:bg-red-500 hover:text-neutral w-full text-left"
                        >
                            {icon} {label}
                        </button>
                    ) : (
                        <Link
                            key={path}
                            href={path}
                            className={`flex items-center gap-x-4 font-semibold cursor-pointer p-2 rounded-full transition-colors
                            ${pathname === path ? "bg-accentLight text-neutral" : "text-gray-600 hover:bg-accentLight hover:text-neutral"}`}
                        >
                            {icon}
                            <span className="flex-1">{label}</span>
                            {badge != null && badge > 0 && (
                                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center">
                                    {badge}
                                </span>
                            )}
                        </Link>
                    )
                ))}
            </ul>
        </aside>
    );
};

export default Sidebar;
