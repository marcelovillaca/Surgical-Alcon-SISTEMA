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
  internal_code: string;
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

type InventoryMap = Record<string, number>;
type SalesMap = Record<string, number>;

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
  const [targetMonths, setTargetMonths] = useState<number>(6);
  const [search, setSearch] = useState("");
  const [filterLine, setFilterLine] = useState<string | null>(null);
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, number>>({});
  const [isUsingImportedStock, setIsUsingImportedStock] = useState(false);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [tempInventory, setTempInventory] = useState<InventoryMap | null>(null);
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, sku, internal_code, name, product_line, cost_pyg, is_critical");
      if (productsError) throw productsError;
      setProducts(productsData || []);

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
        if (sku) salesMap[sku] = (salesMap[sku] || 0) + (sale.total || 0);
      });
      Object.keys(salesMap).forEach(sku => salesMap[sku] = salesMap[sku] / 6);
      setSalesData(salesMap);
    } catch (error: any) {
      toast({ title: "Error al cargar dados", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const stockValueData = useMemo(() => {
    const valueByLine: Record<string, number> = {};
    let totalValue = 0;
    const data = products.map(p => {
      const prodLots = lots.filter(l => l.product_id === p.id);
      const stock = inventory[p.id] || 0;
      const unitCost = prodLots[0]?.cost_unit_pyg || p.cost_pyg || 0;
      const totalProdValue = stock * unitCost;
      totalValue += totalProdValue;
      valueByLine[p.product_line] = (valueByLine[p.product_line] || 0) + totalProdValue;
      return { ...p, stock, unitCost, totalProdValue };
    }).filter(p => p.stock > 0);
    return { data, totalValue, valueByLine };
  }, [products, lots, inventory]);

  const expiryData = useMemo(() => {
    const now = new Date();
    return lots
      .filter(l => l.expiry_date != null && l.expiry_date !== "")
      .map(lot => {
        const product = products.find(p => p.id === lot.product_id);
        const expiry = new Date(lot.expiry_date! + "T12:00:00");
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const status: 'expired' | 'critical' | 'warning' | 'attention' | 'ok' =
          daysLeft < 0    ? 'expired' :
          daysLeft <= 90  ? 'critical' :
          daysLeft <= 180 ? 'warning' :
          daysLeft <= 270 ? 'attention' : 'ok';
        return {
          ...lot,
          productName: product?.name || "Desconocido",
          sku: product?.sku || "N/A",
          product_line: product?.product_line || "",
          daysLeft,
          status
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [lots, products]);

  // Products with no expiry date at all (e.g. equipment)
  const lotsWithoutExpiry = useMemo(() => {
    return lots
      .filter(l => !l.expiry_date)
      .map(lot => {
        const product = products.find(p => p.id === lot.product_id);
        return { ...lot, productName: product?.name || "Desconocido", sku: product?.sku || "N/A" };
      });
  }, [lots, products]);

  const purchasingData = useMemo(() => {
    return products.map(p => {
      const currentStock = inventory[p.id] || 0;
      const monthlyAvgSales = salesData[p.sku] || 0;
      const targetStock = Math.ceil(monthlyAvgSales * targetMonths);
      let suggestedQty = Math.ceil(targetStock - currentStock);
      if (suggestedQty < 0) suggestedQty = 0;
      const finalQty = manualAdjustments[p.id] !== undefined ? manualAdjustments[p.id] : suggestedQty;
      const estimatedCost = finalQty * (p.cost_pyg || 0);
      return { ...p, currentStock, monthlyAvgSales, targetStock, suggestedQty, finalQty, estimatedCost };
    }).sort((a, b) => b.currentStock - a.currentStock || b.suggestedQty - a.suggestedQty);
  }, [products, inventory, salesData, targetMonths, manualAdjustments]);

  // Reset page when filter changes
  const filteredPurchasing = useMemo(() => {
    return purchasingData.filter(p => (!filterLine || p.product_line === filterLine));
  }, [purchasingData, filterLine]);

  const totalPages = Math.ceil(filteredPurchasing.length / pageSize);
  const paginatedData = filteredPurchasing.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
        item.sku, item.name, PRODUCT_LINES.find(l => l.value === item.product_line)?.label || item.product_line,
        item.monthlyAvgSales.toFixed(1), item.currentStock, targetMonths, item.finalQty, item.estimatedCost
      ])
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sugerencia Compras");
    XLSX.writeFile(wb, `Pedido_Alcon_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const downloadCostTemplate = () => {
    // Generate template pre-filled with current products so user just fills cost
    const rows: any[][] = [["SKU", "Producto", "Costo_PYG"]];
    products.forEach(p => rows.push([p.sku, p.name, p.cost_pyg || 0]));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Column widths
    ws["!cols"] = [{ wch: 18 }, { wch: 40 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, "Costos");
    XLSX.writeFile(wb, `Template_Costos_Alcon_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Template descargado", description: "Rellene la columna Costo_PYG y cargue el archivo." });
  };

  const downloadDep33Template = () => {
    const rows: any[][] = [
      ["ALCON SURGICAL - DEP 33"],
      ["COD", "PRODUCTO", "", "STOCK", "RESERVA", "STOCK ACTUAL", "LOTE", "VTO"],
      ["62541", "AU00T0V220 ACRY IQ ULTRASERT AU00T0V220", "", 1, 0, 1, "15655276", "01/05/2026"],
      ["62596", "SN60WF.100 ACRYSOF IQ DPT 100", "", 2, 0, 2, "15714836", "16/09/2028"],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 45 }, { wch: 5 }, { wch: 8 }, { wch: 10 }, { wch: 13 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "DEP 33");
    XLSX.writeFile(wb, `Modelo_DEP33_Alcon.xlsx`);
    toast({ title: "Modelo DEP 33 descargado", description: "Use este formato para sincronizar estoque y vencimientos." });
  };

  const handleCostImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
        let updateCount = 0;
        for (const row of jsonData) {
          const sku = String(row.SKU || row.sku || row.Codigo || row[0] || "").trim().toUpperCase();
          const cost = Number(row.Costo || row.costo || row.cost_pyg || row[1] || 0);
          if (sku && !isNaN(cost) && cost > 0) {
            const { error } = await supabase.from("products").update({ cost_pyg: cost }).eq("sku", sku);
            if (!error) updateCount++;
          }
        }
        toast({ title: "Costos Actualizados", description: `Se actualizaron os custos de ${updateCount} produtos.` });
        fetchData();
      } catch (err) { toast({ title: "Error", description: "No se pudo procesar o arquivo.", variant: "destructive" }); }
    };
    reader.readAsArrayBuffer(file);
  };

  // Lens SKU prefixes — only these have dioptria/toricidad
  const LENS_PREFIXES = ["CNA0T0", "SA60AT", "SN60WF", "SN6AT", "AU00T0V", "MA60AC", "TFNT", "DFT"];

  const isLensSku = (sku: string) => LENS_PREFIXES.some(p => sku.toUpperCase().startsWith(p));

  const parseAlconSku = (sku: string) => {
    let dioptria: string | null = null;
    let toricidad: string | null = null;
    let line = "rest_of_portfolio";

    if (sku.startsWith("CNA0T0") || sku.startsWith("SA60AT") || sku.startsWith("SN60WF") || sku.startsWith("AU00T0V") || sku.startsWith("MA60AC") || sku.startsWith("SN6AT")) {
      line = "total_monofocals";
    } else if (sku.startsWith("TFNT") || sku.startsWith("DFT")) {
      line = "atiols";
    }

    // Only extract dioptria/toricidad for actual lens SKUs
    if (isLensSku(sku)) {
      const dioptMatch = sku.match(/[.V](\d{2,3})$/) || sku.match(/(\d{3})$/);
      if (dioptMatch) {
        const val = dioptMatch[1];
        dioptria = val.length === 3 ? `${val.substring(0, 2)}.${val.substring(2)}` : val;
      }
      const toricMatch = sku.match(/T([1-9])/);
      if (toricMatch) toricidad = `T${toricMatch[1]}`;
    }

    return { dioptria, toricidad, line };
  };

  const handleStockSync = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        toast({ title: "Paso 1/4", description: "Leyendo archivo Excel..." });
        const dataBuffer = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(dataBuffer, { type: "array" });
        
        let headerRowIndex = -1;
        let productoColIndex = -1;
        let stockColIndex = -1;
        let loteColIndex = -1;
        let vtoColIndex = -1;
        let targetRows: any[][] = [];

        toast({ title: "Paso 2/4", description: `Buscando datos en ${wb.SheetNames.length} aba(s)...` });

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          for (let i = 0; i < Math.min(30, data.length); i++) {
            const row = data[i]; if (!row) continue;
            const rowStr = row.map(c => String(c || "").toUpperCase());
            productoColIndex = rowStr.findIndex(s => s.includes("PRODUCTO") || s === "MATERIAL" || s === "CODIGO" || s === "SKU");
            // Prefer "STOCK ACTUAL" over plain "STOCK"
            const saIdx = rowStr.findIndex(s => s === "STOCK ACTUAL" || s.includes("STOCK ACTUAL"));
            stockColIndex = saIdx !== -1 ? saIdx : rowStr.findIndex(s => s.includes("STOCK") || s === "CANTIDAD" || s === "CANT");
            loteColIndex = rowStr.findIndex(s => s === "LOTE" || s.includes("LOTE"));
            vtoColIndex = rowStr.findIndex(s =>
              s === "VTO" || s === "VENCIMIENTO" || s === "VENCTO" ||
              s.includes("VTO") || s.includes("VENC") || s.includes("EXPIR")
            );
            if (productoColIndex !== -1) {
              headerRowIndex = i;
              targetRows = data;
              if (stockColIndex === -1) stockColIndex = 4;
              // Fallback: DEP 33 typically has VTO in column H (index 7)
              if (vtoColIndex === -1) vtoColIndex = 7;
              if (loteColIndex === -1) loteColIndex = 6;
              break;
            }
          }
          if (headerRowIndex !== -1) break;
        }

        if (headerRowIndex === -1) {
          toast({ title: "Error de Formato", description: "No se encontró 'Producto' en el archivo. Revise los encabezados.", variant: "destructive" });
          return;
        }

        toast({ title: "Paso 3/4", description: `Encabezado en fila ${headerRowIndex + 1}. Procesando...` });

        const currentProducts = [...products];
        const syncDate = new Date().toISOString().split("T")[0];
        let importCount = 0;
        let surpriseSKUs: any[] = [];
        // For matched products: collect lots to upsert
        const lotsToUpsert: Array<{
          product_id: string;
          lot_number: string;
          quantity: number;
          expiry_date: string | null;
        }> = [];

        for (let i = headerRowIndex + 1; i < targetRows.length; i++) {
          const row = targetRows[i];
          if (!row || row.length === 0) continue;
          const rawProducto = String(row[productoColIndex] || "").trim();
          if (!rawProducto || rawProducto.length < 2) continue;

          const parts = rawProducto.split(/\s+/);
          const sku = parts[0].toUpperCase();
          const name = parts.slice(1).join(" ") || sku;
          const internalCode = String(row[0] || "").trim();
          const stock = Number(row[stockColIndex] || 0);
          const lotNumber = loteColIndex !== -1 ? String(row[loteColIndex] || "").trim() : `SYNC-${syncDate}`;
          // Parse expiry: XLSX may return a serial number or a string
          let expiryDate: string | null = null;
          if (vtoColIndex !== -1 && row[vtoColIndex] != null && row[vtoColIndex] !== "") {
            const raw = row[vtoColIndex];
            try {
              if (typeof raw === "number" && raw > 1000) {
                // XLSX serial date number
                const jsDate = new Date(Math.round((raw - 25569) * 86400 * 1000));
                expiryDate = jsDate.toISOString().split("T")[0];
              } else {
                const str = String(raw).trim();
                // Try DD/MM/YYYY
                const ddmmyyyy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
                if (ddmmyyyy) {
                  expiryDate = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,"0")}-${ddmmyyyy[1].padStart(2,"0")}`;
                } else {
                  // Try YYYY-MM-DD or any ISO format
                  const d = new Date(str);
                  if (!isNaN(d.getTime())) expiryDate = d.toISOString().split("T")[0];
                }
              }
            } catch { expiryDate = null; }
          }

          if (!sku && !internalCode) continue;

          const product = currentProducts.find(p =>
            (sku && p.sku === sku) ||
            (internalCode && String(p.internal_code) === internalCode)
          );

          if (!product) {
            const existing = surpriseSKUs.find(s => s.sku === sku);
            if (!existing) {
              const { dioptria, toricidad, line } = parseAlconSku(sku);
              surpriseSKUs.push({ sku, internal_code: internalCode, name, product_line: line, dioptria, toricidad, stock, lot_number: lotNumber || `SYNC-${syncDate}`, expiry_date: expiryDate });
            } else { existing.stock += stock; }
          } else {
            lotsToUpsert.push({
              product_id: product.id,
              lot_number: lotNumber || `SYNC-${syncDate}-${i}`,
              quantity: stock,
              expiry_date: expiryDate,
            });
            importCount++;
          }
        }

        const lotsWithExpiry = lotsToUpsert.filter(l => l.expiry_date !== null).length;
        toast({
          title: "Paso 4/4",
          description: `${importCount} lotes | ${lotsWithExpiry} com VTO | Col VTO: ${vtoColIndex} | Col LOTE: ${loteColIndex}. Gravando...`
        });

        if (surpriseSKUs.length > 0) {
          setPendingProducts(surpriseSKUs);
          // Still persist matched ones
          if (lotsToUpsert.length > 0) {
            // Delete old SYNC lots for these products before inserting new ones
            const productIds = [...new Set(lotsToUpsert.map(l => l.product_id))];
            await supabase.from("inventory_lots").delete().in("product_id", productIds).like("lot_number", "SYNC-%");
            await supabase.from("inventory_lots").insert(lotsToUpsert);
          }
          setShowPendingModal(true);
        } else {
          // Delete old SYNC lots and insert new ones
          if (lotsToUpsert.length > 0) {
            const productIds = [...new Set(lotsToUpsert.map(l => l.product_id))];
            await supabase.from("inventory_lots").delete().in("product_id", productIds).like("lot_number", "SYNC-%");
            const { error } = await supabase.from("inventory_lots").insert(lotsToUpsert);
            if (error) {
              toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
              return;
            }
          }
          await fetchData();
          setIsUsingImportedStock(true);
          toast({ title: "Sincronización Exitosa", description: `Se importaron ${importCount} registros de estoque al sistema.` });
        }
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "No se pudo procesar el archivo.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApproveSurprise = async () => {
    setLoading(true);
    try {
      let createdCount = 0;
      const syncDate = new Date().toISOString().split("T")[0];

      for (const p of pendingProducts) {
        // Create the product
        const { data: newProd, error: prodError } = await supabase.from("products").insert([{
          sku: p.sku,
          internal_code: p.internal_code || null,
          name: p.name,
          product_line: p.product_line,
          dioptria: p.dioptria || null,
          toricidad: p.toricidad || null,
          active: true
        }]).select().single();

        if (!prodError && newProd && p.stock > 0) {
          // Also create the inventory lot so stock persists in DB
          await supabase.from("inventory_lots").insert([{
            product_id: newProd.id,
            lot_number: p.lot_number || `SYNC-${syncDate}`,
            quantity: p.stock,
            expiry_date: p.expiry_date || null,
            cost_unit_pyg: 0,
          }]);
          createdCount++;
        }
      }

      await fetchData(); // Reload products + lots from DB
      setShowPendingModal(false);
      setPendingProducts([]);
      setTempInventory(null);
      toast({ title: "Importación Finalizada", description: `Se crearon ${createdCount} nuevos productos con su estoque.` });
    } catch (error) {
      toast({ title: "Error", description: "No se pudieron crear los productos.", variant: "destructive" });
    } finally { setLoading(false); }
  };

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

        <TabsContent value="valor" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} /></div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Valor Total en Bodega</p>
              <h2 className="text-3xl font-display font-black text-foreground mt-1">₲ {stockValueData.totalValue.toLocaleString()}</h2>
            </div>
            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2"><Filter className="h-4 w-4" /> Distribución por Línea</h3>
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
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar por SKU..." className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold text-muted-foreground">{stockValueData.data.length} SKUs con estoque</p>
                <button onClick={downloadCostTemplate} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[10px] font-bold hover:bg-muted transition-colors" title="Baixar template Excel para atualizar custos">
                  <Download className="h-3 w-3" /> Template Custos
                </button>
                <label className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors">
                  <Upload className="h-3 w-3" /> Atualizar Custos
                  <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleCostImport} />
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Producto</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Stock</th>
                    <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Costo Unit.</th>
                    <th className="px-4 py-3 font-bold text-primary uppercase text-[10px] text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {stockValueData.data.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())).map(p => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-muted-foreground">{p.internal_code}</span>
                          <span className="font-mono text-[10px] text-primary font-bold">{p.sku}</span>
                        </div>
                        <div className="font-semibold text-xs">{p.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{p.stock}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">₲ {(p.unitCost || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-black text-primary">₲ {(p.totalProdValue || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vencimientos" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Control de Vencimientos</h2>
              <p className="text-xs text-muted-foreground">Lotes próximos a vencer en los próximos 6 meses</p>
            </div>
            <button onClick={downloadDep33Template} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-muted transition-colors">
              <Download className="h-3.5 w-3.5" /> Modelo DEP 33
            </button>
          </div>

          {lots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-orange-500/30 bg-orange-500/5 p-12 text-center space-y-3">
              <Calendar className="h-12 w-12 text-orange-500/40 mx-auto" />
              <h3 className="font-bold text-foreground">Nenhum lote carregado</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Sincronize o estoque em <strong>Pedido de Compra → Sincronizar Stock (DEP 33)</strong>.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "🔴 Críticos",  sublabel: "≤90 dias",  color: "rose",    filter: (d: number) => d >= 0 && d <= 90 },
                  { label: "🟠 Atenção",   sublabel: "≤180 dias", color: "orange", filter: (d: number) => d > 90 && d <= 180 },
                  { label: "🟡 Cuidado",   sublabel: "≤270 dias", color: "amber",  filter: (d: number) => d > 180 && d <= 270 },
                  { label: "🟢 OK",        sublabel: ">270 dias", color: "emerald",filter: (d: number) => d > 270 },
                ].map(({ label, sublabel, color, filter }) => {
                  const count = (expiryData as any[]).filter(l => filter(l.daysLeft)).length;
                  return (
                    <div key={label} className={`rounded-xl border border-${color}-500/20 bg-${color}-500/5 p-4`}>
                      <p className={`text-sm font-black text-${color}-600`}>{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
                      <p className="text-2xl font-black mt-1">{count} <span className="text-xs font-medium text-muted-foreground">lotes</span></p>
                    </div>
                  );
                })}
              </div>

              {/* Alert banner for expired lots */}
              {(expiryData as any[]).filter(l => l.daysLeft < 0).length > 0 && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                  <div>
                    <p className="text-sm font-black text-rose-600">{(expiryData as any[]).filter(l => l.daysLeft < 0).length} lote(s) VENCIDO(S) — retire do estoque ativo</p>
                  </div>
                </div>
              )}

              {/* Lots WITH expiry date */}
              {(expiryData as any[]).length > 0 && (
              <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                <div className="px-4 py-2 border-b border-border bg-muted/20 flex justify-between">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground">Lotes com Data de Vencimento</h3>
                  <span className="text-[10px] font-bold text-muted-foreground">{(expiryData as any[]).length} lotes</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Producto</th>
                      <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Lote</th>
                      <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Cant.</th>
                      <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-center">Vencimiento</th>
                      <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(expiryData as any[]).map((lot: any) => (
                      <tr key={lot.id} className={cn("hover:bg-muted/30 transition-colors", lot.daysLeft < 0 ? "bg-rose-500/5" : "")}>
                        <td className="px-4 py-3">
                          <div className="font-mono text-[10px] text-primary font-bold">{lot.sku}</div>
                          <div className="font-semibold text-xs text-muted-foreground">{lot.productName}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{lot.lot_number}</td>
                        <td className="px-4 py-3 text-right font-black">{lot.quantity}</td>
                        <td className="px-4 py-3 text-center text-xs">{new Date(lot.expiry_date + "T12:00:00").toLocaleDateString("es-PY")}</td>
                        <td className="px-4 py-3 text-center">
                          {lot.daysLeft < 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-black text-rose-600"><AlertTriangle className="h-3 w-3" /> VENCIDO</span>}
                          {lot.status === "critical"   && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-black text-rose-500">🔴 {lot.daysLeft}d</span>}
                          {lot.status === "warning"    && <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-500">🟠 {lot.daysLeft}d</span>}
                          {lot.status === "attention"  && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-500">🟡 {lot.daysLeft}d</span>}
                          {lot.status === "ok"         && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-500">🟢 {lot.daysLeft}d</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}

              {/* Lots WITHOUT expiry date — equipment etc. */}
              {lotsWithoutExpiry.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm opacity-70">
                <div className="px-4 py-2 border-b border-border bg-muted/20 flex justify-between">
                  <h3 className="text-xs font-bold uppercase text-muted-foreground">Sem Vencimento (Equipos, etc.)</h3>
                  <span className="text-[10px] font-bold text-muted-foreground">{lotsWithoutExpiry.length} lotes</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Producto</th>
                      <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px]">Lote</th>
                      <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-right">Cant.</th>
                      <th className="px-4 py-3 font-bold text-muted-foreground uppercase text-[10px] text-center">VTO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {lotsWithoutExpiry.map((lot: any) => (
                      <tr key={lot.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3"><div className="font-mono text-[10px] text-primary font-bold">{lot.sku}</div><div className="font-semibold text-xs text-muted-foreground">{lot.productName}</div></td>
                        <td className="px-4 py-3 font-mono text-xs">{lot.lot_number}</td>
                        <td className="px-4 py-3 text-right font-black">{lot.quantity}</td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Sin VTO</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="compras" className="space-y-6">
          <div className="flex items-center justify-between bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl">
                <span className="text-xs font-bold text-muted-foreground ml-2">Cobertura Objetivo:</span>
                <input type="number" min="1" max="24" value={targetMonths} onChange={(e) => setTargetMonths(Number(e.target.value) || 1)} className="w-16 h-8 text-center rounded-lg border border-border bg-background text-sm font-bold focus:ring-1 focus:ring-primary outline-none" />
                <span className="text-xs font-bold text-muted-foreground mr-2">meses</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={exportPurchasingToExcel} className="flex items-center gap-2 rounded-xl gradient-emerald px-5 py-2.5 text-sm font-bold text-secondary-foreground shadow-md transition-all hover:scale-[1.02]">
                <FileSpreadsheet className="h-4 w-4" /> Exportar Pedido
              </button>
              <label className="cursor-pointer flex items-center gap-2 rounded-xl border border-primary bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary shadow-sm hover:bg-primary/20">
                <Upload className="h-4 w-4" /> Sincronizar Stock (DEP 33)
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleStockSync} />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><ShoppingCart size={80} /></div>
              <p className="text-[10px] font-bold uppercase text-emerald-500/70">Total Pedido Sugerido</p>
              <h2 className="text-3xl font-black text-foreground mt-1">₲ {purchasingData.reduce((acc, curr) => acc + curr.estimatedCost, 0).toLocaleString()}</h2>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} /></div>
              <p className="text-[10px] font-bold uppercase text-amber-500/70">SKUs bajo el Mínimo</p>
              <h2 className="text-3xl font-black text-foreground mt-1">{purchasingData.filter(t => t.finalQty > 0).length} items</h2>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            {/* Filters + page size */}
            <div className="p-3 border-b border-border bg-muted/10 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => { setFilterLine(null); setCurrentPage(1); }} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold border", !filterLine ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border")}>
                  TODOS
                </button>
                {PRODUCT_LINES.map(line => (
                  <button key={line.value} onClick={() => { setFilterLine(line.value); setCurrentPage(1); }} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold border", filterLine === line.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border")}>
                    {line.label.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-bold">{filteredPurchasing.length} productos</span>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="h-7 px-2 rounded-lg border border-border bg-background text-xs font-bold focus:ring-1 focus:ring-primary outline-none">
                  <option value={20}>20 / pág.</option>
                  <option value={50}>50 / pág.</option>
                </select>
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
                  {paginatedData.length === 0 ? (
                    <tr><td colSpan={6} className="py-16 text-center text-sm text-muted-foreground italic">No hay productos para mostrar.</td></tr>
                  ) : paginatedData.map((p) => (
                    <tr key={p.id} className={cn("hover:bg-muted/30 transition-colors", p.finalQty > 0 ? "bg-emerald-500/[0.03]" : "")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-muted-foreground">{p.internal_code}</span>
                          <span className="font-mono text-[10px] text-primary font-bold">{p.sku}</span>
                        </div>
                        <div className="font-semibold text-xs mt-0.5">{p.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{p.monthlyAvgSales.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn("font-black", p.currentStock === 0 ? "text-rose-500" : "text-foreground")}>{p.currentStock}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-muted-foreground">{p.targetStock}</td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" min="0" value={p.finalQty} onChange={(e) => handleAdjustQty(p.id, e.target.value)} className="w-16 h-7 text-center rounded-lg border font-bold text-xs" />
                      </td>
                      <td className="px-4 py-3 text-right font-black">₲ {p.estimatedCost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="p-3 border-t border-border flex items-center justify-between bg-muted/10">
                <span className="text-[10px] text-muted-foreground font-bold">
                  Página {currentPage} de {totalPages} &bull; {filteredPurchasing.length} registros
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 rounded text-xs font-bold border border-border disabled:opacity-30 hover:bg-muted">«</button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded text-xs font-bold border border-border disabled:opacity-30 hover:bg-muted">‹</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                    const page = start + i;
                    return page <= totalPages ? (
                      <button key={page} onClick={() => setCurrentPage(page)} className={cn("px-2.5 py-1 rounded text-xs font-bold border", page === currentPage ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                        {page}
                      </button>
                    ) : null;
                  })}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded text-xs font-bold border border-border disabled:opacity-30 hover:bg-muted">›</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 rounded text-xs font-bold border border-border disabled:opacity-30 hover:bg-muted">»</button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {showPendingModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><AlertCircle className="h-6 w-6 text-primary" /> Nuevos Productos Detectados</h2>
                <p className="text-sm text-muted-foreground">Se detectaron SKUs que no estão no catálogo. Confirme para incluí-los.</p>
              </div>
              <button onClick={() => setShowPendingModal(false)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {pendingProducts.map((p, idx) => (
                <div key={p.sku} className="p-4 rounded-xl border border-border bg-muted/20 grid grid-cols-4 gap-4 items-end">
                  <div><label className="text-[10px] font-bold uppercase">SKU</label><div className="font-mono text-sm font-black text-primary">{p.sku}</div></div>
                  <div><label className="text-[10px] font-bold uppercase">Nome</label><input value={p.name} onChange={(e) => { const upd = [...pendingProducts]; upd[idx].name = e.target.value; setPendingProducts(upd); }} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm" /></div>
                  <div><label className="text-[10px] font-bold uppercase">Linha</label><select value={p.product_line} onChange={(e) => { const upd = [...pendingProducts]; upd[idx].product_line = e.target.value; setPendingProducts(upd); }} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm">{PRODUCT_LINES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
                  <div className="flex items-center gap-2"><div className="flex-1"><label className="text-[10px] font-bold uppercase">Stock</label><div className="font-black text-lg">{p.stock}</div></div><button onClick={() => setPendingProducts(pendingProducts.filter((_, i) => i !== idx))} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 className="h-4 w-4" /></button></div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button onClick={() => setShowPendingModal(false)} className="px-6 py-2 rounded-xl border border-border font-bold">Cancelar</button>
              <button onClick={handleApproveSurprise} className="px-8 py-2 rounded-xl gradient-emerald text-white font-bold flex items-center gap-2"><Save className="h-4 w-4" /> Confirmar e Incluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
