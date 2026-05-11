import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Search, ShoppingCart, Loader2, TrendingUp, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

type Product = {
  id: string;
  sku: string;
  name: string;
  product_line: string;
  cost_pyg: number;
  is_critical?: boolean;
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
  const [inventory, setInventory] = useState<InventoryMap>({});
  const [salesData, setSalesData] = useState<SalesMap>({});
  const [loading, setLoading] = useState(true);
  const [targetMonths, setTargetMonths] = useState<number>(6); // Default 6 months coverage
  const [search, setSearch] = useState("");
  const [filterLine, setFilterLine] = useState<string | null>(null);
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>({});
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

      // 2. Fetch current inventory stock
      const { data: lotsData, error: lotsError } = await supabase
        .from("inventory_lots")
        .select("product_id, quantity");
        
      if (lotsError) throw lotsError;
      
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

  const tableData = useMemo(() => {
    return products.map(p => {
      const currentStock = inventory[p.id] || 0;
      const monthlyAvgSales = salesData[p.sku] || 0;
      const targetStock = Math.ceil(monthlyAvgSales * targetMonths);
      
      // Formula: (Monthly Avg * Target Months) - Current Stock
      let suggestedQty = Math.ceil(targetStock - currentStock);
      if (suggestedQty < 0) suggestedQty = 0;

      // Override with manual adjustment if present
      const finalQty = manualAdjustments[p.id] !== undefined ? manualAdjustments[p.id] : suggestedQty;
      const estimatedCost = finalQty * (p.cost_pyg || 0);
      
      return {
        ...p,
        currentStock,
        monthlyAvgSales,
        targetStock,
        suggestedQty,
        finalQty,
        estimatedCost,
        isAtRisk: p.is_critical && currentStock <= monthlyAvgSales // Risco se estoque atual cobre 1 mês ou menos
      };
    }).sort((a, b) => {
      // Prioritize critical products at risk first, then by suggestedQty
      if (a.isAtRisk && !b.isAtRisk) return -1;
      if (!a.isAtRisk && b.isAtRisk) return 1;
      return b.suggestedQty - a.suggestedQty;
    });
  }, [products, inventory, salesData, targetMonths, manualAdjustments]);

  const filteredData = tableData.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                         p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterLine ? p.product_line === filterLine : true;
    return matchesSearch && matchesFilter;
  });

  const handleAdjustQty = (productId: string, val: string) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    setManualAdjustments(prev => ({ ...prev, [productId]: num }));
  };

  const exportToExcel = () => {
    const itemsToBuy = tableData.filter(p => p.finalQty > 0);
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

  const totalEstimatedCost = tableData.reduce((acc, curr) => acc + curr.estimatedCost, 0);
  const totalItemsToBuy = tableData.filter(t => t.finalQty > 0).length;
  const criticalItemsAtRisk = tableData.filter(t => t.isAtRisk).length;

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-display font-black text-foreground tracking-tight">Compras Inteligentes</h1>
          <p className="text-sm text-muted-foreground mt-1">Sugerencia de pedidos y control de criticidad</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-card border border-border p-2 rounded-xl shadow-sm">
            <span className="text-xs font-bold text-muted-foreground ml-2">Cobertura (Meses):</span>
            <input 
              type="number" 
              min="1" 
              max="24"
              value={targetMonths}
              onChange={(e) => setTargetMonths(Number(e.target.value) || 1)}
              className="w-16 h-8 text-center rounded-lg border border-border bg-background text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 rounded-xl gradient-emerald px-5 py-2.5 text-sm font-bold text-secondary-foreground shadow-md transition-all hover:scale-[1.02] active:scale-95"
          >
            <Download className="h-4 w-4" />
            Exportar Pedido
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><ShoppingCart size={80} /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70">Total Pedido Estimado</p>
          <h2 className="text-3xl font-display font-black text-foreground mt-1">
            ₲ {totalEstimatedCost.toLocaleString()}
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-2">Para {targetMonths} meses de cobertura</p>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Package size={80} /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500/70">SKUs a Comprar</p>
          <h2 className="text-3xl font-display font-black text-foreground mt-1">
            {totalItemsToBuy} <span className="text-lg font-medium text-muted-foreground">ítems</span>
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-2">Productos por debajo del target</p>
        </div>

        <div className={cn("rounded-2xl border p-6 backdrop-blur-md relative overflow-hidden transition-colors", criticalItemsAtRisk > 0 ? "border-destructive/30 bg-destructive/10" : "border-muted bg-muted/5")}>
          <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle size={80} /></div>
          <p className={cn("text-[10px] font-bold uppercase tracking-widest", criticalItemsAtRisk > 0 ? "text-destructive" : "text-muted-foreground")}>SKUs Críticos en Riesgo</p>
          <h2 className={cn("text-3xl font-display font-black mt-1", criticalItemsAtRisk > 0 ? "text-destructive animate-pulse" : "text-foreground")}>
            {criticalItemsAtRisk}
          </h2>
          <p className="text-xs text-muted-foreground font-medium mt-2">Cobertura menor a 1 mes</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por SKU o producto..."
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none shadow-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterLine(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
              !filterLine ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card text-muted-foreground border-border hover:bg-muted"
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
                filterLine === line.value ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {line.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">SKU / Producto</th>
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Venta Prom. (Mes)</th>
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Estoque Atual</th>
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Target ({targetMonths}m)</th>
                <th className="px-4 py-3 font-bold text-primary uppercase text-[10px] tracking-wider text-center">Sugerido Compra</th>
                <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] tracking-wider text-right">Costo Estimado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr><td colSpan={6} className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={6} className="py-20 text-center text-muted-foreground italic">No se encontraron productos</td></tr>
              ) : (
                filteredData.map((p) => (
                  <tr key={p.id} className={cn("hover:bg-muted/30 transition-colors group", p.isAtRisk ? "bg-destructive/5" : p.finalQty > 0 ? "bg-primary/5" : "")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-primary font-bold">{p.sku}</span>
                        {p.is_critical && (
                          <span className={cn("text-[9px] font-black px-1.5 rounded uppercase", p.isAtRisk ? "bg-destructive text-white animate-pulse" : "bg-orange-500/20 text-orange-600 border border-orange-500/30")}>
                            {p.isAtRisk ? "¡PELIGRO!" : "Crítico"}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-foreground text-xs mt-0.5">{p.name}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {p.monthlyAvgSales.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.isAtRisk && <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />}
                        <span className={cn(
                          "font-black px-2 py-1 rounded",
                          p.isAtRisk ? "bg-destructive/20 text-destructive" : p.currentStock <= p.monthlyAvgSales ? "bg-rose-500/10 text-rose-500" : "text-foreground"
                        )}>
                          {p.currentStock}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {p.targetStock}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="number"
                        min="0"
                        value={p.finalQty}
                        onChange={(e) => handleAdjustQty(p.id, e.target.value)}
                        className={cn(
                          "w-20 h-8 text-center rounded-lg border font-bold focus:ring-2 focus:ring-primary outline-none transition-all mx-auto",
                          p.finalQty > 0 
                            ? "bg-primary/10 border-primary/30 text-primary" 
                            : "bg-background border-border text-muted-foreground hover:border-primary/50"
                        )}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-black text-foreground">
                      ₲ {p.estimatedCost.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
