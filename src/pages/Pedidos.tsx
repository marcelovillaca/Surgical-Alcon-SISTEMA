import { useState, useEffect, useMemo } from "react";
import { ClipboardList, Plus, ArrowRight, Search, Package, Loader2, Trash2, Edit3, X, Check, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

type Order = {
  id: string;
  order_number: string;
  status: string;
  total_pyg: number;
  created_at: string;
  notes: string | null;
  client: { id: string; name: string; city: string | null; address: string | null } | null;
  items: OrderItem[];
};

type OrderItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price_pyg: number;
  subtotal_pyg: number;
  dioptria: string | null;
  toricidad: string | null;
  notes: string | null;
  product?: Product;
};

type Client = { id: string; name: string; city: string | null; address: string | null };
type Product = { id: string; name: string; sku: string; price_base_pyg: number; product_line: string };

// Product lines that require lens fields
const LENS_LINES = ["total_monofocals", "atiols"];
const TORIC_LINES = ["atiols"];

const estadoLabels: Record<string, string> = {
  borrador: "Borrador", pendiente: "Pendiente", en_preparacion: "En Preparación",
  en_ruta: "En Ruta", entregado: "Entregado", devolucion: "Devolución",
};

const estadoColors: Record<string, string> = {
  borrador: "bg-muted text-muted-foreground",
  pendiente: "bg-primary/10 text-primary",
  en_preparacion: "bg-chart-3/10 text-chart-3",
  en_ruta: "bg-chart-5/10 text-chart-5",
  entregado: "bg-secondary/10 text-secondary",
  devolucion: "bg-destructive/10 text-destructive",
};

const formatPYG = (v: number) => `₲ ${v.toLocaleString()}`;

type FormItem = { productId: string; quantity: number; dioptria: string; toricidad: string; notes: string };

