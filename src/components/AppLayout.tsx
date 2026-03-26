import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  ClipboardList,
  MapPin,
  Truck,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  FileDown,
  FileText,
  BarChart2,
  PieChart,
  ClipboardCheck,
  UserCog,
  BarChart3,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, AppRole, ALCON_ROLES, CONOFTA_ROLES } from "@/hooks/useUserRole";

type MenuItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles?: AppRole[]; // undefined = all roles
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
  roles?: AppRole[]; // undefined = all roles
};

const menuGroups: Record<"alcon" | "conofta", MenuGroup[]> = {
  alcon: [
    {
      label: "Inicio",
      items: [
        // Visitador vê seu dashboard exclusivo; outros veem o geral
        { to: "/", icon: BarChart3, label: "Mi Dashboard", roles: ["visitador"] },
        { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["gerente", "bodega", "expedicion"] },
      ],
    },
    {
      label: "Operaciones",
      items: [
        { to: "/inventario", icon: Package, label: "Bodega & Inventario", roles: ["gerente", "bodega"] },
        { to: "/crm", icon: Users, label: "CRM & Clientes", roles: ["gerente", "visitador"] },
        { to: "/pedidos", icon: ClipboardList, label: "Pedidos", roles: ["gerente", "visitador", "bodega", "expedicion"] },
        { to: "/visitas", icon: MapPin, label: "Visitas (SFA)", roles: ["gerente", "visitador"] },
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
        { to: "/conofta/waitlist", icon: ClipboardCheck, label: "Ficha de Ingreso",       roles: ["gerente", "admin_conofta", "coordinador_local"] },
        { to: "/conofta/lista",    icon: Users,          label: "Lista General",         roles: ["gerente", "admin_conofta", "coordinador_local"] },
        { to: "/conofta/reportes", icon: FileDown,        label: "Reportes Operativos",  roles: ["gerente", "admin_conofta", "coordinador_local"] },
      ],
    },
    {
      label: "Inteligencia",
      roles: ["gerente"],
      items: [
        { to: "/conofta", icon: BarChart2, label: "KPIs y P&L", roles: ["gerente"] },
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
      roles: ["gerente"],
      items: [
        { to: "/usuarios",  icon: UserCog, label: "Gestión de Usuarios", roles: ["gerente"] },
        { to: "/auditoria", icon: Shield,   label: "Auditoría Clínica",  roles: ["gerente"] },
      ],
    },
  ]
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { role } = useUserRole();

  // Determine which module this role can access
  const roleIsAlconOnly  = role !== null && ALCON_ROLES.includes(role as AppRole);
  const roleIsConoftaOnly = role !== null && CONOFTA_ROLES.includes(role as AppRole);
  const roleIsGerente    = role === "gerente";

  // Auto-set active module based on role
  const defaultModule: "alcon" | "conofta" =
    roleIsConoftaOnly ? "conofta" : "alcon";

  const [activeModule, setActiveModule] = useState<"alcon" | "conofta">(defaultModule);

  // Sync module when role loads
  useEffect(() => {
    if (roleIsConoftaOnly) setActiveModule("conofta");
  }, [roleIsConoftaOnly]);

  const handleModuleChange = (module: "alcon" | "conofta") => {
    // Alcon-only roles cannot switch to CONOFTA and vice versa
    if (roleIsAlconOnly && module === "conofta") return;
    if (roleIsConoftaOnly && module === "alcon") return;
    setActiveModule(module);
    navigate(module === "alcon" ? "/" : "/conofta/lista");
  };

  const roleLabels: Record<string, string> = {
    gerente: "Gerente General",
    admin_conofta: "Admin Central CONOFTA",
    coordinador_local: "Coordinador Local",
    visitador: "Visitador",
    bodega: "Bodega",
    expedicion: "Expedición",
  };

  const filteredGroups = menuGroups[activeModule]
    .filter((group) => !group.roles || (role && (group.roles.includes(role as any))))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || (role && (item.roles.includes(role as any)))),
    }))
    .filter((group) => group.items.length > 0);

  // Flatten for header title lookup
  const allItems = [...menuGroups.alcon, ...menuGroups.conofta].flatMap((g) => g.items);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar flex flex-col transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-2 animate-slide-in">
              <div className="h-8 w-8 flex items-center justify-center">
                <img src="/logo.png" alt="S" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-sm font-display font-bold text-foreground">Surgical</h1>
                <p className="text-[10px] text-muted-foreground">PORTAL <span className="bg-muted rounded px-1 py-0.5 text-[8px]">v1.0</span></p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto h-8 w-8 flex items-center justify-center">
              <img src="/logo.png" alt="S" className="w-full h-full object-contain" />
            </div>
          )}
        </div>

        {/* Module Switcher — only show for gerente and roles that have access to both */}
        {!collapsed && !roleIsAlconOnly && !roleIsConoftaOnly && (
          <div className="px-4 py-4 flex gap-2">
            <button 
              onClick={() => handleModuleChange("alcon")}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold rounded-md transition-all",
                activeModule === "alcon" ? "bg-primary text-secondary-foreground shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              ALCON
            </button>
            <button 
              onClick={() => handleModuleChange("conofta")}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold rounded-md transition-all",
                activeModule === "conofta" ? "bg-blue-600 text-white shadow-lg" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              CONOFTA
            </button>
          </div>
        )}
        {/* Role badge for single-world roles */}
        {!collapsed && (roleIsAlconOnly || roleIsConoftaOnly) && (
          <div className="px-4 py-3">
            <div className={cn(
              "rounded-lg py-1.5 text-center text-[10px] font-bold uppercase tracking-widest",
              roleIsConoftaOnly ? "bg-blue-600/20 text-blue-400" : "bg-primary/10 text-primary"
            )}>
              {roleIsConoftaOnly ? "CONOFTA" : "ALCON"}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-sidebar-accent text-primary gold-glow"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-border p-3 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-foreground">
                  {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{user?.user_metadata?.full_name || "Usuario"}</p>
                <p className="text-[10px] text-primary font-medium">{role ? roleLabels[role] || role : "Sin rol"}</p>
              </div>
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex flex-1 items-center justify-center rounded-lg py-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <button
              onClick={signOut}
              className="flex items-center justify-center rounded-lg py-2 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-[68px]" : "ml-[260px]"
        )}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-lg px-6">
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground">
              {allItems.find((i) => i.to === location.pathname)?.label || "Dashboard"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.user_metadata?.full_name || "Usuario"}</p>
              <p className="text-xs text-muted-foreground">{role ? roleLabels[role] || role : ""} · {user?.email}</p>
            </div>
            <div className="h-9 w-9 flex items-center justify-center">
              <img src="/logo.png" alt="S" className="w-full h-full object-contain" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
