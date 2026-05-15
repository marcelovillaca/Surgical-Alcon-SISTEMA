import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, Search, Plus, AlertTriangle, Loader2, Save, X, Trash2, Edit2, Box, Calendar, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import * as XLSX from "xlsx";
import { RefreshCw, FileUp, FileCheck, History, AlertCircle, Upload, Download } from "lucide-react";

type Product = {
  id: string;
  sku: string;
  internal_code: string;
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
  is_critical?: boolean;
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
  const [isCritical, setIsCritical] = useState(false);

  // Lot form state
  const [lotNumber, setLotNumber] = useState("");
  const [lotQty, setLotQty] = useState(1);
  const [expiry, setExpiry] = useState("");
  const [diopter, setDiopter] = useState("");
  const [toricity, setToricity] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      
      if (productsError) throw productsError;

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
    } catch (err: any) {
      toast({ title: "Error al cargar produtos", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchLots = async (productId: string) => {
    setLoadingLots(true);
    try {
      const { data, error } = await supabase
        .from("inventory_lots")
        .select("*")
        .eq("product_id", productId)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      setLots(data || []);
    } catch (err) {
      toast({ title: "Error al cargar lotes", variant: "destructive" });
    } finally {
      setLoadingLots(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { if (selectedProduct) fetchLots(selectedProduct.id); }, [selectedProduct]);

  const parseAlconSku = (sku: string) => {
    let dioptria = ""; let toricidad = "";
    sku = sku.toUpperCase().trim();
    const toricMatch = sku.match(/T([1-9])/);
    if (toricMatch) toricidad = "T" + toricMatch[1];
    const dioptMatch = sku.match(/[.V](\d{2,3})$/) || sku.match(/(\d{3})$/);
    if (dioptMatch) {
      const val = dioptMatch[1];
      dioptria = val.length === 3 ? `${val.substring(0, 2)}.${val.substring(2)}` : val;
    }
    return { dioptria, toricidad };
  };

  const handleCatalogImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        toast({ title: "Paso 1/3", description: "Analizando Catálogo..." });
        const dataBuffer = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(dataBuffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        let headerRowIndex = -1; let skuIdx = -1; let nameIdx = -1; let costIdx = -1;

        for (let i = 0; i < Math.min(20, rows.length); i++) {
          const row = rows[i]; if (!row) continue;
          const rowStr = row.map(c => String(c || "").toUpperCase());
          skuIdx = rowStr.findIndex(s => s.includes("ALCON CODE") || s === "SKU" || s === "CODIGO" || s === "MATERIAL");
          nameIdx = rowStr.findIndex(s => s.includes("DESCRIPTION") || s.includes("PRODUCTO") || s.includes("NOMBRE"));
          costIdx = rowStr.findIndex(s => s.includes("COSTO") || s.includes("COST"));
          if (skuIdx !== -1 || nameIdx !== -1) { headerRowIndex = i; break; }
        }

        if (headerRowIndex === -1) {
          toast({ title: "Error de Formato", description: "No se encontró el encabezado 'Alcon Code' o 'Producto'.", variant: "destructive" });
          return;
        }

        toast({ title: "Paso 2/3", description: "Cargando productos al sistema..." });
        let successCount = 0;

        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i]; if (!row || row.length < 1) continue;
          let rawCode = String(row[skuIdx] !== undefined ? row[skuIdx] : (row[0] || "")).trim();
          let name = String(row[nameIdx] !== undefined ? row[nameIdx] : (row[1] || "")).trim();
          if (!rawCode || rawCode.length < 3) continue;

          let sku = rawCode.toUpperCase();
          const { dioptria, toricidad } = parseAlconSku(sku);
          
          const { error } = await supabase.from("products").upsert({
            sku, internal_code: rawCode, name: name || sku, description: name || "",
            product_line: sku.startsWith("AU00") || sku.startsWith("SN") ? "total_monofocals" : (sku.startsWith("TF") ? "atiols" : "rest_of_portfolio"),
            cost_pyg: costIdx !== -1 ? Number(row[costIdx] || 0) : 0,
            dioptria: dioptria || null, toricidad: toricidad || null, active: true
          }, { onConflict: 'sku' });
          if (!error) successCount++;
        }

        toast({ title: "Paso 3/3", description: `Catálogo actualizado con ${successCount} produtos.` });
        fetchProducts();
      } catch (err) { toast({ title: "Error", description: "Falla al procesar Excel.", variant: "destructive" }); }
    };
    reader.readAsArrayBuffer(file);
  };

  const resetForm = () => {
    setSku(""); setName(""); setDescription(""); setLine("total_monofocals");
    setCost(0); setPrice(0); setUnit("unidad"); setEditingId(null); setIsCritical(false); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      sku: sku.toUpperCase().trim(), name: name.trim(), description: description.trim(),
      product_line: line, cost_pyg: cost, price_base_pyg: price, unit_of_measure: unit,
      dioptria: (line === "total_monofocals" || line === "atiols") ? prodDioptria : null,
      toricidad: (line === "total_monofocals" || line === "atiols") ? prodToricidad : null,
      is_critical: isCritical,
    };
    const { error } = editingId ? await supabase.from("products").update(payload).eq("id", editingId) : await supabase.from("products").insert([payload]);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: editingId ? "Actualizado" : "Creado" }); fetchProducts(); resetForm(); }
  };

  const handleAddLot = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedProduct) return;
    const { error } = await supabase.from("inventory_lots").insert([{
      product_id: selectedProduct.id, lot_number: lotNumber.toUpperCase().trim(), quantity: lotQty,
      expiry_date: expiry, dioptria: diopter.trim() || null, toricidad: toricity.trim() || null,
      cost_unit_pyg: selectedProduct.cost_pyg, price_base_pyg: selectedProduct.price_base_pyg, created_by: user?.id
    }]);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Lote agregado" }); setLotNumber(""); setLotQty(1); setExpiry(""); setShowLotForm(false); fetchLots(selectedProduct.id); fetchProducts(); }
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterLine ? p.product_line === filterLine : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Inventario & Catálogo</h1>
          <p className="text-sm text-muted-foreground">Gestión de productos y precios base</p>
        </div>
        {isGerente && (
          <div className="flex gap-2">
            <label className="cursor-pointer flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20">
              <Upload className="h-4 w-4" /> Importar Catálogo
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleCatalogImport} />
            </label>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg gradient-emerald px-4 py-2.5 text-sm font-semibold text-secondary-foreground">
              <Plus className="h-4 w-4" /> Nuevo Producto
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar SKU..." className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterLine(null)} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border", !filterLine ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border")}>Todos</button>
          {PRODUCT_LINES.map(line => (
            <button key={line.value} onClick={() => setFilterLine(line.value)} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border", filterLine === line.value ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border")}>{line.label}</button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">SKU</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Producto</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Línea</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Stock</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Precio Base</th>
              <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-20 text-center text-muted-foreground italic">No se encontraron productos</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-4"><div className="font-mono text-xs text-primary font-bold">{p.sku}</div></td>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{p.name}</div>
                    <div className="flex gap-1 mt-1">
                      {p.is_critical && <span className="text-[9px] font-black bg-orange-500 text-white px-1.5 rounded">CRÍTICO</span>}
                      {p.dioptria && <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 rounded">D: {p.dioptria}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4"><span className="text-[10px] font-bold text-primary uppercase">{PRODUCT_LINES.find(l => l.value === p.product_line)?.label}</span></td>
                  <td className="px-4 py-4 text-right font-black">{p.total_stock || 0}</td>
                  <td className="px-4 py-4 text-right">₲ {p.price_base_pyg.toLocaleString()}</td>
                  <td className="px-4 py-4 text-center">
                    <button onClick={() => setSelectedProduct(p)} className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-500"><Box className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Simplified Modals for Form and Lots */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
             <div className="flex justify-between mb-4"><h2 className="font-bold">Producto</h2><button onClick={resetForm}><X /></button></div>
             <form onSubmit={handleSubmit} className="space-y-4">
                <input required value={sku} onChange={e => setSku(e.target.value)} placeholder="SKU" className="w-full p-2 border rounded" />
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" className="w-full p-2 border rounded" />
                <select value={line} onChange={e => setLine(e.target.value)} className="w-full p-2 border rounded">
                  {PRODUCT_LINES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="number" value={cost} onChange={e => setCost(Number(e.target.value))} placeholder="Costo" className="w-full p-2 border rounded" />
                  <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} placeholder="Precio" className="w-full p-2 border rounded" />
                </div>
                <button type="submit" className="w-full py-2 bg-primary text-white rounded font-bold">Guardar</button>
             </form>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
             <div className="flex justify-between mb-4"><div><h2 className="font-bold">Lotes: {selectedProduct.name}</h2><p className="text-xs">{selectedProduct.sku}</p></div><button onClick={() => setSelectedProduct(null)}><X /></button></div>
             <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {lots.map(l => (
                  <div key={l.id} className="p-3 border rounded flex justify-between">
                    <div><p className="font-bold">{l.lot_number}</p><p className="text-xs">{new Date(l.expiry_date).toLocaleDateString()}</p></div>
                    <div className="text-xl font-black">{l.quantity}</div>
                  </div>
                ))}
             </div>
             {isGerente && <button onClick={() => setShowLotForm(!showLotForm)} className="mt-4 w-full py-2 border-2 border-dashed rounded text-xs font-bold text-muted-foreground">+ Agregar Lote Manual</button>}
             {showLotForm && (
               <form onSubmit={handleAddLot} className="mt-4 grid grid-cols-3 gap-2">
                 <input required value={lotNumber} onChange={e => setLotNumber(e.target.value)} placeholder="Lote" className="p-2 border rounded text-xs" />
                 <input type="number" value={lotQty} onChange={e => setLotQty(Number(e.target.value))} placeholder="Cant" className="p-2 border rounded text-xs" />
                 <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="p-2 border rounded text-xs" />
                 <button type="submit" className="col-span-3 py-2 bg-emerald-500 text-white rounded text-xs font-bold">Confirmar</button>
               </form>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
