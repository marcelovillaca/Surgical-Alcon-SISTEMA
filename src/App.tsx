import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import RoleGuard from "@/components/RoleGuard";
import AppLayout from "@/components/AppLayout";
import { Loader2, ShieldAlert, Mail } from "lucide-react";
import React, { Suspense, lazy, useEffect } from "react";

// Lazy-load all pages to prevent one bad page from killing the boot
const Auth = lazy(() => import("./pages/Auth"));
const Index = lazy(() => import("./pages/Index"));
const VisitadorDashboard = lazy(() => import("./pages/VisitadorDashboard"));
const Inventario = lazy(() => import("./pages/Inventario"));
const CRM = lazy(() => import("./pages/CRM"));
const Pedidos = lazy(() => import("./pages/Pedidos"));
const Visitas = lazy(() => import("./pages/Visitas"));
const InviteUsers = lazy(() => import("./pages/InviteUsers"));
const VentasTargets = lazy(() => import("./pages/VentasTargets"));
const Intelligence = lazy(() => import("./pages/Intelligence"));
const Conofta = lazy(() => import("./pages/Conofta"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Reportes = lazy(() => import("./pages/Reportes"));
const AccountAnalysis = lazy(() => import("./pages/AccountAnalysis"));
const MarketShare = lazy(() => import("./pages/MarketShare"));
const Waitlist = lazy(() => import("./pages/Waitlist"));
const ConoftaReports = lazy(() => import("./pages/ConoftaReports"));
const ConoftaSettings = lazy(() => import("./pages/ConoftaSettings"));
const ConoftaLista = lazy(() => import("./pages/ConoftaLista"));
const ConoftaInventario = lazy(() => import("./pages/ConoftaInventario"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PlaceholderPage = lazy(() => import("@/components/PlaceholderPage"));

const queryClient = new QueryClient();

// ─── Loading Component ───
const PageLoader = () => (
  <div className="min-h-screen bg-[#111111] flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
      <p className="text-sm text-muted-foreground animate-pulse">Iniciando aplicación...</p>
    </div>
  </div>
);

// ─── Pending Account Screen (user authenticated but no role assigned yet) ───
function PendingAccount() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center ring-2 ring-amber-500/20">
          <ShieldAlert className="h-10 w-10 text-amber-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">Cuenta Pendiente de Activación</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta (<span className="text-primary font-medium">{user?.email}</span>) está registrada pero aún no tiene un rol asignado.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-3">
            Contacta al Gerente del sistema para que asigne tu perfil de acceso.
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left">
          <p className="text-xs font-semibold text-amber-400 mb-1">¿Qué hacer?</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Contacta al Gerente: <span className="text-primary">marcelo.villaca@hotmail.com</span></li>
            <li>• Indica tu email y solicita la activación de tu cuenta</li>
            <li>• Una vez activado, cierra sesión y vuelve a ingresar</li>
          </ul>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-4"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function SmartDashboard() {
  const { role, loading } = useUserRole();

  if (loading) return <PageLoader />;
  if (!role) return <PendingAccount />;
  
  // Specific views per role
  if (role === "visitador") return <VisitadorDashboard />;
  if (role === "admin_conofta" || role === "coordinador_local") {
     return (
       <Suspense fallback={<PageLoader />}>
         <Conofta />
       </Suspense>
     );
  }
  
  // Default for Gerente/Admin
  return <Index />;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const { isBlocked, loading: roleLoading } = useUserRole();

  // ── SYNCHRONOUS recovery token check ──────────────────────────────────────
  // MUST be synchronous (not useEffect) because the !user check below would
  // redirect to /auth before the effect ever runs.
  // Supabase sends the user back to: https://app.vercel.app/#access_token=X&type=recovery
  // HashRouter parses "#access_token=X&type=recovery" as the path — which hits this route.
  const rawHash = window.location.hash; // e.g. "#access_token=X&refresh_token=Y&type=recovery"
  const hashWithoutLeading = rawHash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hashWithoutLeading);
  const isRecoveryFlow =
    hashParams.get("type") === "recovery" && !!hashParams.get("access_token");

  if (isRecoveryFlow) {
    const access_token = hashParams.get("access_token") || "";
    const refresh_token = hashParams.get("refresh_token") || "";
    // Redirect to /auth with tokens as proper query params (HashRouter friendly)
    window.location.replace(
      `${window.location.origin}${window.location.pathname}#/auth?type=recovery&access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}`
    );
    return <PageLoader />;
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (loading || roleLoading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (isBlocked) return <Navigate to="/auth?blocked=1" replace />;

  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<SmartDashboard />} />
          <Route path="/crm" element={<RoleGuard allow={["gerente", "visitador"]}><CRM /></RoleGuard>} />
          <Route path="/visitas" element={<RoleGuard allow={["gerente", "visitador"]}><Visitas /></RoleGuard>} />
          <Route path="/pedidos" element={<RoleGuard allow={["gerente", "visitador", "bodega", "expedicion"]}><Pedidos /></RoleGuard>} />
          <Route path="/inventario" element={<RoleGuard allow={["gerente", "bodega", "expedicion"]}><Inventario /></RoleGuard>} />
          <Route path="/ventas" element={<RoleGuard allow={["gerente"]}><VentasTargets /></RoleGuard>} />
          <Route path="/inteligencia" element={<RoleGuard allow={["gerente"]}><Intelligence /></RoleGuard>} />
          <Route path="/cuentas" element={<RoleGuard allow={["gerente"]}><AccountAnalysis /></RoleGuard>} />
          <Route path="/market-share" element={<RoleGuard allow={["gerente"]}><MarketShare /></RoleGuard>} />
          <Route path="/conofta/waitlist" element={<RoleGuard allow={["gerente", "admin_conofta", "coordinador_local"]}><Waitlist /></RoleGuard>} />
          <Route path="/conofta/lista" element={<RoleGuard allow={["gerente", "admin_conofta", "coordinador_local"]}><ConoftaLista /></RoleGuard>} />
          <Route path="/conofta/reportes" element={<RoleGuard allow={["gerente", "admin_conofta", "coordinador_local"]}><ConoftaReports /></RoleGuard>} />
          <Route path="/conofta" element={<RoleGuard allow={["gerente", "admin_conofta", "coordinador_local"]}><Conofta /></RoleGuard>} />
          <Route path="/conofta/settings" element={<RoleGuard allow={["gerente", "admin_conofta"]}><ConoftaSettings /></RoleGuard>} />
          <Route path="/conofta/inventario" element={<RoleGuard allow={["gerente", "admin_conofta", "coordinador_local"]}><ConoftaInventario /></RoleGuard>} />
          <Route path="/reportes" element={<RoleGuard allow={["gerente"]}><Reportes /></RoleGuard>} />
          <Route path="/usuarios" element={<RoleGuard allow={["gerente"]}><InviteUsers /></RoleGuard>} />
          <Route path="/auditoria" element={<RoleGuard allow={["gerente", "admin_conofta"]}><AuditLogs /></RoleGuard>} />
          <Route path="/configuracion" element={<RoleGuard allow={["gerente"]}><PlaceholderPage title="Configuración" description="Gestión de parámetros del sistema." /></RoleGuard>} />
          <Route path="/logistica" element={<RoleGuard allow={["gerente", "bodega", "expedicion"]}><PlaceholderPage title="Logística" description="Módulo de expedición." /></RoleGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
