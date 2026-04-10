import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useAudit } from "@/hooks/useAudit";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Upload, Download, CheckCircle, Package, Users, Activity, FileText, ClipboardList,
  Trash2, Search, Filter, AlertTriangle, DollarSign, FileSpreadsheet, ShieldX
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

import {
  detectTemplate,
  parseSalesSheet,
  parseTargetsSheet,
  parseClientsSheet,
  parseStockSheet,
  parseConoftaTargetsSheet,
  parseConoftaSurgeriesSheet,
  parseConoftaIndirectCostsSheet,
  parseConoftaProductCostsSheet,
  parseConoftaSurgeonFeesSheet,
  parseConoftaExpensesSheet,
  downloadTemplate,
} from "@/lib/excel-parsers";

export default function VentasTargets() {
  const { user } = useAuth();
  const { isGerente, loading: roleLoading } = useUserRole();

  const [activeTab, setActiveTab] = useState("ventas");
  const [targetYear, setTargetYear] = useState(new Date().getFullYear().toString());
  const [files, setFiles] = useState<Record<string, File | null>>({ ventas: null, targets: null, clientes: null, stock: null, conofta_targets: null, jornadas: null, precios_ref: null });
  const [statuses, setStatuses] = useState<Record<string, { type: "idle" | "loading" | "success" | "error" | "warning"; message: string }>>({
    ventas: { type: "idle", message: "" }, targets: { type: "idle", message: "" },
    clientes: { type: "idle", message: "" }, stock: { type: "idle", message: "" },
    conofta_targets: { type: "idle", message: "" }, jornadas: { type: "idle", message: "" },
    precios_ref: { type: "idle", message: "" }
  });
  const [recordCounts, setRecordCounts] = useState<Record<string, number | null>>({ ventas: null, targets: null, clientes: null, stock: null, conofta_targets: null, jornadas: null, precios_ref: null });

  const fetchCounts = useCallback(async () => {
    const [s, t, c, st, ct, j, pr] = await Promise.all([
      supabase.from("sales_details").select("id", { count: "exact", head: true }),
      supabase.from("sales_targets").select("id", { count: "exact", head: true }),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("inventory_lots").select("id", { count: "exact", head: true }),
      supabase.from("conofta_targets").select("id", { count: "exact", head: true }),
      supabase.from("conofta_surgeries" as any).select("id", { count: "exact", head: true }),
      supabase.from("conofta_product_costs" as any).select("id", { count: "exact", head: true }),
    ]);
    setRecordCounts({
      ventas: s.count ?? 0,
      targets: t.count ?? 0,
      clientes: c.count ?? 0,
      stock: st.count ?? 0,
      conofta_targets: ct.count ?? 0,
      jornadas: j.count ?? 0,
      precios_ref: pr.count ?? 0
    });
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const setFileFor = (tab: string, f: File | null) => setFiles(prev => ({ ...prev, [tab]: f }));
  const setStatusFor = (tab: string, s: { type: any; message: string }) => setStatuses(prev => ({ ...prev, [tab]: s }));

  const handleFileChange = useCallback(async (tab: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileFor(tab, f);
    setStatusFor(tab, { type: "idle", message: "" });
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      let detected: string | null = null;
      let matchedSheetCount = 0;

      wb.SheetNames.forEach(name => {
        const sheet = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
        if (rows.length > 0) {
          const headers = rows[0] as string[];
          const d = detectTemplate(headers.map(h => String(h)));
          if (d) {
            detected = d;
            matchedSheetCount++;
          }
        }
      });

      // Alias mapping
      const conoftaTypes = ["conofta_surgeries", "conofta_indirect_costs", "conofta_product_costs", "conofta_expenses", "conofta_surgeon_fees", "conofta_targets"];
      if (conoftaTypes.includes(detected || "")) {
        if (tab === "jornadas") detected = "jornadas";
        else if (tab === "conofta_targets" && (detected === "conofta_targets" || matchedSheetCount > 1)) detected = "conofta_targets";
        else if (tab === "precios_ref" && detected === "conofta_product_costs") detected = "precios_ref";
        else detected = "jornadas";
      }

      if (!detected) {
        setStatusFor(tab, { type: "error", message: "No se reconoce el template. Descargue uno de los formatos oficiales." });
      } else if (detected !== tab) {
        const labels: Record<string, string> = {
          ventas: "Ventas Detalladas",
          targets: "Targets por Visitador",
          clientes: "Base de Clientes",
          stock: "Stock / Inventario",
          conofta_targets: "Metas CONOFTA (Público)",
          jornadas: "Jornadas Consolidada (Pacientes + Insumos)",
          precios_ref: "Precios de Referencia"
        };
        setStatusFor(tab, { type: "error", message: `Este archivo parece ser de tipo "${labels[detected]}". Cárguelo en la pestaña correcta.` });
        setFileFor(tab, null);
      } else {
        setStatusFor(tab, { type: "success", message: `Archivo válido (${matchedSheetCount} hojas detectadas). Presione "Importar" para procesar.` });
      }
    } catch {
      setStatusFor(tab, { type: "error", message: "Error al leer el archivo Excel." });
    }
  }, []);

  const { logAction } = useAudit();

  const handleImport = useCallback(async (tab: string) => {
    const file = files[tab];
    if (!file || !user) return;
    setStatusFor(tab, { type: "loading", message: "Procesando archivo..." });
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];

      if (tab === "ventas") {
        const { rows, errors } = parseSalesSheet(ws);
        if (errors.length > 0) { setStatusFor(tab, { type: "error", message: errors.join("\n") }); return; }
        const insertRows = rows.map(r => {
          const row: any = {
            fecha: r.fecha, cod_cliente: r.cod_cliente, cliente: r.cliente,
            direccion: r.direccion || null, ciudad: r.ciudad, linea_de_producto: r.linea_de_producto,
            factura_nro: r.factura_nro, cod2: r.cod2 || null, codigo_producto: r.codigo_producto,
            producto: r.producto, costo: r.costo, total: r.total,
            monto_en: r.monto_en || "USD", monto_usd: r.monto_usd,
            vendedor: r.vendedor, uploaded_by: user.id
          };
          if (r.mercado) row.mercado = r.mercado;
          return row;
        });

        for (let i = 0; i < insertRows.length; i += 500) {
          const slice = insertRows.slice(i, i + 500);
          // UPSERT: ignoreDuplicates=true means rows that already exist
          // (same factura_nro + cod_cliente + codigo_producto + fecha) are silently skipped.
          // This allows safely re-uploading the full file (Jan+Feb+Mar) without creating duplicates.
          let { error } = await supabase.from("sales_details").upsert(slice as any, {
            onConflict: "factura_nro,cod_cliente,codigo_producto,fecha",
            ignoreDuplicates: true,
          });

          if (error && (error.message.includes("mercado") || error.code === "PGRST204")) {
            // Remove mercado from the objects and retry
            const cleanedSlice = slice.map(row => {
              const { mercado, ...rest } = row;
              return rest;
            });
            const retry = await supabase.from("sales_details").upsert(cleanedSlice as any, {
              onConflict: "factura_nro,cod_cliente,codigo_producto,fecha",
              ignoreDuplicates: true,
            });
            error = retry.error;
          }

          if (error) throw error;
        }
        await logAction("IMPORT_DATA", { table: "sales_details", filename: file.name, rows: rows.length, mode: "upsert_dedup" }, "sales_imports");
        setStatusFor(tab, { type: "success", message: `✅ ${rows.length} registros procesados. Nuevos registros añadidos; duplicados ignorados automáticamente.` });
        fetchCounts();
      } else if (tab === "targets") {
        const { rows, errors, warnings } = parseTargetsSheet(ws);
        if (errors.length > 0) { setStatusFor(tab, { type: "error", message: errors.join("\n") }); return; }
        const insertRows = rows.map(r => ({
          visitador: r.visitador, linea_de_producto: r.linea_de_producto, anio: parseInt(targetYear),
          enero: r.meses.enero || 0, febrero: r.meses.febrero || 0, marzo: r.meses.marzo || 0,
          abril: r.meses.abril || 0, mayo: r.meses.mayo || 0, junio: r.meses.junio || 0,
          julio: r.meses.julio || 0, agosto: r.meses.agosto || 0, septiembre: r.meses.septiembre || 0,
          octubre: r.meses.octubre || 0, noviembre: r.meses.noviembre || 0, diciembre: r.meses.diciembre || 0,
          total: r.total || 0, uploaded_by: user.id,
        }));
        const { error } = await supabase.from("sales_targets").insert(insertRows as any);
        if (error) throw error;
        await logAction("IMPORT_DATA", { table: "sales_targets", filename: file.name, rows: rows.length, year: targetYear }, "sales_imports");
        let msg = `✅ ${rows.length} targets importados exitosamente para el año ${targetYear}.`;
        if (warnings.length > 0) msg += `\n\n⚠️ Alertas:\n${warnings.join("\n")}`;
        setStatusFor(tab, { type: warnings.length > 0 ? "warning" : "success", message: msg });
        fetchCounts();
      } else if (tab === "clientes") {
        const { rows, errors } = parseClientsSheet(ws);
        if (errors.length > 0) { setStatusFor(tab, { type: "error", message: errors.join("\n") }); return; }
        const insertRows = rows.map(r => ({
          name: r.name, contact_name: r.contact_name || null,
          city: r.city || null, address: r.address || null,
          email: r.email || null, phone: r.phone || null,
          segment: r.segment as any, pricing_level: r.pricing_level as any,
          market_type: r.market_type || "privado",
          created_by: user.id, assigned_to: user.id,
        }));
        for (let i = 0; i < insertRows.length; i += 500) {
          const { error } = await supabase.from("clients").insert(insertRows.slice(i, i + 500) as any);
          if (error) throw error;
        }
        await logAction("IMPORT_DATA", { table: "clients", filename: file.name, rows: rows.length }, "clients");
        setStatusFor(tab, { type: "success", message: `✅ ${rows.length} clientes importados exitosamente.` });
        fetchCounts();
      } else if (tab === "stock") {
        const { rows, errors } = parseStockSheet(ws);
        if (errors.length > 0) { setStatusFor(tab, { type: "error", message: errors.join("\n") }); return; }
        // Find product IDs by SKU or create placeholder entries
        const insertRows: any[] = [];
        for (const r of rows) {
          // Try to find existing product by SKU
          const { data: prod } = await supabase.from("products").select("id").eq("sku", r.codigo_producto).maybeSingle();
          let productId = prod?.id;
          if (!productId) {
            // Create product placeholder
            const { data: newProd } = await supabase.from("products").insert({
              sku: r.codigo_producto, name: r.producto,
              product_line: "rest_of_portfolio" as any,
            } as any).select("id").single();
            productId = newProd?.id;
          }
          if (productId) {
            insertRows.push({
              product_id: productId,
              lot_number: r.lote_sn,
              expiry_date: r.fecha_vencimiento,
              quantity: 1,
              created_by: user.id,
            });
          }
        }
        for (let i = 0; i < insertRows.length; i += 500) {
          const { error } = await supabase.from("inventory_lots").insert(insertRows.slice(i, i + 500));
          if (error) throw error;
        }
        await logAction("IMPORT_DATA", { table: "inventory_lots", filename: file.name, rows: insertRows.length }, "sales_imports");
        setStatusFor(tab, { type: "success", message: `✅ ${insertRows.length} lotes importados exitosamente.` });
        fetchCounts();
      } else if (tab === "conofta_targets") {
        let targetsSheet: XLSX.WorkSheet | null = null;
        for (const name of wb.SheetNames) {
          const s = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<any>(s, { header: 1 });
          if (rows.length > 0) {
            const h = rows[0] as string[];
            if (detectTemplate(h.map(String)) === "conofta_targets") {
              targetsSheet = s;
              break;
            }
          }
        }

        if (!targetsSheet) throw new Error("No se encontró la hoja de Metas en el archivo.");

        const { rows, errors } = parseConoftaTargetsSheet(targetsSheet);
        if (errors.length > 0) { setStatusFor(tab, { type: "error", message: errors.join("\n") }); return; }
        const insertRows = rows.map(r => ({
          anio: r.anio,
          sucursal: r.sucursal,
          tipo_cirugia: r.tipo_cirugia,
          revenue_per_surgery: r.revenue_per_surgery,
          enero: r.meses.enero || 0, febrero: r.meses.febrero || 0, marzo: r.meses.marzo || 0,
          abril: r.meses.abril || 0, mayo: r.meses.mayo || 0, junio: r.meses.junio || 0,
          julio: r.meses.julio || 0, agosto: r.meses.agosto || 0, septiembre: r.meses.septiembre || 0,
          octubre: r.meses.octubre || 0, noviembre: r.meses.noviembre || 0, diciembre: r.meses.diciembre || 0,
          uploaded_by: user.id,
        }));
        const { error } = await supabase.from("conofta_targets").upsert(insertRows as any, { onConflict: 'anio, sucursal, tipo_cirugia' });
        if (error) throw error;
        await logAction("IMPORT_DATA", { table: "conofta_targets", filename: file.name, year: insertRows[0]?.anio }, "sales_imports");
        setStatusFor(tab, { type: "success", message: `✅ Metas de cirugías CONOFTA importadas exitosamente.` });
        fetchCounts();
      } else if (tab === "jornadas") {
        let totalPatients = 0;
        let totalIndirects = 0;
        let totalRefs = 0;
        let totalExp = 0;

        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          const rows_headers = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })[0] as string[];
          const type = detectTemplate(rows_headers?.map(h => String(h)));

          if (type === "conofta_surgeries") {
            const { rows, errors } = parseConoftaSurgeriesSheet(ws);
            if (errors.length > 0) throw new Error(`Error en hoja "${name}": ${errors.join(", ")}`);
            const insertRows = rows.map(r => ({ ...r, uploaded_by: user.id }));
            const { error } = await supabase.from("conofta_surgeries" as any).insert(insertRows as any);
            if (error) throw new Error(`Error al insertar cirugías: ${error.message}`);
            totalPatients += rows.length;
          } else if (type === "conofta_indirect_costs") {
            const { rows, errors } = parseConoftaIndirectCostsSheet(ws);
            if (errors.length > 0) throw new Error(`Error en hoja "${name}": ${errors.join(", ")}`);
            const insertRows = rows.map(r => ({ ...r, uploaded_by: user.id }));
            const { error } = await supabase.from("conofta_surgeries" as any).insert(insertRows as any);
            if (error) throw new Error(`Error al insertar costos indirectos: ${error.message}`);
            totalIndirects += rows.length;
          } else if (type === "conofta_surgeon_fees") {
            const { rows, errors } = parseConoftaSurgeonFeesSheet(ws);
            if (errors.length > 0) throw new Error(`Error en hoja "${name}": ${errors.join(", ")}`);
            // Se usa la combinación de nombre y sucursal como clave única
            const { error: err } = await supabase.from("conofta_product_costs" as any)
              .upsert(rows, { onConflict: 'item_name, sucursal, anio' });
            if (err) throw new Error(`Error al actualizar honorarios: ${err.message}`);
            totalRefs += rows.length;
          } else if (type === "conofta_product_costs") {
            const { rows, errors } = parseConoftaProductCostsSheet(ws);
            if (errors.length > 0) throw new Error(`Error en hoja "${name}": ${errors.join(", ")}`);
            // Se usa la combinación de nombre y sucursal como clave única
            const { error: err } = await supabase.from("conofta_product_costs" as any)
              .upsert(rows, { onConflict: 'item_name, sucursal, anio' });
            if (err) throw new Error(`Error al actualizar costos de productos: ${err.message}`);
            totalRefs += rows.length;
          } else if (type === "conofta_expenses") {
            const { rows, errors } = parseConoftaExpensesSheet(ws);
            if (errors.length > 0) throw new Error(`Error en hoja "${name}": ${errors.join(", ")}`);
            const insertRows = rows.map(r => ({ ...r, uploaded_by: user.id }));
            const { error: err } = await supabase.from("conofta_expenses" as any).insert(insertRows as any);
            if (err) throw new Error(`Error al insertar operativos: ${err.message}`);
            totalExp += rows.length;
          } else if (type === "conofta_targets") {
            const { rows, errors } = parseConoftaTargetsSheet(ws);
            if (errors.length > 0) throw new Error(`Error en hoja "${name}": ${errors.join(", ")}`);
            const insertRows = rows.map(r => ({
              anio: r.anio,
              sucursal: r.sucursal,
              tipo_cirugia: r.tipo_cirugia || 'Catarata',
              revenue_per_surgery: r.revenue_per_surgery,
              enero: r.meses.enero || 0, febrero: r.meses.febrero || 0, marzo: r.meses.marzo || 0,
              abril: r.meses.abril || 0, mayo: r.meses.mayo || 0, junio: r.meses.junio || 0,
              julio: r.meses.julio || 0, agosto: r.meses.agosto || 0, septiembre: r.meses.septiembre || 0,
              octubre: r.meses.octubre || 0, noviembre: r.meses.noviembre || 0, diciembre: r.meses.diciembre || 0,
              uploaded_by: user.id,
            }));
            const { error: err } = await supabase.from("conofta_targets").upsert(insertRows as any, { onConflict: 'anio, sucursal, tipo_cirugia' });
            if (err) throw new Error(`Error al actualizar metas: ${err.message}`);
          }
        }

        await logAction("IMPORT_DATA", { table: "conofta_master", filename: file.name, patients: totalPatients, indirects: totalIndirects, refs: totalRefs, expenses: totalExp }, "sales_imports");
        setStatusFor(tab, { type: "success", message: `✅ Master Template cargado: ${totalPatients} pacientes, ${totalIndirects} insumos. También se actualizaron honorarios, gastos y metas.` });
        fetchCounts();
      } else if (tab === "precios_ref") {
        const { rows, errors } = parseConoftaProductCostsSheet(ws);
        if (errors.length > 0) { setStatusFor(tab, { type: "error", message: errors.join("\n") }); return; }
        const { error } = await supabase.from("conofta_product_costs" as any).upsert(
          rows.map(r => ({ ...r }))
        );
        if (error) throw error;
        await logAction("IMPORT_DATA", { table: "conofta_product_costs", filename: file.name, rows: rows.length }, "sales_imports");
        setStatusFor(tab, { type: "success", message: `✅ ${rows.length} items de referencia actualizados exitosamente.` });
        fetchCounts();
      }
      setFileFor(tab, null);
    } catch (err: any) {
      setStatusFor(tab, { type: "error", message: err.message || "Error al procesar el archivo." });
    }
  }, [files, user, logAction, targetYear]);

  const handleClear = async (table: string, label: string) => {
    if (!confirm(`¿Eliminar todos los registros de ${label}? Esta acción no se puede deshacer.`)) return;
    const tabMap: Record<string, string> = {
      sales_details: "ventas",
      sales_targets: "targets",
      clients: "clientes",
      inventory_lots: "stock",
      conofta_targets: "conofta_targets",
      conofta_surgeries: "jornadas",
      conofta_product_costs: "jornadas",
      conofta_expenses: "jornadas"
    };
    const tab = tabMap[table] || "ventas";
    setStatusFor(tab, { type: "loading", message: "Eliminando..." });
    const { error } = await supabase.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000") as any;
    if (error) setStatusFor(tab, { type: "error", message: error.message });
    else { setStatusFor(tab, { type: "success", message: `Todos los registros de ${label} eliminados.` }); fetchCounts(); }
  };

  if (roleLoading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-lg gradient-emerald animate-pulse" /></div>;
  }

  if (!isGerente) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-lg font-display font-bold text-foreground">Acceso Denegado</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Solo los usuarios con rol de <span className="font-semibold text-primary">Gerente</span> pueden cargar datos.
        </p>
      </div>
    );
  }

  const tabs = [
    {
      key: "ventas", label: "📊 Ventas", icon: <FileSpreadsheet className="h-4 w-4" />, color: "text-primary",
      desc: "FECHA, COD CLIENTE, CLIENTE, CIUDAD, LINEA DE PRODUCTO, FAC. NRO, CODIGO PRODUCTO, PRODUCTO, COSTO, TOTAL, MONTO EN, MONTO USD, VENDEDOR, MERCADO"
    },
    {
      key: "targets", label: "🎯 Targets", icon: <FileSpreadsheet className="h-4 w-4" />, color: "text-secondary",
      desc: "Visitador, Linea de Producto, Enero...Diciembre, Total"
    },
    {
      key: "clientes", label: "👥 Clientes", icon: <Users className="h-4 w-4" />, color: "text-chart-3",
      desc: "NOMBRE, CONTACTO, CIUDAD, DIRECCION, EMAIL, TELEFONO, SEGMENTO, NIVEL PRECIO, MERCADO"
    },
    {
      key: "jornadas", label: "🏥 Jornada Consolidada", icon: <ClipboardList className="h-4 w-4" />, color: "text-emerald",
      desc: "Master Template: 5 hojas (Pacientes, Insumos, Honorarios, Gastos y Metas/Precios)."
    },
    {
      key: "conofta_targets", label: "💰 Ingresos y Metas", icon: <FileSpreadsheet className="h-4 w-4" />, color: "text-amber-500",
      desc: "Configuración de Ingresos (lo que se cobra al gobierno) y Metas de cirugía."
    },
    {
      key: "precios_ref", label: "💲 Costos Productos", icon: <DollarSign className="h-4 w-4" />, color: "text-chart-3",
      desc: "CODIGO, DESCRIPCION, COSTO — Lista de precios de costo por producto/insumo para calcular el Gross Margin CONOFTA."
    },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Carga de Datos</h2>
        <p className="text-sm text-muted-foreground">Importe archivos Excel (.xlsx) de forma independiente para cada tipo de dato.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted">
          {tabs.map(t => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
          <TabsTrigger value="manage">🗑️ Gestionar</TabsTrigger>
        </TabsList>

        {tabs.map(tab => (
          <TabsContent key={tab.key} value={tab.key}>
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-sm font-semibold ${tab.color} flex items-center gap-2`}>
                    {tab.icon} {tab.label}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1">Columnas: {tab.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  {tab.key === "targets" && (
                    <div className="flex items-center gap-2 mr-4">
                      <label className="text-xs font-medium text-muted-foreground">Año:</label>
                      <select
                        value={targetYear}
                        onChange={(e) => setTargetYear(e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  )}
                  <button onClick={() => {
                    let t: any = tab.key;
                    if (t === "jornadas") t = "conofta_jornada_completa";
                    if (t === "precios_ref") t = "conofta_product_costs";
                    downloadTemplate(t);
                  }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <Download className="h-3.5 w-3.5" /> Descargar Template
                  </button>
                </div>
              </div>

              {recordCounts[tab.key] !== null && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  <span><strong>{recordCounts[tab.key]?.toLocaleString()}</strong> registros cargados en la base de datos</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="flex-1 flex items-center gap-3 cursor-pointer rounded-lg border-2 border-dashed border-border p-5 hover:border-primary/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-foreground font-medium">
                    {files[tab.key] ? files[tab.key]!.name : "Seleccionar archivo Excel"}
                  </span>
                  <input type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={(e) => handleFileChange(tab.key, e)} />
                </label>
                <button onClick={() => handleImport(tab.key)}
                  disabled={!files[tab.key] || statuses[tab.key].type === "loading" || statuses[tab.key].type === "error"}
                  className="rounded-lg gradient-emerald px-6 py-3 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
                  {statuses[tab.key].type === "loading" ? "Importando..." : "Importar"}
                </button>
              </div>

              <StatusMessage status={statuses[tab.key]} />
            </div>
          </TabsContent>
        ))}

        <TabsContent value="manage">
          <div className="space-y-4">
            {[
              { table: "sales_details", label: "Ventas Detalladas", desc: "Eliminar todos los registros de ventas importados." },
              { table: "sales_targets", label: "Targets por Visitador", desc: "Eliminar todos los targets importados." },
              { table: "clients", label: "Base de Clientes", desc: "Eliminar todos los clientes importados." },
              { table: "inventory_lots", label: "Stock / Inventario", desc: "Eliminar todos los lotes de inventario importados." },
              { table: "conofta_targets", label: "Metas CONOFTA", desc: "Eliminar todas las metas de cirugías." },
              { table: "conofta_surgeries", label: "Jornadas CONOFTA", desc: "Eliminar todo el detalle de cirugías (Pacientes e Insumos)." },
              { table: "conofta_product_costs", label: "Configuración Financiera (Honorarios)", desc: "Eliminar tabla de costos y honorarios base de cirujanos e items." },
              { table: "conofta_expenses", label: "Gastos Mensuales (P&L)", desc: "Eliminar gastos operativos (RH, Marketing, Otros)." },
            ].map(item => (
              <div key={item.table} className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <button onClick={() => handleClear(item.table, item.label)}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-4 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Limpiar
                </button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusMessage({ status }: { status: { type: string; message: string } }) {
  if (status.type === "idle") return null;
  const icon =
    status.type === "success" ? <CheckCircle className="h-4 w-4 text-primary" /> :
      status.type === "warning" ? <AlertTriangle className="h-4 w-4 text-chart-3" /> :
        status.type === "error" ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
          <div className="h-4 w-4 rounded-full gradient-emerald animate-pulse" />;
  return (
    <div className={`mt-3 flex items-start gap-2 text-xs ${status.type === "error" ? "text-destructive" : status.type === "warning" ? "text-chart-3" : "text-muted-foreground"}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <pre className="whitespace-pre-wrap font-sans">{status.message}</pre>
    </div>
  );
}
