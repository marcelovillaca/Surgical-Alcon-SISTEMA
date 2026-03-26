import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import RoleGuard from "@/components/RoleGuard";
import AppLayout from "@/components/AppLayout";

// Pages
import Index from "./pages/Index";
import VisitadorDashboard from "./pages/VisitadorDashboard";
import Inventario from "./pages/Inventario";
import CRM from "./pages/CRM";
import Pedidos from "./pages/Pedidos";
import Visitas from "./pages/Visitas";
import Auth from "./pages/Auth";
import InviteUsers from "./pages/InviteUsers";
import VentasTargets from "./pages/VentasTargets";
import Intelligence from "./pages/Intelligence";
import Conofta from "./pages/Conofta";
import AuditLogs from "./pages/AuditLogs";
import PlaceholderPage from "@/components/PlaceholderPage";
import Reportes from "./pages/Reportes";
import NotFound from "./pages/NotFound";
import AccountAnalysis from "./pages/AccountAnalysis";
import MarketShare from "./pages/MarketShare";
import Waitlist from "./pages/Waitlist";
import ConoftaReports from "./pages/ConoftaReports";
import ConoftaSettings from "./pages/ConoftaSettings";
import ConoftaLista from "./pages/ConoftaLista";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// ─── Dashboard inteligente por role ──────────────────────────────────────────
function SmartDashboard() {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Visitador vê seu dashboard exclusivo (sem dados financeiros)
  if (role === "visitador") return <VisitadorDashboard />;

  // Todos os outros (gerente, bodega, expedicion) veem o dashboard completo
  return <Index />;
}

// ─── Protected Routes com guards de role ─────────────────────────────────────
function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const { isBlocked, loading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-10 w-10 rounded-xl gradient-emerald animate-pulse" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Usuário bloqueado — desloga e redireciona
  if (isBlocked) return <Navigate to="/auth?blocked=1" replace />;

  return (
    <AppLayout>
      <Routes>
        {/* ── Dashboard inteligente ── */}
        <Route path="/" element={<SmartDashboard />} />

        {/* ── ALCON — Comercial ── */}
        <Route path="/crm" element={
          <RoleGuard allow={["gerente", "visitador"]}>
            <CRM />
          </RoleGuard>
        } />
        <Route path="/visitas" element={
          <RoleGuard allow={["gerente", "visitador"]}>
            <Visitas />
          </RoleGuard>
        } />
        <Route path="/pedidos" element={
          <RoleGuard allow={["gerente", "visitador", "bodega", "expedicion"]}>
            <Pedidos />
          </RoleGuard>
        } />
        <Route path="/inventario" element={
          <RoleGuard allow={["gerente", "bodega", "expedicion"]}>
            <Inventario />
          </RoleGuard>
        } />

        {/* ── ALCON — Financeiro (só gerente) ── */}
        <Route path="/ventas" element={
          <RoleGuard allow={["gerente"]}>
            <VentasTargets />
          </RoleGuard>
        } />
        <Route path="/inteligencia" element={
          <RoleGuard allow={["gerente"]}>
            <Intelligence />
          </RoleGuard>
        } />
        <Route path="/cuentas" element={
          <RoleGuard allow={["gerente"]}>
            <AccountAnalysis />
          </RoleGuard>
        } />
        <Route path="/market-share" element={
          <RoleGuard allow={["gerente"]}>
            <MarketShare />
          </RoleGuard>
        } />

        {/* ── CONOFTA — Operacional ── */}
        <Route path="/conofta/waitlist" element={
          <RoleGuard allow={["gerente", "admin_conofta", "coordinador_local"]}>
            <Waitlist />
          </RoleGuard>
        } />
        <Route path="/conofta/lista" element={
          <RoleGuard allow={["gerente", "admin_conofta", "coordinador_local"]}>
            <ConoftaLista />
          </RoleGuard>
        } />
        <Route path="/conofta/reportes" element={
          <RoleGuard allow={["gerente", "admin_conofta", "coordinador_local"]}>
            <ConoftaReports />
          </RoleGuard>
        } />

        {/* ── CONOFTA — KPIs financeiros (só gerente) ── */}
        <Route path="/conofta" element={
          <RoleGuard allow={["gerente"]}>
            <Conofta />
          </RoleGuard>
        } />

        {/* ── CONOFTA — Configurações (gerente + admin_conofta) ── */}
        <Route path="/conofta/settings" element={
          <RoleGuard allow={["gerente", "admin_conofta"]}>
            <ConoftaSettings />
          </RoleGuard>
        } />

        {/* ── Sistema (só gerente) ── */}
        <Route path="/reportes" element={
          <RoleGuard allow={["gerente"]}>
            <Reportes />
          </RoleGuard>
        } />
        <Route path="/usuarios" element={
          <RoleGuard allow={["gerente"]}>
            <InviteUsers />
          </RoleGuard>
        } />
        <Route path="/auditoria" element={
          <RoleGuard allow={["gerente"]}>
            <AuditLogs />
          </RoleGuard>
        } />
        <Route path="/configuracion" element={
          <RoleGuard allow={["gerente"]}>
            <PlaceholderPage
              title="Configuración"
              description="Gestión de parámetros del sistema. Próximamente."
            />
          </RoleGuard>
        } />
        <Route path="/logistica" element={
          <RoleGuard allow={["gerente", "bodega", "expedicion"]}>
            <PlaceholderPage
              title="Logística"
              description="Módulo de expedición y gestión de rutas de entrega. Próximamente."
            />
          </RoleGuard>
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
