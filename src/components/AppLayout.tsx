import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, Users, ClipboardList, MapPin, Truck,
  TrendingUp, Settings, ChevronLeft, ChevronRight, LogOut, Shield,
  FileDown, FileText, BarChart2, PieChart, ClipboardCheck, UserCog,
  BarChart3, Menu, X, Home, Warehouse, Activity, Clock, Moon, Sun, Eye,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole, ALCON_ROLES, CONOFTA_ROLES } from "@/hooks/useUserRole";

type MenuItem = { to: string; icon: typeof LayoutDashboard; label: string; roles?: AppRole[] };
type MenuGroup = { label: string; items: MenuItem[]; roles?: AppRole[] };

const menuGroups: Record<"alcon" | "conofta", MenuGroup[]> = {
  alcon: [
    {
      label: "Inicio",
      items: [
        { to: "/", icon: BarChart3, label: "Dashboard de Ventas", roles: ["visitador", "gerente", "bodega", "expedicion"] },
      ],
    },
    {
      label: "Operaciones",
      items: [
        { to: "/inventario", icon: Package, label: "Bodega & Inventario", roles: ["gerente", "bodega"] },
        { to: "/crm", icon: Users, label: "CRM & Clientes", roles: ["gerente", "visitador"] },
        { to: "/pedidos", icon: ClipboardList, label: "Pedidos", roles: ["gerente", "visitador", "bodega", "expedicion"] },
        { to: "/visitas", icon: MapPin, label: "Visitas (SFA)", roles: ["gerente", "visitador"] },
        { to: "/sfa/admin", icon: Activity, label: "Consola SFA", roles: ["gerente"] },
      ],
    },
    {
      label: "Inteligencia",
      roles: ["gerente"],
      items: [
        { to: "/ventas", icon: TrendingUp, label: "Ventas & Targets", roles: ["gerente"] },
        { to: "/inteligencia", icon: BarChart2, label: "P&L & Análisis", roles: ["gerente"] },
        { to: "/cuentas", icon: FileText, label: "Análisis de Cuenta", roles: ["gerente"] },
        { to: "/market-share", icon: PieChart, label: "Market Share", roles: ["gerente"] },
      ],
    },
    {
      label: "Sistema",
      roles: ["gerente"],
      items: [
        { to: "/reportes", icon: FileDown, label: "Reportes", roles: ["gerente"] },
        { to: "/usuarios", icon: Users, label: "Gestión Usuarios", roles: ["gerente"] },
        { to: "/auditoria", icon: Shield, label: "Auditoría", roles: ["gerente"] },
        { to: "/configuracion", icon: Settings, label: "Configuración", roles: ["gerente"] },
      ],
    },
  ],
  conofta: [
    {
      label: "Operacional",
      items: [
        { to: "/conofta/waitlist", icon: ClipboardCheck, label: "Ficha de Ingreso", roles: ["gerente", "admin_conofta", "coordinador_local"] },
        { to: "/conofta/lista", icon: Users, label: "Lista General", roles: ["gerente", "admin_conofta", "coordinador_local"] },
        { to: "/conofta/reportes", icon: FileDown, label: "Reportes Operativos", roles: ["gerente", "admin_conofta", "coordinador_local"] },
        { to: "/conofta/inventario", icon: Warehouse, label: "Inventario", roles: ["gerente", "admin_conofta", "coordinador_local"] },
      ],
    },
    {
      label: "Inteligencia",
      roles: ["gerente", "admin_conofta", "coordinador_local"],
      items: [
        { to: "/conofta", icon: BarChart2, label: "Centro de Comando", roles: ["gerente", "admin_conofta", "coordinador_local"] },
      ],
    },
    {
      label: "Conf. Clínica",
      roles: ["gerente", "admin_conofta"],
      items: [
        { to: "/conofta/settings", icon: Settings, label: "Sedes y Cirujanos", roles: ["gerente", "admin_conofta"] },
      ],
    },
    {
      label: "Sistema",
      roles: ["gerente", "admin_conofta"],
      items: [
        { to: "/usuarios", icon: UserCog, label: "Gestión de Usuarios", roles: ["gerente"] },
        { to: "/auditoria", icon: Shield, label: "Auditoría Clínica", roles: ["gerente", "admin_conofta"] },
      ],
    },
  ],
};

