import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Package, Plus, Search, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Clock, Send, X, Loader2,
  ClipboardList, Warehouse, ArrowRightLeft,
  Droplets
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InventoryProvider, useInventory } from "@/components/conofta/inventory/InventoryProvider";
import { InventoryStats } from "@/components/conofta/inventory/InventoryStats";
import { StockTable } from "@/components/conofta/inventory/StockTable";
import { ReplenishmentTabs } from "@/components/conofta/inventory/ReplenishmentTabs";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NewRequestPanel } from "@/components/conofta/inventory/panels/NewRequestPanel";
import { DispatchPanel } from "@/components/conofta/inventory/panels/DispatchPanel";
import { ReceivePanel } from "@/components/conofta/inventory/panels/ReceivePanel";
import { NewProductPanel } from "@/components/conofta/inventory/panels/NewProductPanel";
import { JourneyConsumptionPanel } from "@/components/conofta/inventory/panels/JourneyConsumptionPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  lente: { label: "Lente", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  insumo: { label: "Insumo", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  equipamento: { label: "Equipamento", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  outro: { label: "Outro", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Clock },
  enviado: { label: "Enviado", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Send },
  recebido: { label: "Recebido ✓", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  divergente: { label: "Divergência ⚠", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", icon: AlertTriangle },
  cancelado: { label: "Cancelado", color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20", icon: X },
};

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ─── Main Component Wrapper ──────────────────────────────────────────────────
export default function ConoftaInventarioPage() {
  return (
    <InventoryProvider>
      <ConoftaInventario />
    </InventoryProvider>
  );
}

function ConoftaInventario() {
  const {
    loading,
    products,
    inventory,
    institutions,
    requests,
    tasks,
    journeys,
    selectedJourneyConsumptions,
    institutionId,
    institutionName,
    isGerente,
    isAdmin,
    isCoordinador,
    fetchAll,
    handleCreateRequest,
    handleDispatch,
    handleReceive,
    handleFetchJourneyConsumptions,
    handleSaveJourneyConsumption
  } = useInventory();

  const { user } = useAuth();
  const { toast } = useToast();

  const canViewPrices = isGerente;

  const [activeTab, setActiveTab] = useState<"stock" | "replenishment" | "tasks" | "products" | "consumption">("stock");

  // Panels
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showDispatchPanel, setShowDispatchPanel] = useState<any | null>(null);
  const [showReceivePanel, setShowReceivePanel] = useState<any | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showConsumptionPanel, setShowConsumptionPanel] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>("");
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  // ─── Local Action Wrappers ──────────────────────────────────────────────────
  const onCreateRequest = async (items: any[], notes: string) => {
    await handleCreateRequest(items, notes, selectedInstitution);
    setShowNewRequest(false);
  };

  const onDispatch = async (reqId: string, items: any[], notes: string) => {
    await handleDispatch(reqId, items, notes);
    setShowDispatchPanel(null);
  };

  const onReceive = async (reqId: string, instId: string, items: any[], notes: string) => {
    await handleReceive(reqId, instId, items, notes);
    setShowReceivePanel(null);
  };

  const onSelectJourney = async (journeyId: string) => {
    setSelectedJourneyId(journeyId);
    await handleFetchJourneyConsumptions(journeyId);
  };

  const onSaveJourneyConsumption = async (journeyId: string, items: any[]) => {
    await handleSaveJourneyConsumption(journeyId, items);
    setShowConsumptionPanel(false);
  };

  // Still loading auth/role
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
          <p className="text-xs text-muted-foreground">Carregando inventário...</p>
        </div>
      </div>
    );
  }

  // Tables not applied yet — show setup guide instead of blank page
  if (!loading && products.length === 0 && inventory.length === 0) {
    const showSetupBanner = isAdmin;
    if (showSetupBanner) {
      // Only show setup banner when tables are truly empty (not just no stock)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-[1600px] mx-auto pb-12">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-blue-500/20 bg-gradient-to-br from-card/40 to-blue-950/20 backdrop-blur-xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
          <Warehouse className="h-48 w-48 text-blue-400 rotate-12" />
        </div>
        
        <div className="absolute -bottom-24 -left-24 h-64 w-64 bg-blue-500/10 rounded-full blur-[80px]" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <Warehouse className="h-6 w-6 text-blue-400" />
              </div>
              <h1 className="text-4xl font-display font-black tracking-tight text-foreground">
                Gestión de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Inventario</span>
              </h1>
            </div>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              {isCoordinador ? `Sede Operativa: ${institutionName}` : "Consolidado Global de Red de Sedes"}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <AnimatePresence mode="wait">
              {!isAdmin && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex gap-3"
                >
                  <Button 
                    onClick={() => setShowConsumptionPanel(true)} 
                    variant="outline" 
                    className="h-11 rounded-xl border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all font-bold"
                  >
                    <Droplets className="h-4 w-4 mr-2" /> Lançar Consumo
                  </Button>
                  <Button 
                    onClick={() => setShowNewRequest(true)} 
                    className="h-11 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-[0_10px_20px_rgba(37,99,235,0.3)] font-black px-6"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Solicitar Reposición
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            
            {isGerente && (
              <Button 
                variant="outline" 
                onClick={() => setShowNewProduct(true)} 
                className="h-11 rounded-xl border-blue-400/20 bg-blue-400/5 hover:bg-blue-400/10 font-bold"
              >
                <Package className="h-4 w-4 mr-2 text-blue-400" /> Nuevo Producto
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── KPI Dashboard ─────────────────────────────────────────────────── */}
      <InventoryStats />

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border pb-0">
        {[
          { key: "stock", label: "Estoque Atual", icon: Warehouse },
          { key: "replenishment", label: "Pedidos / Reposición", icon: ArrowRightLeft },
          { key: "consumption", label: "Consumo de Jornadas", icon: Droplets },
          { key: "tasks", label: "Tareas de Inventario", icon: ClipboardList },
          ...(isGerente ? [{ key: "products", label: "Catálogo de Productos", icon: Package }] : []),
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all -mb-px",
              activeTab === tab.key
                ? "border-blue-400 text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ESTOQUE ATUAL ────────────────────────────────────────────────────── */}
      {activeTab === "stock" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <StockTable />
        </motion.div>
      )}

      {/* ── PEDIDOS / REPOSIÇÃO ──────────────────────────────────────────────── */}
      {activeTab === "replenishment" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <ReplenishmentTabs 
            onShowNewRequest={() => setShowNewRequest(true)}
            onShowDispatch={setShowDispatchPanel}
            onShowReceive={setShowReceivePanel}
          />
        </motion.div>
      )}

      {/* ── TAREFAS ──────────────────────────────────────────────────────────── */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
            <div className="px-6 py-4 bg-muted/30 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold">Tareas de Inventario Mensual</h3>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={async () => {
                  const now = new Date();
                  for (const inst of institutions) {
                    const due = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    await (supabase as any).from("conofta_inventory_tasks").upsert({
                      institution_id: inst.id, period_year: now.getFullYear(),
                      period_month: now.getMonth() + 1, due_date: due.toISOString().split("T")[0]
                    }, { onConflict: "institution_id,period_year,period_month" });
                  }
                  toast({ title: "Tarefas do mês criadas!" });
                  fetchAll();
                }}>
                  <ClipboardList className="h-4 w-4 mr-1" /> Generar Tareas del Mes
                </Button>
              )}
            </div>
            <div className="divide-y divide-border">
              {tasks.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground italic">Sin tareas de inventario</div>
              ) : tasks.map(task => {
                const isOverdue = new Date(task.due_date) < new Date() && task.status === "pendente";
                return (
                  <div key={task.id} className={cn("p-5 flex items-center justify-between", isOverdue && "bg-rose-950/10")}>
                    <div>
                      <p className="font-bold text-sm">
                        {task.institution?.name} · {MONTH_NAMES[task.period_month - 1]} {task.period_year}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Vence: {new Date(task.due_date).toLocaleDateString("es-PY")}
                        {isOverdue && " · ⚠ VENCIDA"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={cn("border text-[10px]", {
                        "bg-pendente/10 text-amber-400 border-amber-500/20": task.status === "pendente",
                        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20": task.status === "concluido",
                        "bg-rose-500/10 text-rose-400 border-rose-500/20": task.status === "com_divergencia",
                      })}>
                        {task.status === "pendente" ? "Pendente" : task.status === "concluido" ? "Concluido ✓" : "Con Divergencia ⚠"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CONSUMO DE JORNADORES ────────────────────────────────────────────── */}
      {activeTab === "consumption" && (
        <div className="space-y-4">
          <div className="flex gap-4 items-center">
            <Select value={selectedJourneyId} onValueChange={onSelectJourney}>
              <SelectTrigger className="w-[300px] h-10 rounded-xl">
                <SelectValue placeholder="Seleccione una jornada..." />
              </SelectTrigger>
              <SelectContent>
                {journeys.map(j => (
                  <SelectItem key={j.id} value={j.id}>{j.name} ({format(parseISO(j.date), "dd/MM/yy")})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowConsumptionPanel(true)} disabled={!selectedJourneyId} className="bg-emerald-600 hover:bg-emerald-500">
              <Plus className="h-4 w-4 mr-2" /> Registrar Consumo
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="p-4 text-left text-[10px] font-black uppercase text-muted-foreground">Producto de Consumo</th>
                  <th className="p-4 text-center text-[10px] font-black uppercase text-muted-foreground">Quantidade Usada</th>
                  <th className="p-4 text-center text-[10px] font-black uppercase text-muted-foreground">Unidad</th>
                  {isGerente && <th className="p-4 text-right text-[10px] font-black uppercase text-muted-foreground">Custo Total</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {selectedJourneyConsumptions.length === 0 ? (
                  <tr><td colSpan={4} className="p-16 text-center text-muted-foreground italic">
                    {selectedJourneyId ? "Sin insumos registrados para esta jornada" : "Seleccione una jornada para ver el consumo"}
                  </td></tr>
                ) : selectedJourneyConsumptions.map(c => (
                  <tr key={c.id}>
                    <td className="p-4 font-bold">{c.product?.name}</td>
                    <td className="p-4 text-center text-emerald-400 font-black">{c.quantity}</td>
                    <td className="p-4 text-center text-muted-foreground">{c.product?.unit}</td>
                    {isGerente && (
                      <td className="p-4 text-right font-bold text-primary">
                        ${((c.product?.base_cost || 0) * c.quantity).toLocaleString()}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === "products" && isGerente && (
        <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                {["SKU","Nombre","Categoría","Unidad","Costo Base","Mínimo","Estado"].map(h => (
                  <th key={h} className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.length === 0 ? (
                <tr><td colSpan={7} className="p-16 text-center text-muted-foreground italic">Sin productos cargados · Use "Nuevo Producto" para agregar</td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-muted/5">
                  <td className="p-4 font-mono text-xs text-muted-foreground">{p.sku}</td>
                  <td className="p-4 font-bold">{p.name}</td>
                  <td className="p-4"><Badge className={cn("text-[9px]", CATEGORIES[p.category]?.color)}>{CATEGORIES[p.category]?.label}</Badge></td>
                  <td className="p-4 text-muted-foreground">{p.unit}</td>
                  <td className="p-4 font-bold text-primary">{p.base_cost ? `$${p.base_cost.toLocaleString()}` : "—"}</td>
                  <td className="p-4 text-center">{p.min_stock}</td>
                  <td className="p-4">
                    <Badge className={cn("text-[9px]", p.is_active ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400")}>
                      {p.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PANEL: Nuevo Pedido ───────────────────────────────────────────────── */}
      {showNewRequest && (
        <PanelWrapper title="Nueva Solicitud" onClose={() => setShowNewRequest(false)}>
          <NewRequestPanel
            products={products}
            institutions={isCoordinador ? institutions.filter(i => i.id === institutionId) : institutions}
            defaultInstitution={institutionId || ""}
            isCoordinador={isCoordinador}
            onSubmit={onCreateRequest}
            onClose={() => setShowNewRequest(false)}
          />
        </PanelWrapper>
      )}

      {/* ── PANEL: Despachar ──────────────────────────────────────────────────── */}
      {showDispatchPanel && (
        <PanelWrapper title="Despachar Pedido" onClose={() => setShowDispatchPanel(null)}>
          <DispatchPanel
            request={showDispatchPanel}
            onSubmit={onDispatch}
            onClose={() => setShowDispatchPanel(null)}
          />
        </PanelWrapper>
      )}

      {/* ── PANEL: Receber ────────────────────────────────────────────────────── */}
      {showReceivePanel && (
        <PanelWrapper title="Recepción de Insumos" onClose={() => setShowReceivePanel(null)}>
          <ReceivePanel
            request={showReceivePanel}
            onSubmit={onReceive}
            onClose={() => setShowReceivePanel(null)}
          />
        </PanelWrapper>
      )}

      {/* ── PANEL: Nuevo Producto ─────────────────────────────────────────────── */}
      {showNewProduct && isGerente && (
        <PanelWrapper title="Configurar Producto" onClose={() => setShowNewProduct(false)}>
          <NewProductPanel
            onSubmit={async (data: any) => {
              const { error } = await (supabase as any).from("conofta_products").insert({ ...data, created_by: user?.id });
              if (!error) { toast({ title: "✅ Produto criado!" }); setShowNewProduct(false); fetchAll(); }
              else toast({ title: "Erro", description: error.message, variant: "destructive" });
            }}
          />
        </PanelWrapper>
      )}

      {/* ── PANEL: Consumo Jornada ────────────────────────────────────────────── */}
      {showConsumptionPanel && (
        <PanelWrapper title="Registro de Consumo" onClose={() => setShowConsumptionPanel(false)}>
          <JourneyConsumptionPanel
            products={products.filter(p => p.category === "insumo")}
            journeyId={selectedJourneyId}
            journeys={journeys}
            onSubmit={onSaveJourneyConsumption}
          />
        </PanelWrapper>
      )}
    </div>
  );
}

// ─── Sub-Panels Wrapper ─────────────────────────────────────────────────────
function PanelWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-xl bg-card/60 backdrop-blur-2xl border-l border-white/10 shadow-2xl overflow-y-auto">
        <SheetHeader className="mb-8">
          <SheetTitle className="text-2xl font-black tracking-tight text-foreground uppercase">
            {title}
          </SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

