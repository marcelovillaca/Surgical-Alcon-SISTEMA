import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Package, Plus, Search, ArrowUpDown, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Clock, Send, Eye, X, Loader2,
  ClipboardList, Warehouse, ArrowRightLeft, BarChart2, FileSpreadsheet
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string; sku: string; name: string; category: string; unit: string;
  base_cost?: number; min_stock: number; is_active: boolean;
}
interface InventoryItem {
  id?: string; product_id: string; institution_id: string; quantity: number;
  product?: Product;
}
interface ReplenishmentRequest {
  id: string; request_number: string; institution_id: string; status: string;
  notes_request?: string; notes_dispatch?: string; notes_received?: string;
  requested_at: string; dispatched_at?: string; received_at?: string;
  institution?: { name: string };
  items?: ReplenishmentItem[];
}
interface ReplenishmentItem {
  id?: string; request_id?: string; product_id: string; qty_requested: number;
  qty_sent?: number; qty_received?: number; divergence_reason?: string;
  product?: Product;
}
interface InventoryTask {
  id: string; institution_id: string; period_year: number; period_month: number;
  status: string; due_date: string; completed_at?: string;
  institution?: { name: string };
}

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

// ─── Generate request number helper ──────────────────────────────────────────
async function generateRequestNumber(): Promise<string> {
  const { data } = await (supabase as any).rpc("generate_request_number");
  return data || `REP-${Date.now()}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConoftaInventario() {
  const { role, institutionId, institutionName, isGerente } = useUserRole();
  const { user } = useAuth();
  const { toast } = useToast();

  const canViewPrices = isGerente;
  const isAdmin = isGerente || role === "admin_conofta";
  const isCoordinador = role === "coordinador_local";

  const [activeTab, setActiveTab] = useState<"stock" | "replenishment" | "tasks" | "products">("stock");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
  const [tasks, setTasks] = useState<InventoryTask[]>([]);
  const [search, setSearch] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<string>(institutionId || "");

  // Panels
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showDispatchPanel, setShowDispatchPanel] = useState<ReplenishmentRequest | null>(null);
  const [showReceivePanel, setShowReceivePanel] = useState<ReplenishmentRequest | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prodRes, instRes] = await Promise.all([
        (supabase as any).from("conofta_products").select("*").order("name"),
        (supabase as any).from("institutions").select("id, name").order("name"),
      ]);
      setProducts(prodRes.data || []);
      setInstitutions(instRes.data || []);

      const invQ = (supabase as any).from("conofta_inventory")
        .select("*, product:conofta_products(*)");
      if (isCoordinador && institutionId) invQ.eq("institution_id", institutionId);
      const { data: invData } = await invQ;
      setInventory(invData || []);

      const repQ = (supabase as any).from("conofta_replenishment_requests")
        .select("*, institution:institutions(name), items:conofta_replenishment_items(*, product:conofta_products(sku, name, unit))")
        .order("created_at", { ascending: false });
      if (isCoordinador && institutionId) repQ.eq("institution_id", institutionId);
      const { data: repData } = await repQ;
      setRequests(repData || []);

      const taskQ = (supabase as any).from("conofta_inventory_tasks")
        .select("*, institution:institutions(name)").order("due_date", { ascending: false });
      if (isCoordinador && institutionId) taskQ.eq("institution_id", institutionId);
      const { data: taskData } = await taskQ;
      setTasks(taskData || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [role, institutionId]);
  useEffect(() => { if (institutionId) setSelectedInstitution(institutionId); }, [institutionId]);

  // ─── Filtered inventory ──────────────────────────────────────────────────────
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesInst = !selectedInstitution || item.institution_id === selectedInstitution;
      const matchesSearch = !search ||
        item.product?.name.toLowerCase().includes(search.toLowerCase()) ||
        item.product?.sku.toLowerCase().includes(search.toLowerCase());
      return matchesInst && matchesSearch;
    });
  }, [inventory, selectedInstitution, search]);

  const lowStockItems = filteredInventory.filter(
    item => item.quantity <= (item.product?.min_stock || 5)
  );

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleCreateRequest = async (items: { product_id: string; qty_requested: number }[], notes: string) => {
    const reqNum = await generateRequestNumber();
    const instId = isCoordinador ? institutionId : selectedInstitution;
    if (!instId) return toast({ title: "Selecione uma sede", variant: "destructive" });

    const { data: req, error: reqErr } = await (supabase as any)
      .from("conofta_replenishment_requests")
      .insert({ request_number: reqNum, institution_id: instId, notes_request: notes, requested_by: user?.id })
      .select().single();

    if (reqErr) return toast({ title: "Erro ao criar pedido", description: reqErr.message, variant: "destructive" });

    const itemsToInsert = items.map(i => ({ ...i, request_id: req.id }));
    await (supabase as any).from("conofta_replenishment_items").insert(itemsToInsert);

    toast({ title: `✅ Pedido ${reqNum} criado com sucesso!` });
    setShowNewRequest(false);
    fetchAll();
  };

  const handleDispatch = async (reqId: string, items: { id: string; qty_sent: number }[], notes: string) => {
    await (supabase as any).from("conofta_replenishment_requests")
      .update({ status: "enviado", notes_dispatch: notes, dispatched_by: user?.id, dispatched_at: new Date().toISOString() })
      .eq("id", reqId);

    for (const item of items) {
      await (supabase as any).from("conofta_replenishment_items")
        .update({ qty_sent: item.qty_sent }).eq("id", item.id);
    }
    toast({ title: "✅ Pedido marcado como Enviado" });
    setShowDispatchPanel(null);
    fetchAll();
  };

  const handleReceive = async (reqId: string, institution_id: string, items: { id: string; product_id: string; qty_received: number; qty_sent: number; divergence_reason?: string }[], notes: string) => {
    const hasDivergence = items.some(i => i.qty_received !== i.qty_sent);
    const newStatus = hasDivergence ? "divergente" : "recebido";

    await (supabase as any).from("conofta_replenishment_requests")
      .update({ status: newStatus, notes_received: notes, received_by: user?.id, received_at: new Date().toISOString() })
      .eq("id", reqId);

    for (const item of items) {
      await (supabase as any).from("conofta_replenishment_items")
        .update({ qty_received: item.qty_received, divergence_reason: item.divergence_reason })
        .eq("id", item.id);
    }

    // Update inventory
    for (const item of items) {
      const { data: existing } = await (supabase as any).from("conofta_inventory")
        .select("id, quantity").eq("institution_id", institution_id).eq("product_id", item.product_id).maybeSingle();

      if (existing) {
        await (supabase as any).from("conofta_inventory")
          .update({ quantity: existing.quantity + item.qty_received, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await (supabase as any).from("conofta_inventory")
          .insert({ institution_id, product_id: item.product_id, quantity: item.qty_received });
      }

      // Stock movement record
      await (supabase as any).from("conofta_stock_movements").insert({
        institution_id, product_id: item.product_id,
        movement_type: "entrada_reposicao",
        quantity: item.qty_received,
        reference_id: reqId, reference_type: "replenishment_request",
        notes: hasDivergence ? `Divergência detectada. ${item.divergence_reason || ""}` : "Recepção confirmada",
        created_by: user?.id
      });
    }

    if (hasDivergence) {
      toast({ title: "⚠️ Pedido recebido com divergências", description: "O Gerente foi notificado.", variant: "destructive" });
    } else {
      toast({ title: "✅ Recepção confirmada! Estoque atualizado." });
    }
    setShowReceivePanel(null);
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-card/80 to-blue-950/20 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Warehouse className="h-48 w-48 text-blue-400" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-display font-bold text-foreground">
                Gestión de <span className="text-blue-400">Inventario</span>
              </h1>
              {lowStockItems.length > 0 && (
                <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse">
                  {lowStockItems.length} Stock Bajo
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isCoordinador ? `Sede: ${institutionName}` : "Vista consolidada de todas las sedes"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!isAdmin && (
              <Button onClick={() => setShowNewRequest(true)} className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                <Plus className="h-4 w-4 mr-2" /> Solicitar Reposición
              </Button>
            )}
            {isGerente && (
              <Button variant="outline" onClick={() => setShowNewProduct(true)} className="border-primary/30 hover:border-primary">
                <Package className="h-4 w-4 mr-2" /> Nuevo Producto
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Bar ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Productos Activos", value: products.filter(p => p.is_active).length, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Stock Bajo ⚠", value: lowStockItems.length, color: lowStockItems.length > 0 ? "text-rose-400" : "text-emerald-400", bg: lowStockItems.length > 0 ? "bg-rose-500/10" : "bg-emerald-500/10" },
          { label: "Pedidos Pendientes", value: requests.filter(r => r.status === "pendente").length, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Tareas de Inventario", value: tasks.filter(t => t.status === "pendente").length, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map(k => (
          <div key={k.label} className={cn("rounded-2xl border border-border p-5 space-y-1", k.bg)}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k.label}</p>
            <p className={cn("text-3xl font-black font-display", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border pb-0">
        {[
          { key: "stock", label: "Estoque Atual", icon: Warehouse },
          { key: "replenishment", label: "Pedidos / Reposición", icon: ArrowRightLeft },
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
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..."
                className="w-full pl-10 pr-4 h-10 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {isAdmin && (
              <select
                value={selectedInstitution} onChange={e => setSelectedInstitution(e.target.value)}
                className="h-10 px-4 rounded-xl border border-border bg-background text-sm outline-none min-w-[200px]"
              >
                <option value="">Todas las Sedes</option>
                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Producto</th>
                  <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoría</th>
                  {isAdmin && <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sede</th>}
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">En Stock</th>
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mínimo</th>
                  <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                  {canViewPrices && <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Costo Unit.</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInventory.length === 0 ? (
                  <tr><td colSpan={7} className="p-16 text-center text-muted-foreground italic">Sin datos de inventario</td></tr>
                ) : filteredInventory.map(item => {
                  const isLow = item.quantity <= (item.product?.min_stock || 5);
                  const catCfg = CATEGORIES[item.product?.category || "outro"];
                  const instName = institutions.find(i => i.id === item.institution_id)?.name || "-";
                  return (
                    <tr key={item.id || item.product_id} className={cn("hover:bg-muted/5 transition-colors", isLow && "bg-rose-950/10")}>
                      <td className="p-4">
                        <p className="font-bold">{item.product?.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.product?.sku}</p>
                      </td>
                      <td className="p-4">
                        <Badge className={cn("text-[9px]", catCfg?.color)}>{catCfg?.label}</Badge>
                      </td>
                      {isAdmin && <td className="p-4 text-xs font-medium">{instName}</td>}
                      <td className="p-4 text-center">
                        <span className={cn("text-2xl font-black", isLow ? "text-rose-400" : "text-foreground")}>
                          {item.quantity}
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">{item.product?.unit}</span>
                      </td>
                      <td className="p-4 text-center text-sm text-muted-foreground">{item.product?.min_stock}</td>
                      <td className="p-4 text-center">
                        {isLow ? (
                          <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[9px]">⚠ Stock Bajo</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]">OK</Badge>
                        )}
                      </td>
                      {canViewPrices && (
                        <td className="p-4 text-right text-sm font-bold text-primary">
                          {item.product?.base_cost ? `$${item.product.base_cost.toLocaleString()}` : "-"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PEDIDOS / REPOSIÇÃO ──────────────────────────────────────────────── */}
      {activeTab === "replenishment" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              Pedido → Enviado → Recibido
            </h3>
            {isCoordinador && (
              <Button onClick={() => setShowNewRequest(true)} size="sm" className="bg-blue-600 hover:bg-blue-500">
                <Plus className="h-4 w-4 mr-1" /> Nuevo Pedido
              </Button>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
            {requests.length === 0 ? (
              <div className="p-16 text-center text-muted-foreground italic">Sin pedidos registrados</div>
            ) : requests.map(req => {
              const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pendente;
              const Icon = cfg.icon;
              const isExpanded = expandedRequest === req.id;
              return (
                <div key={req.id} className="border-b border-border last:border-0">
                  <div
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/5 transition-colors"
                    onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                  >
                    <div className="flex items-center gap-4">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <div>
                        <p className="font-black text-sm">{req.request_number}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {req.institution?.name} · {new Date(req.requested_at).toLocaleDateString("es-PY")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={cn("text-[10px] border", cfg.color)}>
                        <Icon className="h-3 w-3 mr-1" />{cfg.label}
                      </Badge>
                      {/* Action buttons */}
                      {isAdmin && req.status === "pendente" && (
                        <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 h-7 text-xs"
                          onClick={e => { e.stopPropagation(); setShowDispatchPanel(req); }}>
                          <Send className="h-3 w-3 mr-1" /> Despachar
                        </Button>
                      )}
                      {req.status === "enviado" && (
                        <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-7 text-xs"
                          onClick={e => { e.stopPropagation(); setShowReceivePanel(req); }}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar Recepción
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded: Items grid (Pedido / Enviado / Recibido) */}
                  {isExpanded && req.items && (
                    <div className="border-t border-border bg-muted/10 px-6 pb-6 pt-4">
                      {req.notes_request && <p className="text-xs text-muted-foreground mb-4 italic">"{req.notes_request}"</p>}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">
                            <th className="pb-3 text-left">Producto</th>
                            <th className="pb-3 text-center text-amber-400">Pedido</th>
                            <th className="pb-3 text-center text-blue-400">Enviado</th>
                            <th className="pb-3 text-center text-emerald-400">Recibido</th>
                            <th className="pb-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {req.items.map(item => {
                            const sentDiff = item.qty_sent != null && item.qty_sent < item.qty_requested;
                            const recvDiff = item.qty_received != null && item.qty_sent != null && item.qty_received !== item.qty_sent;
                            return (
                              <tr key={item.id} className="hover:bg-muted/10">
                                <td className="py-3">
                                  <p className="font-bold">{item.product?.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{item.product?.sku} · {item.product?.unit}</p>
                                </td>
                                <td className="py-3 text-center font-black text-amber-400">{item.qty_requested}</td>
                                <td className="py-3 text-center">
                                  {item.qty_sent != null ? (
                                    <span className={cn("font-black", sentDiff ? "text-rose-400" : "text-blue-400")}>
                                      {item.qty_sent} {sentDiff && <span className="text-[9px] ml-1">⚠</span>}
                                    </span>
                                  ) : <span className="text-zinc-600">—</span>}
                                </td>
                                <td className="py-3 text-center">
                                  {item.qty_received != null ? (
                                    <span className={cn("font-black", recvDiff ? "text-rose-400" : "text-emerald-400")}>
                                      {item.qty_received} {recvDiff && <span className="text-[9px] ml-1">⚠</span>}
                                    </span>
                                  ) : <span className="text-zinc-600">—</span>}
                                </td>
                                <td className="py-3 text-center">
                                  {item.qty_received == null ? (
                                    <Badge className="text-[8px] bg-zinc-500/10 text-zinc-400 border-zinc-500/20">Pendente</Badge>
                                  ) : recvDiff ? (
                                    <Badge className="text-[8px] bg-rose-500/10 text-rose-400 border-rose-500/20">Divergência</Badge>
                                  ) : (
                                    <Badge className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">OK</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {req.notes_dispatch && (
                        <p className="text-[10px] text-blue-400 mt-3 italic">Central: "{req.notes_dispatch}"</p>
                      )}
                      {req.notes_received && (
                        <p className="text-[10px] text-emerald-400 mt-1 italic">Sede: "{req.notes_received}"</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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

      {/* ── CATÁLOGO (Gerente) ────────────────────────────────────────────────── */}
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
        <NewRequestPanel
          products={products}
          institutions={isCoordinador ? institutions.filter(i => i.id === institutionId) : institutions}
          defaultInstitution={institutionId || ""}
          isCoordinador={isCoordinador}
          onSubmit={handleCreateRequest}
          onClose={() => setShowNewRequest(false)}
        />
      )}

      {/* ── PANEL: Despachar ──────────────────────────────────────────────────── */}
      {showDispatchPanel && (
        <DispatchPanel
          request={showDispatchPanel}
          onSubmit={handleDispatch}
          onClose={() => setShowDispatchPanel(null)}
        />
      )}

      {/* ── PANEL: Receber ────────────────────────────────────────────────────── */}
      {showReceivePanel && (
        <ReceivePanel
          request={showReceivePanel}
          onSubmit={handleReceive}
          onClose={() => setShowReceivePanel(null)}
        />
      )}

      {/* ── PANEL: Nuevo Producto ─────────────────────────────────────────────── */}
      {showNewProduct && isGerente && (
        <NewProductPanel
          onSubmit={async (data) => {
            const { error } = await (supabase as any).from("conofta_products").insert({ ...data, created_by: user?.id });
            if (!error) { toast({ title: "✅ Produto criado!" }); setShowNewProduct(false); fetchAll(); }
            else toast({ title: "Erro", description: error.message, variant: "destructive" });
          }}
          onClose={() => setShowNewProduct(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-Panels ───────────────────────────────────────────────────────────────
function PanelWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function NewRequestPanel({ products, institutions, defaultInstitution, isCoordinador, onSubmit, onClose }: any) {
  const [instId, setInstId] = useState(defaultInstitution);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; qty_requested: number }[]>([
    { product_id: "", qty_requested: 1 }
  ]);

  return (
    <PanelWrapper title="Nueva Solicitud de Reposición" onClose={onClose}>
      <div className="space-y-5">
        {!isCoordinador && (
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Sede</label>
            <select value={instId} onChange={e => setInstId(e.target.value)}
              className="w-full h-10 px-4 rounded-xl border border-border bg-background text-sm outline-none">
              <option value="">Seleccione sede...</option>
              {institutions.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Productos Solicitados</label>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_120px_32px] gap-2 items-center">
                <select value={item.product_id}
                  onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, product_id: e.target.value } : it))}
                  className="h-10 px-3 rounded-xl border border-border bg-background text-sm outline-none">
                  <option value="">Seleccione producto...</option>
                  {products.filter((p: Product) => p.is_active).map((p: Product) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                  ))}
                </select>
                <input type="number" min={1} value={item.qty_requested}
                  onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, qty_requested: Number(e.target.value) } : it))}
                  className="h-10 px-3 rounded-xl border border-border bg-background text-sm text-center outline-none"
                  placeholder="Cant." />
                <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                  className="text-rose-500 hover:bg-rose-500/10 rounded-lg p-1 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button onClick={() => setItems(prev => [...prev, { product_id: "", qty_requested: 1 }])}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-bold transition-colors">
              <Plus className="h-4 w-4" /> Agregar producto
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Observaciones</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm outline-none resize-none" />
        </div>
        <Button className="w-full bg-blue-600 hover:bg-blue-500"
          onClick={() => { if (items.some(i => i.product_id)) onSubmit(items.filter(i => i.product_id), notes); }}>
          Enviar Solicitud
        </Button>
      </div>
    </PanelWrapper>
  );
}

function DispatchPanel({ request, onSubmit, onClose }: any) {
  const [notes, setNotes] = useState("");
  const [sentQtys, setSentQtys] = useState<Record<string, number>>(
    Object.fromEntries((request.items || []).map((i: any) => [i.id, i.qty_requested]))
  );
  return (
    <PanelWrapper title={`Despachar Pedido ${request.request_number}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground mb-3 font-bold uppercase tracking-widest">Confirme las cantidades a enviar</p>
          <div className="space-y-3">
            {(request.items || []).map((item: ReplenishmentItem) => (
              <div key={item.id} className="grid grid-cols-[1fr_100px_100px] gap-3 items-center text-sm">
                <div>
                  <p className="font-bold">{item.product?.name}</p>
                  <p className="text-[10px] text-muted-foreground">{item.product?.sku}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-amber-400 font-bold uppercase">Pedido</p>
                  <p className="text-lg font-black text-amber-400">{item.qty_requested}</p>
                </div>
                <div>
                  <p className="text-[9px] text-blue-400 font-bold uppercase text-center mb-1">A Enviar</p>
                  <input type="number" min={0} max={item.qty_requested}
                    value={sentQtys[item.id!] ?? item.qty_requested}
                    onChange={e => setSentQtys(prev => ({ ...prev, [item.id!]: Number(e.target.value) }))}
                    className="w-full h-9 px-2 rounded-lg border border-blue-500/30 bg-background text-center text-sm font-black text-blue-400 outline-none" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Notas del Despacho</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm outline-none resize-none" />
        </div>
        <Button className="w-full bg-blue-600 hover:bg-blue-500"
          onClick={() => onSubmit(request.id, Object.entries(sentQtys).map(([id, qty_sent]) => ({ id, qty_sent })), notes)}>
          <Send className="h-4 w-4 mr-2" /> Confirmar Despacho
        </Button>
      </div>
    </PanelWrapper>
  );
}

function ReceivePanel({ request, onSubmit, onClose }: any) {
  const [notes, setNotes] = useState("");
  const [receivedItems, setReceivedItems] = useState(
    (request.items || []).map((i: any) => ({
      id: i.id, product_id: i.product_id, qty_received: i.qty_sent || 0,
      qty_sent: i.qty_sent || 0, divergence_reason: ""
    }))
  );
  return (
    <PanelWrapper title={`Confirmar Recepción: ${request.request_number}`} onClose={onClose}>
      <div className="space-y-5">
        <div className="rounded-xl bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground mb-3 font-bold uppercase tracking-widest">Ingrese la cantidad físicamente recibida</p>
          <div className="space-y-4">
            {(request.items || []).map((item: ReplenishmentItem, idx: number) => {
              const ri = receivedItems[idx];
              const hasDiff = ri?.qty_received !== ri?.qty_sent;
              return (
                <div key={item.id} className="space-y-2">
                  <div className="grid grid-cols-[1fr_90px_90px_90px] gap-3 items-center text-sm">
                    <div>
                      <p className="font-bold">{item.product?.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.product?.sku}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-amber-400 font-bold uppercase">Pedido</p>
                      <p className="text-lg font-black text-amber-400">{item.qty_requested}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-blue-400 font-bold uppercase">Enviado</p>
                      <p className="text-lg font-black text-blue-400">{item.qty_sent ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-emerald-400 font-bold uppercase text-center mb-1">Recibido</p>
                      <input type="number" min={0}
                        value={ri?.qty_received}
                        onChange={e => setReceivedItems((prev: any) => prev.map((p: any, i: number) => i === idx ? { ...p, qty_received: Number(e.target.value) } : p))}
                        className={cn(
                          "w-full h-9 px-2 rounded-lg border bg-background text-center text-sm font-black outline-none",
                          hasDiff ? "border-rose-500/50 text-rose-400" : "border-emerald-500/30 text-emerald-400"
                        )} />
                    </div>
                  </div>
                  {hasDiff && (
                    <div className="pl-0">
                      <input placeholder="Motivo de la divergencia (obligatorio)..."
                        value={ri?.divergence_reason || ""}
                        onChange={e => setReceivedItems((prev: any) => prev.map((p: any, i: number) => i === idx ? { ...p, divergence_reason: e.target.value } : p))}
                        className="w-full h-8 px-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 outline-none" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Observaciones Generales</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm outline-none resize-none" />
        </div>
        <Button className="w-full bg-emerald-600 hover:bg-emerald-500"
          onClick={() => onSubmit(request.id, request.institution_id, receivedItems, notes)}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Recepción
        </Button>
      </div>
    </PanelWrapper>
  );
}

function NewProductPanel({ onSubmit, onClose }: any) {
  const [form, setForm] = useState({ sku: "", name: "", category: "insumo", unit: "unid", base_cost: 0, min_stock: 5, notes: "" });
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));
  return (
    <PanelWrapper title="Nuevo Producto" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        {[
          { k: "sku", label: "SKU", type: "text", full: false },
          { k: "name", label: "Nombre", type: "text", full: true },
        ].map(f => (
          <div key={f.k} className={f.full ? "col-span-2" : ""}>
            <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">{f.label}</label>
            <input type={f.type} value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)}
              className="w-full h-10 px-4 rounded-xl border border-border bg-background text-sm outline-none" />
          </div>
        ))}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Categoría</label>
          <select value={form.category} onChange={e => set("category", e.target.value)}
            className="w-full h-10 px-4 rounded-xl border border-border bg-background text-sm outline-none">
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Unidad</label>
          <select value={form.unit} onChange={e => set("unit", e.target.value)}
            className="w-full h-10 px-4 rounded-xl border border-border bg-background text-sm outline-none">
            {["unid","caja","ml","pares","kit"].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Costo Base ($)</label>
          <input type="number" min={0} step={0.01} value={form.base_cost} onChange={e => set("base_cost", Number(e.target.value))}
            className="w-full h-10 px-4 rounded-xl border border-border bg-background text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Stock Mínimo</label>
          <input type="number" min={0} value={form.min_stock} onChange={e => set("min_stock", Number(e.target.value))}
            className="w-full h-10 px-4 rounded-xl border border-border bg-background text-sm outline-none" />
        </div>
        <div className="col-span-2">
          <Button className="w-full bg-primary hover:bg-primary/80" onClick={() => onSubmit(form)}>
            Guardar Producto
          </Button>
        </div>
      </div>
    </PanelWrapper>
  );
}