export default function Pedidos() {
  const { user } = useAuth();
  const { isGerente } = useUserRole();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [formClientId, setFormClientId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formItems, setFormItems] = useState<FormItem[]>([{ productId: "", quantity: 1, dioptria: "", toricidad: "", notes: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  // Detail view
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders(); fetchClients(); fetchProducts();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("id, name, city, address");
    if (data) setClients(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name, sku, price_base_pyg, product_line").eq("active", true);
    if (data) setProducts(data);
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data: ordersData } = await supabase.from("orders")
      .select("id, order_number, status, total_pyg, created_at, notes, client_id")
      .order("created_at", { ascending: false });

    if (ordersData) {
      const enriched: Order[] = await Promise.all(
        ordersData.map(async (o) => {
          const { data: clientData } = await supabase.from("clients").select("id, name, city, address").eq("id", o.client_id).maybeSingle();
          const { data: itemsData } = await supabase.from("order_items")
            .select("id, product_id, quantity, unit_price_pyg, subtotal_pyg, dioptria, toricidad, notes")
            .eq("order_id", o.id);

          const items = (itemsData || []).map((item) => ({
            ...item,
            product: products.find((p) => p.id === item.product_id),
          }));

          return { ...o, client: clientData, items } as Order;
        })
      );
      setOrders(enriched);
    }
    setLoading(false);
  };

  const handleSaveOrder = async () => {
    if (!formClientId || !user) return;
    setSubmitting(true);

    const validItems = formItems.filter((i) => i.productId && i.quantity > 0);
    if (validItems.length === 0) {
      toast({ title: "Error", description: "Agregue al menos un producto.", variant: "destructive" });
      setSubmitting(false); return;
    }

    // Validate lens fields
    for (const item of validItems) {
      const product = products.find((p) => p.id === item.productId);
      if (product && LENS_LINES.includes(product.product_line) && !item.dioptria) {
        toast({ title: "Error", description: `${product.name} requiere dioptría.`, variant: "destructive" });
        setSubmitting(false); return;
      }
      if (product && TORIC_LINES.includes(product.product_line) && !item.toricidad) {
        toast({ title: "Error", description: `${product.name} requiere toricidad.`, variant: "destructive" });
        setSubmitting(false); return;
      }
    }

    let totalPyg = 0;
    const itemsToInsert = validItems.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const unitPrice = product?.price_base_pyg || 0;
      const subtotal = unitPrice * item.quantity;
      totalPyg += subtotal;
      return { productId: item.productId, quantity: item.quantity, unitPrice, subtotal, dioptria: item.dioptria || null, toricidad: item.toricidad || null, notes: item.notes || null };
    });

    if (editingOrderId) {
      // Update existing order
      await supabase.from("orders").update({ client_id: formClientId, total_pyg: totalPyg, notes: formNotes || null }).eq("id", editingOrderId);
      await supabase.from("order_items").delete().eq("order_id", editingOrderId);
      for (const item of itemsToInsert) {
        await supabase.from("order_items").insert({
          order_id: editingOrderId, product_id: item.productId, quantity: item.quantity,
          unit_price_pyg: item.unitPrice, subtotal_pyg: item.subtotal, dioptria: item.dioptria, toricidad: item.toricidad, notes: item.notes,
        });
      }
      toast({ title: "Pedido actualizado" });
    } else {
      const orderNumber = `PED-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
      const { data: order, error } = await supabase.from("orders").insert({
        client_id: formClientId, order_number: orderNumber, created_by: user.id,
        total_pyg: totalPyg, notes: formNotes || null, status: "pendiente",
      }).select("id").single();

      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSubmitting(false); return; }
      if (order) {
        for (const item of itemsToInsert) {
          await supabase.from("order_items").insert({
            order_id: order.id, product_id: item.productId, quantity: item.quantity,
            unit_price_pyg: item.unitPrice, subtotal_pyg: item.subtotal, dioptria: item.dioptria, toricidad: item.toricidad, notes: item.notes,
          });
        }
      }
      toast({ title: "Pedido creado", description: `${orderNumber} enviado.` });
    }

    closeForm();
    setSubmitting(false);
    fetchOrders();
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm("¿Está seguro que desea eliminar este pedido?")) return;
    await supabase.from("order_items").delete().eq("order_id", orderId);
    await supabase.from("orders").delete().eq("id", orderId);
    toast({ title: "Pedido eliminado" });
    fetchOrders();
  };

  const handleEdit = (order: Order) => {
    setEditingOrderId(order.id);
    setFormClientId(order.client?.id || "");
    setFormNotes(order.notes || "");
    setFormItems(order.items.map((i) => ({
      productId: i.product_id, quantity: i.quantity,
      dioptria: i.dioptria || "", toricidad: i.toricidad || "", notes: i.notes || "",
    })));
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false); setEditingOrderId(null); setFormClientId(""); setFormNotes("");
    setFormItems([{ productId: "", quantity: 1, dioptria: "", toricidad: "", notes: "" }]);
    setProductSearch(""); setClientSearch("");
  };

  const addItem = () => setFormItems([...formItems, { productId: "", quantity: 1, dioptria: "", toricidad: "", notes: "" }]);
  const removeItem = (idx: number) => setFormItems(formItems.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof FormItem, value: any) => {
    const next = [...formItems]; (next[idx] as any)[field] = value; setFormItems(next);
  };

  const filteredOrders = useMemo(() => orders.filter((o) => {
    const matchSearch = !searchTerm || o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || o.client?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "todos" || o.status === filterStatus;
    return matchSearch && matchStatus;
  }), [orders, searchTerm, filterStatus]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.keys(estadoLabels).forEach((k) => { counts[k] = orders.filter((o) => o.status === k).length; });
    return counts;
  }, [orders]);

  const formTotal = useMemo(() => {
    return formItems.reduce((sum, item) => {
      const p = products.find((pr) => pr.id === item.productId);
      return sum + (p?.price_base_pyg || 0) * item.quantity;
    }, 0);
  }, [formItems, products]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.city?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const needsDioptria = (productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    return p ? LENS_LINES.includes(p.product_line) : false;
  };

  const needsToricidad = (productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    return p ? TORIC_LINES.includes(p.product_line) : false;
  };

  return (
    <div className="space-y-5 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gestión de pedidos y logística</p>
        </div>
        <button onClick={() => { closeForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-xl gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 shadow-lg">
          <Plus className="h-4 w-4" /> Nuevo Pedido
        </button>
      </div>

      {/* Order Form */}
      {showForm && (
        <div className="rounded-2xl border-2 border-primary/30 bg-card p-6 space-y-5 animate-slide-in gold-glow">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-display font-bold text-foreground">
              {editingOrderId ? "Editar Pedido" : "Nuevo Pedido"}
            </h3>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Cliente *</label>
              <input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none mb-1" />
              <select value={formClientId} onChange={(e) => setFormClientId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none">
                <option value="">Seleccionar cliente...</option>
                {filteredClients.map((c) => <option key={c.id} value={c.id}>{c.name} {c.city ? `(${c.city})` : ""}</option>)}
              </select>
              {formClientId && clients.find((c) => c.id === formClientId)?.address && (
                <p className="text-[10px] text-muted-foreground mt-1">📍 {clients.find((c) => c.id === formClientId)?.address}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Notas del Pedido</label>
              <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder="Observaciones para entrega, instrucciones especiales..." />
            </div>
          </div>

          {/* Products */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Productos</label>
              <button onClick={addItem} className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                <Plus className="h-3 w-3" /> Agregar producto
              </button>
            </div>

            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar producto por nombre o SKU..."
                className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>

            {formItems.map((item, idx) => {
              const selectedProduct = products.find((p) => p.id === item.productId);
              return (
                <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none">
                        <option value="">Seleccionar producto...</option>
                        {(productSearch ? filteredProducts : products).map((p) => (
                          <option key={p.id} value={p.id}>{p.name} ({p.sku}) - {formatPYG(p.price_base_pyg)}</option>
                        ))}
                      </select>
                    </div>
                    <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                      className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none text-center" />
                    {selectedProduct && (
                      <span className="text-xs font-semibold text-primary whitespace-nowrap py-2">{formatPYG(selectedProduct.price_base_pyg * item.quantity)}</span>
                    )}
                    {formItems.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-destructive hover:text-destructive/80 py-2"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>

                  {/* Lens-specific fields */}
                  {item.productId && needsDioptria(item.productId) && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-primary mb-0.5 block">Dioptría *</label>
                        <input type="text" value={item.dioptria} onChange={(e) => updateItem(idx, "dioptria", e.target.value)}
                          placeholder="Ej: +20.0D" className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
                      </div>
                      {needsToricidad(item.productId) && (
                        <div>
                          <label className="text-[10px] font-semibold text-primary mb-0.5 block">Toricidad *</label>
                          <input type="text" value={item.toricidad} onChange={(e) => updateItem(idx, "toricidad", e.target.value)}
                            placeholder="Ej: T3 (1.5D)" className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Item notes */}
                  <input type="text" value={item.notes} onChange={(e) => updateItem(idx, "notes", e.target.value)}
                    placeholder="Nota del item (opcional)" className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none" />
                </div>
              );
            })}

            {/* Total */}
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
              <span className="text-sm font-medium text-muted-foreground">Total Pedido</span>
              <span className="text-lg font-display font-bold text-primary">{formatPYG(formTotal)}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={closeForm} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleSaveOrder} disabled={!formClientId || submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg gradient-gold text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 shadow-lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              {editingOrderId ? "Actualizar" : "Crear Pedido"}
            </button>
          </div>
        </div>
      )}

      {/* Search + Status pills */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número o cliente..."
            className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterStatus("todos")}
            className={cn("rounded-full px-4 py-1.5 text-xs font-medium border transition-colors",
              filterStatus === "todos" ? "bg-secondary text-secondary-foreground border-secondary" : "bg-transparent text-muted-foreground border-border")}>
            Todos ({orders.length})
          </button>
          {Object.entries(estadoLabels).map(([key, label]) => (
            <button key={key} onClick={() => setFilterStatus(key)}
              className={cn("rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                filterStatus === key ? estadoColors[key] : "bg-transparent text-muted-foreground border border-border")}>
              {label} ({statusCounts[key] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Order Detail Modal */}
      {viewOrder && (
        <div className="rounded-2xl border-2 border-secondary/30 bg-card p-6 space-y-4 animate-slide-in emerald-glow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-display font-bold text-foreground">{viewOrder.order_number}</h3>
              <p className="text-xs text-muted-foreground">{viewOrder.client?.name} · {viewOrder.client?.city}</p>
              {viewOrder.client?.address && <p className="text-[10px] text-muted-foreground">📍 {viewOrder.client.address}</p>}
            </div>
            <button onClick={() => setViewOrder(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          {viewOrder.notes && <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">📝 {viewOrder.notes}</p>}
          <div className="space-y-2">
            {viewOrder.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.product?.name || item.product_id}</p>
                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                    <span>Qty: {item.quantity}</span>
                    {item.dioptria && <span className="text-primary font-semibold">Diop: {item.dioptria}</span>}
                    {item.toricidad && <span className="text-primary font-semibold">Toric: {item.toricidad}</span>}
                    {item.notes && <span>📝 {item.notes}</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatPYG(item.subtotal_pyg)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center rounded-lg bg-primary/10 px-4 py-3">
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <span className="text-lg font-display font-bold text-primary">{formatPYG(viewOrder.total_pyg)}</span>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay pedidos</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Nro. Pedido</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Items</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">Total</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{o.order_number}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{o.client?.name || "—"}</span>
                    {o.client?.city && <span className="text-xs text-muted-foreground ml-1">· {o.client.city}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right text-foreground">{o.items.length}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{formatPYG(o.total_pyg)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", estadoColors[o.status])}>
                      {estadoLabels[o.status] || o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => setViewOrder(o)} className="rounded-lg p-1.5 hover:bg-muted transition-colors" title="Ver detalle">
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      {(o.status === "borrador" || o.status === "pendiente") && (
                        <>
                          <button onClick={() => handleEdit(o)} className="rounded-lg p-1.5 hover:bg-muted transition-colors" title="Editar">
                            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleDelete(o.id)} className="rounded-lg p-1.5 hover:bg-destructive/10 transition-colors" title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
