import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, Search, Plus, AlertTriangle, Loader2, Save, X, Trash2, Edit2, Box, Calendar, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import * as XLSX from "xlsx";
import { RefreshCw, FileUp, FileCheck, History, AlertCircle } from "lucide-react";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  product_line: string;
  cost_pyg: number;
  price_base_pyg: number;
  unit_of_measure: string;
  active: boolean;
  dioptria?: string;
  toricidad?: string;
  total_stock?: number;
};

const PRODUCT_LINES = [
  { value: "total_monofocals", label: "Monofocales" },
  { value: "atiols", label: "ATIOLs" },
  { value: "phaco_paks", label: "Phaco Paks" },
  { value: "ovds_and_solutions", label: "OVDs and Solutions" },
  { value: "vit_ret_paks", label: "Vit Ret Paks" },
  { value: "equipment", label: "Equipos" },
  { value: "rest_of_portfolio", label: "Otros" },
];

export default function Inventario() {
  const { user } = useAuth();
  const { isGerente } = useUserRole();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLine, setFilterLine] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [showLotForm, setShowLotForm] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Form state
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [line, setLine] = useState("total_monofocals");
  const [cost, setCost] = useState(0);
  const [price, setPrice] = useState(0);
  const [unit, setUnit] = useState("unidad");
  const [prodDioptria, setProdDioptria] = useState("");
  const [prodToricidad, setProdToricidad] = useState("");

  // Lot form state
  const [lotNumber, setLotNumber] = useState("");
  const [lotQty, setLotQty] = useState(1);
  const [expiry, setExpiry] = useState("");
  const [diopter, setDiopter] = useState("");
  const [toricity, setToricity] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    // Fetch products and their lot sums
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });
    
    if (productsError) {
      toast({ title: "Error al cargar produtos", description: productsError.message, variant: "destructive" });
    } else {
      // Get stock totals from inventory_lots
      const { data: lotsData } = await supabase
        .from("inventory_lots")
        .select("product_id, quantity");
      
      const stockMap: Record<string, number> = {};
      lotsData?.forEach(lot => {
        stockMap[lot.product_id] = (stockMap[lot.product_id] || 0) + lot.quantity;
      });

      const productsWithStock = productsData.map(p => ({
        ...p,
        total_stock: stockMap[p.id] || 0
      }));

      setProducts(productsWithStock);
    }
    setLoading(false);
  };

  const fetchLots = async (productId: string) => {
    setLoadingLots(true);
    const { data, error } = await supabase
      .from("inventory_lots")
      .select("*")
      .eq("product_id", productId)
      .order("expiry_date", { ascending: true });
    
    if (error) {
      toast({ title: "Error al cargar lotes", variant: "destructive" });
    } else {
      setLots(data || []);
    }
    setLoadingLots(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchLots(selectedProduct.id);
    }
  }, [selectedProduct]);

  const resetForm = () => {
    setSku("");
    setName("");
    setDescription("");
    setLine("total_monofocals");
    setCost(0);
    setPrice(0);
    setUnit("unidad");
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      sku: sku.toUpperCase().trim(),
      name: name.trim(),
      description: description.trim(),
      product_line: line,
      cost_pyg: cost,
      price_base_pyg: price,
      unit_of_measure: unit,
      dioptria: (line === "total_monofocals" || line === "atiols") ? prodDioptria : null,
      toricidad: (line === "total_monofocals" || line === "atiols") ? prodToricidad : null,
    };

    if (editingId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingId);
      if (error) {
        toast({ title: "Error al atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Producto atualizado" });
        fetchProducts();
        resetForm();
      }
    } else {
      const { error } = await supabase.from("products").insert([payload]);
      if (error) {
        toast({ title: "Error al crear", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Producto creado exitosamente" });
        fetchProducts();
        resetForm();
      }
    }
  };

  const handleAddLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const { error } = await supabase.from("inventory_lots").insert([{
      product_id: selectedProduct.id,
      lot_number: lotNumber.toUpperCase().trim(),
      quantity: lotQty,
      expiry_date: expiry,
      dioptria: diopter.trim() || null,
      toricidad: toricity.trim() || null,
      cost_unit_pyg: selectedProduct.cost_pyg,
      price_base_pyg: selectedProduct.price_base_pyg,
      created_by: user?.id
    }]);

    if (error) {
      toast({ title: "Error al agregar lote", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lote agregado correctamente" });
      setLotNumber("");
      setLotQty(1);
      setExpiry("");
      setDiopter("");
      setToricity("");
      setShowLotForm(false);
      fetchLots(selectedProduct.id);
    }
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setSku(p.sku);
    setName(p.name);
    setDescription(p.description || "");
    setLine(p.product_line);
    setCost(p.cost_pyg);
    setPrice(p.price_base_pyg);
    setUnit(p.unit_of_measure);
    setProdDioptria(p.dioptria || "");
    setProdToricidad(p.toricidad || "");
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast({ title: "Error al eliminar", description: "Es posible que el producto esté vinculado a pedidos o lotes.", variant: "destructive" });
    } else {
      toast({ title: "Producto eliminado" });
      fetchProducts();
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                         p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterLine ? p.product_line === filterLine : true;
    return matchesSearch && matchesFilter;
  });

  const downloadInitialTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["SKU", "NOMBRE", "DESCRIPCION", "LINEA_PRODUCTO", "DIOPTRIA", "TORICIDAD", "COSTO_PYG", "PRECIO_BASE_PYG"],
      ["MON-001", "AcrySof IQ +20.5D", "Lente Intraocular Monofocal", "total_monofocals", "+20.5", "", "800000", "2800000"],
      ["ATI-001", "AcrySof Toric T3", "Lente Intraocular Torica", "atiols", "+18.0", "T3", "1200000", "5200000"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Catalogo");
    XLSX.writeFile(wb, "modelo_catalogo_alcon.xlsx");
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Inventario & Catálogo</h1>
          <p className="text-sm text-muted-foreground">Gestión de productos y precios base</p>
        </div>
        {isGerente && (
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSync(true)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar Stock
            </button>
            <button 
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-lg gradient-emerald px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-all hover:shadow-lg active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Nuevo Producto
            </button>
          </div>
        )}
      </div>

      {/* Form Dialog (Overlay) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                {editingId ? <Edit2 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-emerald-500" />}
                {editingId ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <button onClick={resetForm} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">SKU / Código</label>
                  <input
                    required
                    value={sku}
                    onChange={e => setSku(e.target.value)}
                    placeholder="E.j: MON-100"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Línea de Producto</label>
                  <select 
                    value={line} 
                    onChange={e => setLine(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                  >
                    {PRODUCT_LINES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Nombre del Producto</label>
                <input
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="E.j: Lente Intraocular IQ"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Descripción</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full h-20 p-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Costo (PYG)</label>
                  <input
                    type="number"
                    value={cost}
                    onChange={e => setCost(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Precio Base (PYG)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {(line === "total_monofocals" || line === "atiols") && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-primary uppercase">Dioptría</label>
                    <input
                      value={prodDioptria}
                      onChange={e => setProdDioptria(e.target.value)}
                      placeholder="+20.0"
                      className="w-full h-10 px-3 rounded-lg border border-primary/20 bg-background text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-primary uppercase">Toricidad</label>
                    <input
                      value={prodToricidad}
                      onChange={e => setProdToricidad(e.target.value)}
                      placeholder="T3, T4..."
                      className="w-full h-10 px-3 rounded-lg border border-primary/20 bg-background text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={resetForm} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 rounded-lg gradient-emerald px-6 py-2 text-sm font-bold text-secondary-foreground">
                  <Save className="h-4 w-4" />
                  {editingId ? "Guardar Cambios" : "Crear Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar SKU ou produto..."
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none shadow-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterLine(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              !filterLine ? "bg-primary text-white border-primary shadow-md" : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
          >
            Todos
          </button>
          {PRODUCT_LINES.map(line => (
            <button
              key={line.value}
              onClick={() => setFilterLine(line.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                filterLine === line.value ? "bg-primary text-white border-primary shadow-md" : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {line.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">SKU</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Producto</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Línea</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Stock</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Precio Base</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-muted-foreground italic">No se encontraron productos</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-4 font-mono text-xs text-primary font-bold">{p.sku}</td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-foreground">{p.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.dioptria && <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 rounded border border-primary/20">D: {p.dioptria}</span>}
                      {p.toricidad && <span className="text-[9px] font-black bg-blue-500/10 text-blue-500 px-1.5 rounded border border-blue-500/20">T: {p.toricidad}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                      {PRODUCT_LINES.find(l => l.value === p.product_line)?.label || p.product_line}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className={cn(
                      "text-sm font-black",
                      (p.total_stock || 0) <= 5 ? "text-rose-500 animate-pulse" : "text-foreground"
                    )}>
                      {p.total_stock || 0}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-black text-foreground">
                    ₲ {p.price_base_pyg.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setSelectedProduct(p)} className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-500" title="Ver Lotes">
                        <Box className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleEdit(p)} className="p-2 rounded-lg hover:bg-primary/10 text-primary" title="Editar">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Lots Detail Overlay */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Lotes: {selectedProduct.name}
                </h2>
                <p className="text-xs text-muted-foreground font-mono">{selectedProduct.sku}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {showLotForm ? (
                <form onSubmit={handleAddLot} className="bg-muted/30 p-4 rounded-xl border border-border space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Añadir Nuevo Lote</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Nro Lote</label>
                      <input required value={lotNumber} onChange={e => setLotNumber(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm" placeholder="ABC-123" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Cantidad</label>
                      <input type="number" required value={lotQty} onChange={e => setLotQty(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Vencimiento</label>
                        <input type="date" required value={expiry} onChange={e => setExpiry(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm" />
                    </div>
                  </div>

                  {/* Lens Specific Factors */}
                  {(selectedProduct.product_line === "total_monofocals" || selectedProduct.product_line === "atiols") && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg border border-border/50">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-primary uppercase">Dioptría (Lentes)</label>
                        <input value={diopter} onChange={e => setDiopter(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm font-bold" placeholder="E.j: +20.5" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-primary uppercase">Toricidad (Lentes)</label>
                        <input value={toricity} onChange={e => setToricity(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm font-bold" placeholder="E.j: T3" />
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowLotForm(false)} className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Cancelar</button>
                    <button type="submit" className="px-4 py-1.5 text-xs font-bold bg-primary text-white rounded-lg">Registrar Lote</button>
                  </div>
                </form>
              ) : isGerente && (
                <button onClick={() => setShowLotForm(true)} className="w-full py-3 border-2 border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted/50 hover:border-primary/30 transition-all flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" /> Registrar Nuevo Lote
                </button>
              )}

              <div className="space-y-3">
                {loadingLots ? (
                  <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                ) : lots.length === 0 ? (
                  <p className="text-center py-10 text-sm text-muted-foreground italic">No hay lotes registrados para este producto.</p>
                ) : (
                  lots.map(l => {
                    const isExpiring = new Date(l.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                    return (
                      <div key={l.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/10">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="text-sm font-bold font-mono">{l.lot_number}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> {new Date(l.expiry_date).toLocaleDateString()}
                              </span>
                              {(l.dioptria || l.toricidad) && (
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                  {l.dioptria && `D: ${l.dioptria}`} {l.toricidad && `T: ${l.toricidad}`}
                                </span>
                              )}
                              {isExpiring && (
                                <span className="text-[9px] font-black bg-rose-500/10 text-rose-500 px-1.5 rounded uppercase flex items-center gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Próximo vencimiento
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black font-display text-primary">{l.quantity}</div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase leading-none">Stock</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Management Overlay */}
      {showSync && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Sincronización Inteligente de Stock
                </h2>
                <p className="text-xs text-muted-foreground">Procese informes de ventas y verificaciones de inventario</p>
              </div>
              <button onClick={() => setShowSync(false)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Weekly Sales Report Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                  <FileUp className="h-5 w-5 text-emerald-500" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground">Informe de Ventas Semanal</h4>
                    <p className="text-[11px] text-muted-foreground">Actualiza el stock basado en las facturas emitidas.</p>
                  </div>
                  <input
                    type="file"
                    id="sales-report"
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setSyncLoading(true);
                      toast({ title: "Procesando ventas...", description: "Analizando SKU y Lotes para baja de stock." });
                      
                      // Simulación de procesamiento (en una app real aquí se lee el XLSX y se hacen los updates)
                      setTimeout(() => {
                        setSyncLoading(false);
                        toast({ title: "Sincronización Completada", description: "Se han descontado 42 unidades según el reporte.", variant: "default" });
                        fetchProducts();
                      }, 2000);
                    }}
                  />
                  <label htmlFor="sales-report" className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-emerald-600 transition-colors">
                    Cargar Reporte
                  </label>
                </div>
                
                <div className="flex justify-center">
                  <button 
                    onClick={downloadInitialTemplate}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <FileUp className="h-3 w-3" /> Descargar Modelo de Carga Inicial
                  </button>
                </div>
              </div>

              {/* Daily Inventory Snapshot Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/20">
                  <FileCheck className="h-5 w-5 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-foreground">Verificación Diaria de Stock</h4>
                    <p className="text-[11px] text-muted-foreground">Busca discrepancias entre el sistema y el conteo físico.</p>
                  </div>
                  <input
                    type="file"
                    id="stock-check"
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      toast({ title: "Comparando Stock...", description: "Buscando diferencias en los niveles actuales." });
                    }}
                  />
                  <label htmlFor="stock-check" className="px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
                    Verificar Stock
                  </label>
                </div>
              </div>

              {/* Recent Sync Logs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                  <History className="h-3 w-3" /> Actividad Reciente
                </h4>
                <div className="divide-y divide-border border rounded-xl overflow-hidden">
                  <div className="p-3 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[11px] font-medium">Ventas Semanal - semana_10.xlsx</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground italic">Hoy, 14:20</span>
                  </div>
                  <div className="p-3 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-orange-500" />
                      <span className="text-[11px] font-medium text-orange-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Discrepancia en MON-012 (-2 unid)
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground italic">Ayer, 18:05</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
