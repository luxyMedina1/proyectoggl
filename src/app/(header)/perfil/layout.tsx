import { RequireAuth } from "@/components/auth/RequireAuth";

export default function PerfilLayout({ children }: LayoutProps<"/perfil">) {
  return <RequireAuth>{children}</RequireAuth>;
}
