import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import RoleGuard from "@/components/RoleGuard";
import AppLayout from "@/components/AppLayout";
import { Loader2 } from "lucide-react";
import React, { Suspense, lazy } from "react";

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

function SmartDashboard() {
  const { role, loading } = useUserRole();

  if (loading) return <PageLoader />;
  if (role === "visitador") return <VisitadorDashboard />;
  return <Index />;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const { isBlocked, loading: roleLoading } = useUserRole();

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
          <Route path="/conofta" element={<RoleGuard allow={["gerente"]}><Conofta /></RoleGuard>} />
          <Route path="/conofta/settings" element={<RoleGuard allow={["gerente", "admin_conofta"]}><ConoftaSettings /></RoleGuard>} />
          <Route path="/reportes" element={<RoleGuard allow={["gerente"]}><Reportes /></RoleGuard>} />
          <Route path="/usuarios" element={<RoleGuard allow={["gerente"]}><InviteUsers /></RoleGuard>} />
          <Route path="/auditoria" element={<RoleGuard allow={["gerente"]}><AuditLogs /></RoleGuard>} />
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
