import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { ShieldX, Loader2 } from "lucide-react";

interface RoleGuardProps {
  /** Roles permitidos para acessar esta rota */
  allow: AppRole[];
  /** Conteúdo protegido */
  children: ReactNode;
  /** Se true, redireciona para /auth em vez de mostrar tela de negação */
  redirectOnDeny?: boolean;
}

/**
 * Componente de guarda de role.
 * Envolve rotas e componentes que requerem um role específico.
 * Bloqueia usuários que não têm o role necessário OU que estão bloqueados.
 */
export default function RoleGuard({ allow, children, redirectOnDeny }: RoleGuardProps) {
  const { role, loading, isBlocked } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Usuário bloqueado — redireciona para login
  if (isBlocked) {
    return <Navigate to="/auth?blocked=1" replace />;
  }

  // Sem role ou role não autorizado
  if (!role || !allow.includes(role)) {
    if (redirectOnDeny) return <Navigate to="/" replace />;

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 animate-fade-in">
        <div className="h-20 w-20 rounded-full bg-rose-500/10 flex items-center justify-center ring-1 ring-rose-500/20">
          <ShieldX className="h-10 w-10 text-rose-500" />
        </div>
        <div className="text-center max-w-sm space-y-2">
          <h2 className="text-xl font-display font-bold text-foreground">Acceso Denegado</h2>
          <p className="text-sm text-muted-foreground">
            No tienes permisos para acceder a esta sección.
            {role && (
              <span className="block mt-1 text-xs text-muted-foreground/60">
                Tu perfil (<span className="font-semibold text-primary">{role}</span>) no está autorizado aquí.
              </span>
            )}
          </p>
        </div>
        <a
          href="/"
          className="text-xs font-bold text-primary hover:underline underline-offset-4"
        >
          ← Volver al inicio
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
