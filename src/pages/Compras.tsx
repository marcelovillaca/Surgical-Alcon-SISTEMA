import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Package, Search, ShoppingCart, Loader2, TrendingUp, 
  AlertTriangle, Download, Calendar, DollarSign,
  Filter, CheckCircle2, AlertCircle, FileSpreadsheet, Upload, X, Trash2, Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Product = {
  id: string;
  sku: string;
  name: string;
  product_line: string;
  cost_pyg: number;
  is_critical?: boolean;
};

type InventoryLot = {
  id: string;
  product_id: string;
  lot_number: string;
  quantity: number;
  expiry_date: string | null;
  cost_unit_pyg: number;
};

type InventoryMap = Record<string, number>; // productId -> stock
type SalesMap = Record<string, number>; // sku -> average monthly sales

const PRODUCT_LINES = [
  { value: "total_monofocals", label: "Monofocales" },
  { value: "atiols", label: "ATIOLs" },
  { value: "phaco_paks", label: "Phaco Paks" },
  { value: "ovds_and_solutions", label: "OVDs and Solutions" },
  { value: "vit_ret_paks", label: "Vit Ret Paks" },
  { value: "equipment", label: "Equipos" },
  { value: "rest_of_portfolio", label: "Otros" },
];

export default function Compras() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [inventory, setInventory] = useState<InventoryMap>({});
  const [salesData, setSalesData] = useState<SalesMap>({});
  const [loading, setLoading] = useState(true);
  const [targetMonths, setTargetMonths] = useState<number>(6); // Default 6 months coverage
  const [search, setSearch] = useState("");
  const [filterLine, setFilterLine] = useState<string | null>(null);
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>({});
  const [isUsingImportedStock, setIsUsingImportedStock] = useState(false);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]); // SKUs found in Excel but not in DB
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [tempInventory, setTempInventory] = useState<InventoryMap | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    
    try {
      // 1. Fetch Alcon Products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, sku, name, product_line, cost_pyg, is_critical");
        
      if (productsError) throw productsError;
      setProducts(productsData || []);

      // 2. Fetch current inventory lots
      const { data: lotsData, error: lotsError } = await supabase
        .from("inventory_lots")
        .select("id, product_id, lot_number, quantity, expiry_date, cost_unit_pyg")
        .gt("quantity", 0);
        
      if (lotsError) throw lotsError;
      setLots(lotsData || []);
      
      const stockMap: InventoryMap = {};
      lotsData?.forEach(lot => {
        stockMap[lot.product_id] = (stockMap[lot.product_id] || 0) + lot.quantity;
      });
      setInventory(stockMap);

      // 3. Fetch sales from the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const { data: salesInfo, error: salesError } = await supabase
        .from("sales_details")
        .select("codigo_producto, total")
        .gte("fecha", sixMonthsAgo.toISOString().split("T")[0]);

      if (salesError) throw salesError;

      const salesMap: SalesMap = {};
      salesInfo?.forEach(sale => {
        const sku = sale.codigo_producto;
        if (sku) {
          salesMap[sku] = (salesMap[sku] || 0) + (sale.total || 0);
        }
      });
      
      // Convert to monthly average (divide by 6)
      Object.keys(salesMap).forEach(sku => {
        salesMap[sku] = salesMap[sku] / 6;
      });
      
      setSalesData(salesMap);
      
    } catch (error: any) {
      toast({ title: "Error al cargar datos", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Calculations for Tab 1: Valor del Estoque ---
  const stockValueData = useMemo(() => {
    const valueByLine: Record<string, number> = {};
    let totalValue = 0;

    const data = products.map(p => {
      const prodLots = lots.filter(l => l.product_id === p.id);
      const stock = inventory[p.id] || 0;
      // Use the latest lot cost or product cost
      const unitCost = prodLots[0]?.cost_unit_pyg || p.cost_pyg || 0;
      const totalProdValue = stock * unitCost;

      totalValue += totalProdValue;
      valueByLine[p.product_line] = (valueByLine[p.product_line] || 0) + totalProdValue;

      return {
        ...p,
        stock,
        unitCost,
        totalProdValue
      };
    }).filter(p => p.stock > 0);

    return { data, totalValue, valueByLine };
  }, [products, lots, inventory]);

  // --- Calculations for Tab 2: Vencimientos ---
  const expiryData = useMemo(() => {
    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(now.getMonth() + 3);

    return lots.map(lot => {
      const product = products.find(p => p.id === lot.product_id);
      const expiry = lot.expiry_date ? new Date(lot.expiry_date) : null;
      
      if (!expiry) return null;

      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let status: 'critical' | 'warning' | 'ok' = 'ok';
      if (expiry <= threeMonthsFromNow) status = 'critical';
      else if (expiry <= sixMonthsFromNow) status = 'warning';

      if (status === 'ok') return null; // Only show near expiry

      return {
        ...lot,
        productName: product?.name || "Desconocido",
        sku: product?.sku || "N/A",
        daysLeft,
        status
      };
    }).filter(Boolean).sort((a: any, b: any) => a.daysLeft - b.daysLeft);
  }, [lots, products]);

  // --- Calculations for Tab 3: Pedido de Compra ---
  const purchasingData = useMemo(() => {
    return products.map(p => {
      const currentStock = inventory[p.id] || 0;
      const monthlyAvgSales = salesData[p.sku] || 0;
      const targetStock = Math.ceil(monthlyAvgSales * targetMonths);
      
      let suggestedQty = Math.ceil(targetStock - currentStock);
      if (suggestedQty < 0) suggestedQty = 0;

      const finalQty = manualAdjustments[p.id] !== undefined ? manualAdjustments[p.id] : suggestedQty;
      const estimatedCost = finalQty * (p.cost_pyg || 0);
      
      return {
        ...p,
        currentStock,
        monthlyAvgSales,
        targetStock,
        suggestedQty,
        finalQty,
        estimatedCost
      };
    }).sort((a, b) => b.suggestedQty - a.suggestedQty);
  }, [products, inventory, salesData, targetMonths, manualAdjustments]);

  const handleAdjustQty = (productId: string, val: string) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    setManualAdjustments(prev => ({ ...prev, [productId]: num }));
  };

  const exportPurchasingToExcel = () => {
    const itemsToBuy = purchasingData.filter(p => p.finalQty > 0);
    if (itemsToBuy.length === 0) {
      toast({ title: "Sin sugerencias", description: "No hay items con cantidad a comprar > 0", variant: "default" });
      return;
    }

    const wsData = [
      ["SKU", "Producto", "Línea", "Venta Promedio Mes", "Estoque Actual", "Meta (Meses)", "Cantidad Pedido", "Costo Estimado (PYG)"],
      ...itemsToBuy.map(item => [
        item.sku,
        item.name,
        PRODUCT_LINES.find(l => l.value === item.product_line)?.label || item.product_line,
        item.monthlyAvgSales.toFixed(1),
        item.currentStock,
        targetMonths,
        item.finalQty,
        item.estimatedCost
      ])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sugerencia Compras");
    XLSX.writeFile(wb, `Pedido_Alcon_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleCostImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        toast({ title: "Procesando...", description: `Actualizando costos de ${data.length} productos.` });

        for (const row of data) {
          const sku = row.SKU || row.sku;
          const cost = row.Costo || row.costo || row.cost_pyg;
          
          if (sku && cost) {
            await supabase
              .from("products")
              .update({ cost_pyg: cost })
              .eq("sku", sku);
          }
        }

        toast({ title: "Éxito", description: "Costos actualizados correctamente." });
        fetchData();
      } catch (err) {
        toast({ title: "Error", description: "No se pudo procesar el archivo.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const parseAlconSku = (sku: string) => {
    let dioptria = "";
    let toricidad = "";
    
    sku = sku.toUpperCase().trim();

    // 1. Extract Toricity: Look for 'T' followed by 1-9 (e.g., T2, T3, T4...)
    const toricMatch = sku.match(/T([1-9])/);
    if (toricMatch) {
      toricidad = "T" + toricMatch[1];
    }

    // 2. Extract Diopter
    // Strategy A: If there's a dot, the next 3 digits are usually the diopter (e.g., SN60WF.100, TFNT20.195)
    if (sku.includes(".")) {
      const afterDot = sku.split(".")[1].replace(/[^0-9]/g, "").substring(0, 3);
      if (afterDot.length >= 2) {
        const dVal = parseInt(afterDot);
        if (!isNaN(dVal)) dioptria = (dVal / 10).toFixed(1);
      }
    } 
    // Strategy B: If no dot, check the last 3 characters (e.g., AU00T0V220, SA60AT215)
    else {
      const last3 = sku.slice(-3);
      if (/^\d{3}$/.test(last3)) {
        const dVal = parseInt(last3);
        if (!isNaN(dVal)) dioptria = (dVal / 10).toFixed(1);
      }
    }

    return { dioptria, toricidad };
  };

  const handleStockSync = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        let newStockMap: InventoryMap = {};
        let importCount = 0;
        let surpriseSKUs: any[] = [];
        const currentProducts = [...products];

        // Identify header row
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(15, data.length); i++) {
          if (data[i] && String(data[i][1] || "").toUpperCase().includes("PRODUCTO")) {
            headerRowIndex = i;
            break;
          }
        }

        // Process rows
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 5) continue;

          const rawProducto = String(row[1] || "").trim();
          if (!rawProducto || rawProducto.toUpperCase().includes("ALCON")) continue;

          const sku = rawProducto.split(" ")[0].toUpperCase();
          const name = rawProducto.split(" ").slice(1).join(" ") || sku;
          const stock = Number(row[4]);

          if (sku && !isNaN(stock)) {
            let product = currentProducts.find(p => p.sku === sku);
            
            if (!product) {
              // Check if already in surpriseSKUs
              let surprise = surpriseSKUs.find(s => s.sku === sku);
              if (!surprise) {
                const { dioptria, toricidad } = parseAlconSku(sku);
                surpriseSKUs.push({
                  sku,
                  name,
                  product_line: sku.startsWith("AU00") || sku.startsWith("SN") ? "total_monofocals" : (sku.startsWith("TF") ? "atiols" : "rest_of_portfolio"),
                  dioptria: dioptria || null,
                  toricidad: toricidad || null,
                  stock
                });
              } else {
                surprise.stock += stock;
              }
            } else {
              newStockMap[product.id] = (newStockMap[product.id] || 0) + stock;
              importCount++;
            }
          }
        }

        if (surpriseSKUs.length > 0) {
          setPendingProducts(surpriseSKUs);
          setTempInventory(newStockMap);
          setShowPendingModal(true);
        } else {
          // Zero stock for missing products
          currentProducts.forEach(p => {
            if (newStockMap[p.id] === undefined) {
              newStockMap[p.id] = 0;
            }
          });
          setInventory(newStockMap);
          setIsUsingImportedStock(true);
          toast({ title: "Sincronización Exitosa", description: `Se procesaron ${importCount} registros.`, variant: "default" });
        }
      } catch (err) {
        toast({ title: "Error", description: "No se pudo procesar el arquivo.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleApproveSurprise = async () => {
    setLoading(true);
    try {
      let finalStockMap = { ...tempInventory };
      let createdCount = 0;

      for (const p of pendingProducts) {
        const { data: newProd, error } = await supabase
          .from("products")
          .insert([{
            sku: p.sku,
            name: p.name,
            product_line: p.product_line,
            dioptria: p.dioptria,
            toricidad: p.toricidad,
            active: true
          }])
          .select()
          .single();
        
        if (!error && newProd) {
          finalStockMap[newProd.id] = p.stock;
          createdCount++;
        }
      }

      // Refresh products and finalize inventory
      await fetchData();
      setInventory(finalStockMap as InventoryMap);
      setIsUsingImportedStock(true);
      setShowPendingModal(false);
      setPendingProducts([]);
      toast({ title: "Importación Finalizada", description: `Se crearon ${createdCount} productos y se actualizó el estoque.` });
    } catch (error) {
      toast({ title: "Error", description: "No se puderam criar los productos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }; };

  if (loading && products.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-3xl font-display font-black text-foreground tracking-tight">Gestión Inteligente de Stock</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitoreo de valor, vencimientos y reposición estratégica</p>
      </div>

      <Tabs defaultValue="compras" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex flex-wrap gap-1">
          <TabsTrigger value="valor" className="rounded-lg py-2.5 px-4 font-bold flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <DollarSign className="h-4 w-4" /> Valor del Estoque
          </TabsTrigger>
          <TabsTrigger value="vencimientos" className="rounded-lg py-2.5 px-4 font-bold flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            <Calendar className="h-4 w-4" /> Vencimientos
          </TabsTrigger>
          <TabsTrigger value="compras" className="rounded-lg py-2.5 px-4 font-bold flex items-center gap-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
            <ShoppingCart className="h-4 w-4" /> Pedido de Compra
          </TabsTrigger>
        </TabsList>

        {/* --- TAB: VALOR DEL ESTOQUE --- */}
        <TabsContent value="valor" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} /></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Valor Total en Bodega</p>
              <h2 className="text-3xl font-display font-black text-foreground mt-1">
                ₲ {stockValueData.totalValue.toLocaleString()}
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-2">Basado en costos actuales</p>
            </div>
            
            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2"><Filter className="h-4 w-4" /> Distribución por Línea</h3>
                <div className="flex gap-2">
                  <label className="cursor-pointer flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted transition-colors">
                    <Upload className="h-3 w-3" /> Actualizar Costos
                    <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleCostImport} />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {PRODUCT_LINES.map(line => (
                  <div key={line.value} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{line.label}</p>
                    <p className="text-xs font-black mt-1">₲ {(stockValueData.valueByLine[line.value] || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input 
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Filtrar por SKU o nombre..." 
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none" 
                />
              </div>
              <p className="text-[10px] font-bold text-muted-foreground">{stockValueData.data.length} SKUs con stock</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Producto</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Stock</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Costo Unit.</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {stockValueData.data
                    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
                    .map(p => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono text-[10px] text-primary font-bold">{p.sku}</div>
                        <div className="font-semibold text-xs">{p.name}</div>
                        {(p.dioptria || p.toricidad) && (
                          <div className="flex gap-1 mt-0.5">
                            {p.dioptria && <span className="text-[8px] font-bold bg-primary/10 text-primary px-1 rounded">D: {p.dioptria}</span>}
                            {p.toricidad && <span className="text-[8px] font-bold bg-blue-500/10 text-blue-500 px-1 rounded">T: {p.toricidad}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{p.stock}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">₲ {p.unitCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-black text-foreground">₲ {p.totalProdValue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* --- TAB: VENCIMIENTOS --- */}
        <TabsContent value="vencimientos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle size={80} /></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500/70">Riesgo Crítico (&lt; 3 meses)</p>
              <h2 className="text-3xl font-display font-black text-foreground mt-1">
                {expiryData.filter((i: any) => i.status === 'critical').length} <span className="text-lg font-medium text-muted-foreground">lotes</span>
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-2">Requieren acción inmediata (Venta/Promoción)</p>
            </div>
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Calendar size={80} /></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500/70">Alerta (&lt; 6 meses)</p>
              <h2 className="text-3xl font-display font-black text-foreground mt-1">
                {expiryData.filter((i: any) => i.status === 'warning').length} <span className="text-lg font-medium text-muted-foreground">lotes</span>
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-2">Monitoreo preventivo de vencimiento</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Producto / Lote</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Vencimiento</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-center">Días Restantes</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Cantidad</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {expiryData.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-muted-foreground italic font-medium">No hay lotes con vencimiento próximo en los siguientes 6 meses.</td></tr>
                  ) : (
                    expiryData.map((lot: any) => (
                      <tr key={lot.id} className={cn("hover:bg-muted/30 transition-colors", lot.status === 'critical' ? "bg-rose-500/5" : "bg-orange-500/5")}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-xs">{lot.productName}</div>
                          <div className="flex gap-2 mt-1">
                            <span className="font-mono text-[9px] bg-muted px-1.5 rounded border border-border text-muted-foreground">Lote: {lot.lot_number}</span>
                            <span className="font-mono text-[9px] bg-primary/10 px-1.5 rounded text-primary font-bold">{lot.sku}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {new Date(lot.expiry_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded text-[10px] font-black",
                            lot.status === 'critical' ? "bg-rose-500 text-white animate-pulse" : "bg-orange-500 text-white"
                          )}>
                            {lot.daysLeft} días
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black">{lot.quantity}</td>
                        <td className="px-4 py-3 text-center">
                          {lot.status === 'critical' ? (
                            <span className="flex items-center justify-center gap-1 text-[10px] font-black text-rose-500 uppercase"><AlertCircle className="h-3 w-3" /> Crítico</span>
                          ) : (
                            <span className="flex items-center justify-center gap-1 text-[10px] font-black text-orange-500 uppercase"><AlertTriangle className="h-3 w-3" /> Alerta</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* --- TAB: PEDIDO DE COMPRA --- */}
        <TabsContent value="compras" className="space-y-6">
          <div className="flex items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl">
                <span className="text-xs font-bold text-muted-foreground ml-2">Cobertura Objetivo:</span>
                <input 
                  type="number" 
                  min="1" 
                  max="24"
                  value={targetMonths}
                  onChange={(e) => setTargetMonths(Number(e.target.value) || 1)}
                  className="w-16 h-8 text-center rounded-lg border border-border bg-background text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                />
                <span className="text-xs font-bold text-muted-foreground mr-2">meses</span>
              </div>
            </div>
            <button 
              onClick={exportPurchasingToExcel}
              className="flex items-center gap-2 rounded-xl gradient-emerald px-5 py-2.5 text-sm font-bold text-secondary-foreground shadow-md transition-all hover:scale-[1.02] active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Pedido para Alcon
            </button>
            <label className="cursor-pointer flex items-center gap-2 rounded-xl border border-primary bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary shadow-sm hover:bg-primary/20 transition-all">
              <Upload className="h-4 w-4" />
              Sincronizar Stock (Excel)
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleStockSync} />
            </label>
            {isUsingImportedStock && (
              <button 
                onClick={() => { setIsUsingImportedStock(false); fetchData(); }}
                className="text-xs font-bold text-rose-500 hover:underline"
              >
                Reset DB
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><ShoppingCart size={80} /></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70">Total Pedido Sugerido</p>
              <h2 className="text-3xl font-display font-black text-foreground mt-1">
                ₲ {purchasingData.reduce((acc, curr) => acc + curr.estimatedCost, 0).toLocaleString()}
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-2">Para cubrir {targetMonths} meses de venta</p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} /></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/70">SKUs bajo el Mínimo</p>
              <h2 className="text-3xl font-display font-black text-foreground mt-1">
                {purchasingData.filter(t => t.finalQty > 0).length} <span className="text-lg font-medium text-muted-foreground">ítems</span>
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-2">Productos que requieren reposición</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterLine(null)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                    !filterLine ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted"
                  )}
                >TODOS</button>
                {PRODUCT_LINES.slice(0, 4).map(line => (
                  <button
                    key={line.value}
                    onClick={() => setFilterLine(line.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                      filterLine === line.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted"
                    )}
                  >{line.label.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Producto</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Venta Prom.</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Estoque</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Target</th>
                    <th className="px-4 py-3 font-bold text-primary uppercase text-[10px] text-center">Pedido</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Costo Estim.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {purchasingData
                    .filter(p => (!filterLine || p.product_line === filterLine))
                    .map((p) => (
                    <tr key={p.id} className={cn("hover:bg-muted/30 transition-colors group", p.finalQty > 0 ? "bg-emerald-500/[0.03]" : "")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-primary font-bold">{p.sku}</span>
                          {p.is_critical && <span className="text-[8px] font-black bg-orange-500 text-white px-1 rounded shadow-sm">CRÍTICO</span>}
                        </div>
                        <div className="font-semibold text-xs mt-0.5">{p.name}</div>
                        {(p.dioptria || p.toricidad) && (
                          <div className="flex gap-1 mt-0.5">
                            {p.dioptria && <span className="text-[8px] font-bold bg-primary/10 text-primary px-1 rounded">D: {p.dioptria}</span>}
                            {p.toricidad && <span className="text-[8px] font-bold bg-blue-500/10 text-blue-500 px-1 rounded">T: {p.toricidad}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{p.monthlyAvgSales.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-black px-2 py-0.5 rounded",
                          p.currentStock <= p.monthlyAvgSales ? "bg-rose-500/10 text-rose-500" : "text-foreground"
                        )}>{p.currentStock}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-muted-foreground">{p.targetStock}</td>
                      <td className="px-4 py-3 text-center">
                        <input 
                          type="number" min="0" value={p.finalQty}
                          onChange={(e) => handleAdjustQty(p.id, e.target.value)}
                          className={cn(
                            "w-16 h-7 text-center rounded-lg border font-bold text-xs focus:ring-2 focus:ring-primary outline-none transition-all",
                            p.finalQty > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" : "bg-background border-border"
                          )}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black">₲ {p.estimatedCost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* --- MODAL DE APROBACIÓN DE SKUS SURPRESA --- */}
      {showPendingModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-primary" />
                  Nuevos Productos Detectados
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Se encontraron {pendingProducts.length} SKUs en el Excel que não estão no sistema. Revise e confirme sua inclusão.
                </p>
              </div>
              <button onClick={() => setShowPendingModal(false)} className="rounded-full p-2 hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {pendingProducts.map((p, idx) => (
                  <div key={p.sku} className="p-4 rounded-xl border border-border bg-muted/20 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">SKU / Código</label>
                      <div className="font-mono text-sm font-black text-primary mt-1">{p.sku}</div>
                    </div>
                    <div className="md:col-span-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Nombre del Producto</label>
                      <input 
                        value={p.name}
                        onChange={(e) => {
                          const updated = [...pendingProducts];
                          updated[idx].name = e.target.value;
                          setPendingProducts(updated);
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Línea</label>
                      <select 
                        value={p.product_line}
                        onChange={(e) => {
                          const updated = [...pendingProducts];
                          updated[idx].product_line = e.target.value;
                          setPendingProducts(updated);
                        }}
                        className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none mt-1"
                      >
                        {PRODUCT_LINES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Stock Inicial</label>
                        <div className="font-black text-lg text-foreground">{p.stock}</div>
                      </div>
                      <button 
                        onClick={() => {
                          const updated = pendingProducts.filter((_, i) => i !== idx);
                          setPendingProducts(updated);
                          if (updated.length === 0) setShowPendingModal(false);
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Descartar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3 bg-muted/10">
              <button 
                onClick={() => setShowPendingModal(false)}
                className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted rounded-xl transition-all"
              >
                Cancelar Carga
              </button>
              <button 
                onClick={handleApproveSurprise}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl gradient-emerald px-8 py-2.5 text-sm font-bold text-secondary-foreground shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Confirmar e Incorporar Productos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