const IDLE_TIMEOUT_MS  = 30 * 60 * 1000; // 30 min
const WARN_BEFORE_MS   =  5 * 60 * 1000; // warn 5 min before

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]       = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);
  const [theme, setTheme]               = useState<"light" | "dark">(
    (localStorage.getItem("theme") as "light" | "dark") || "light"
  );
  const [idleWarning, setIdleWarning]   = useState(false);
  const [countdown, setCountdown]       = useState(WARN_BEFORE_MS / 1000);
  const idleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { role } = useUserRole();

  const roleIsAlconOnly   = role !== null && ALCON_ROLES.includes(role as AppRole);
  const roleIsConoftaOnly = role !== null && CONOFTA_ROLES.includes(role as AppRole);

  const defaultModule: "alcon" | "conofta" = roleIsConoftaOnly ? "conofta" : "alcon";
  const [activeModule, setActiveModule] = useState<"alcon" | "conofta">(defaultModule);

  useEffect(() => {
    if (roleIsConoftaOnly) setActiveModule("conofta");
  }, [roleIsConoftaOnly]);

  // ── Idle timeout ────────────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (countRef.current)  clearInterval(countRef.current);
  }, []);

  const handleAutoLogout = useCallback(async () => {
    clearTimers();
    setIdleWarning(false);
    await signOut();
    navigate("/auth");
  }, [clearTimers, signOut, navigate]);

  const resetIdleTimer = useCallback(() => {
    clearTimers();
    setIdleWarning(false);
    setCountdown(WARN_BEFORE_MS / 1000);

    // Show warning 5 min before expiry
    warnTimer.current = setTimeout(() => {
      setIdleWarning(true);
      setCountdown(WARN_BEFORE_MS / 1000);
      countRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(countRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);

    // Auto logout after full timeout
    idleTimer.current = setTimeout(handleAutoLogout, IDLE_TIMEOUT_MS);
  }, [clearTimers, handleAutoLogout]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!user) return;
    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart", "click"] as const;
    const reset = () => resetIdleTimer();
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      clearTimers();
    };
  }, [user, resetIdleTimer, clearTimers]);
  // ────────────────────────────────────────────────────────────────────────────

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleModuleChange = (module: "alcon" | "conofta") => {
    if (roleIsAlconOnly && module === "conofta") return;
    if (roleIsConoftaOnly && module === "alcon") return;
    setActiveModule(module);
    navigate(module === "alcon" ? "/" : "/conofta/lista");
  };

  const roleLabels: Record<string, string> = {
    gerente: "Gerente General",
    admin_conofta: "Admin CONOFTA",
    coordinador_local: "Coordinador Local",
    visitador: "Visitador",
    bodega: "Bodega",
    expedicion: "Expedición",
  };

  const filteredGroups = menuGroups[activeModule]
    .filter((group) => !group.roles || (role && group.roles.includes(role as any)))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || (role && item.roles.includes(role as any))),
    }))
    .filter((group) => group.items.length > 0);

  const allItems = [...menuGroups.alcon, ...menuGroups.conofta].flatMap((g) => g.items);
  let currentLabel = allItems.find((i) => i.to === location.pathname)?.label;
  
  // Custom label logic for CONOFTA users landing on root
  if (roleIsConoftaOnly && (location.pathname === "/" || location.pathname === "/conofta")) {
    currentLabel = "Centro de Comando";
  } else if (!currentLabel) {
    currentLabel = roleIsConoftaOnly ? "Centro de Comando" : "Dashboard de Ventas";
  }

  // Bottom nav items for mobile (most used)
  const bottomNavItems = role === "visitador" 
    ? [
        { to: "/", icon: Home, label: "Inicio" },
        { to: "/visitas", icon: MapPin, label: "Visitas" },
        { to: "/crm", icon: Users, label: "Clientes" },
        { to: "/pedidos", icon: ClipboardList, label: "Pedidos" }
      ]
    : filteredGroups.flatMap(g => g.items).slice(0, 4);

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable Area (Logo + Switchers + Nav) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-sidebar-scroll">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2.5 animate-slide-in">
              <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 shadow-sm shadow-primary/20">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-display font-black text-white tracking-tight leading-none uppercase">Surgical <span className="text-primary">Alcon</span></span>
                <span className="text-[9px] text-blue-400/80 font-black tracking-[0.1em] mt-1">CONOFTA PLATFORM</span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
              <Eye className="h-4 w-4 text-primary" />
            </div>
          )}
          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden ml-auto text-muted-foreground hover:text-foreground p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Module Switcher */}
        {!collapsed && !roleIsAlconOnly && !roleIsConoftaOnly && (
          <div className="px-4 py-3 flex gap-2 shrink-0">
            <button
              onClick={() => handleModuleChange("alcon")}
              className={cn(
                "flex-1 py-2.5 text-[10px] font-bold rounded-xl transition-all",
                activeModule === "alcon"
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >ALCON</button>
            <button
              onClick={() => handleModuleChange("conofta")}
              className={cn(
                "flex-1 py-2.5 text-[10px] font-bold rounded-xl transition-all",
                activeModule === "conofta"
                  ? "bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >CONOFTA</button>
          </div>
        )}
        {!collapsed && (roleIsAlconOnly || roleIsConoftaOnly) && (
          <div className="px-4 py-3 shrink-0">
            <div className={cn(
              "rounded-xl py-1.5 text-center text-[10px] font-bold uppercase tracking-widest",
              roleIsConoftaOnly ? "bg-blue-600/20 text-blue-400" : "bg-primary/10 text-primary"
            )}>
              {roleIsConoftaOnly ? "CONOFTA" : "ALCON"}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="py-3 px-3 space-y-5">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/" || item.to === "/conofta"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 relative overflow-hidden group",
                          isActive
                            ? (activeModule === "conofta" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary")
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className={cn("absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full", activeModule === "conofta" ? "bg-blue-400" : "bg-primary")} />
                          )}
                          <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive && (activeModule === "conofta" ? "text-blue-400" : "text-primary"))} />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* User + Controls (Fixed at bottom) */}
      <div className="border-t border-border p-3 space-y-2 shrink-0 bg-sidebar">
        {!collapsed && (
          <NavLink to="/perfil" className="flex items-center gap-2.5 px-2 mb-2 hover:bg-sidebar-accent rounded-xl transition-all border border-transparent hover:border-sidebar-border">
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">
                {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.user_metadata?.full_name || "Usuario"}</p>
              <p className="text-[10px] text-primary font-medium">{role ? roleLabels[role] || role : "Sin rol"}</p>
            </div>
          </NavLink>
        )}
        <div className="flex gap-1">
          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex flex-1 items-center justify-center rounded-xl py-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={signOut}
            className="flex flex-1 md:flex-none items-center justify-center rounded-xl py-2 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2 text-xs md:hidden">Salir</span>}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">

      {/* ─── IDLE WARNING DIALOG ─── */}
      {idleWarning && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-amber-500/30 rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
                <Clock className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">¿Sigues ahí?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Por inactividad, tu sesión se cerrará en
                </p>
                <p className="text-4xl font-black text-amber-400 mt-2">
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                </p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleAutoLogout}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cerrar sesión
                </button>
                <button
                  onClick={resetIdleTimer}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors"
                >
                  Seguir activo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen max-h-screen border-r border-border bg-sidebar flex flex-col transition-all duration-300 overflow-hidden",
          "hidden md:flex",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        <SidebarContent />
      </aside>

      {/* ─── MOBILE DRAWER OVERLAY ─── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen max-h-screen w-[280px] border-r border-border bg-sidebar flex flex-col transition-transform duration-300 md:hidden overflow-hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          "ml-0 md:ml-[260px]",
          collapsed && "md:ml-[68px]"
        )}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b border-border bg-background/90 backdrop-blur-lg px-4 md:px-6 shrink-0">
          {/* Mobile: hamburger + page title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-base md:text-lg font-display font-semibold text-foreground truncate">
              {currentLabel}
            </h2>
          </div>

          {/* Right: theme toggle + user info */}
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all border border-border/40"
              title={theme === "light" ? "Activar Modo Oscuro" : "Activar Modo Claro"}
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            <NavLink to="/perfil" className="flex items-center gap-2 md:gap-4 hover:bg-muted/50 p-1 rounded-xl transition-all">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-foreground leading-tight">
                  {user?.user_metadata?.full_name?.split(" ")[0] || "Usuario"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {role ? roleLabels[role] || role : ""}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            </NavLink>
          </div>
        </header>

        {/* Page Content - Using body scroll for maximum browser compatibility */}
        <div className="flex-1 p-4 md:p-6 pb-24 md:pb-8">
          {children}
        </div>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-sidebar/95 backdrop-blur-lg">
          <div className="flex items-center justify-around px-2 py-1" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px] touch-manipulation",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={cn(
                      "p-1.5 rounded-lg transition-all",
                      isActive ? "bg-primary/10" : ""
                    )}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] font-semibold truncate max-w-[60px] text-center leading-tight">
                      {item.label.split(" ")[0]}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
            {/* More / Menu button */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-muted-foreground transition-all min-w-[56px] touch-manipulation"
            >
              <div className="p-1.5 rounded-lg">
                <Menu className="h-5 w-5" />
              </div>
              <span className="text-[9px] font-semibold">Más</span>
            </button>
          </div>
        </nav>
      </main>
    </div>
  );
}
