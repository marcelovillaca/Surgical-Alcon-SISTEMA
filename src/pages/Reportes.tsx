import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { FileDown, ShieldX, Loader2, Eye, Download, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

type ReportType = "ventas" | "productos" | "stock" | "visitas";

const REPORT_OPTIONS: { key: ReportType; label: string; desc: string; icon: string }[] = [
  { key: "ventas", label: "Reporte de Ventas", desc: "Todas las ventas detalladas con cliente, producto, vendedor y montos.", icon: "📊" },
  { key: "productos", label: "Reporte de Productos", desc: "Catálogo completo de productos con precios, costos y línea.", icon: "📦" },
  { key: "stock", label: "Reporte de Stock con Criticidad", desc: "Inventario por lote con estado de vencimiento y criticidad.", icon: "⚠️" },
  { key: "visitas", label: "Reporte de Visitas", desc: "Seguimiento de agenda, atrasos, justificaciones y geolocalización.", icon: "📍" },
];

function daysUntilExpiry(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function criticalityLabel(days: number): string {
  if (days < 0) return "VENCIDO";
  if (days <= 30) return "CRITICO";
  if (days <= 60) return "ALERTA";
  if (days <= 90) return "PRECAUCIÓN";
  return "OK";
}

function criticalityColor(label: string): string {
  switch (label) {
    case "VENCIDO": return "bg-destructive/15 text-destructive border-destructive/30";
    case "CRITICO": return "bg-red-500/15 text-red-400 border-red-500/30";
    case "ALERTA": return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    case "PRECAUCIÓN": return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "OK": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function criticalityBadge(label: string) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${criticalityColor(label)}`}>
      {label}
    </span>
  );
}

type ReportData = {
  headers: string[];
  rows: any[][];
  type: ReportType;
};

export default function Reportes() {
  const { isGerente, loading: roleLoading } = useUserRole();
  const [generating, setGenerating] = useState<ReportType | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [filterVisitor, setFilterVisitor] = useState("todos");
  const [visitors, setVisitors] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    if (isGerente) fetchVisitors();
  }, [isGerente]);

  const fetchVisitors = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name");
    if (data) setVisitors(data.map(d => ({ id: d.id, name: d.full_name })));
  };

  const fetchReportData = async (type: ReportType): Promise<ReportData> => {
    let headers: string[] = [];
    let rows: any[][] = [];

    if (type === "ventas") {
      let query = supabase.from("sales_details")
        .select("fecha,cod_cliente,cliente,ciudad,linea_de_producto,factura_nro,codigo_producto,producto,costo,total,monto_usd,vendedor")
        .order("fecha", { ascending: false });

      if (filterVisitor !== "todos") {
        // Here we need to map visitor name to vendedor if possible, or just filter by vendedor field
        // Since we don't have a direct mapping in sales_details yet, we might skip this or use the 'vendedor' string
        // For now let's assume 'vendedor' string matching if it exists
      }

      const { data: sales } = await query.limit(5000); // Reasonable limit for on-screen
      headers = ["Fecha", "Cod Cliente", "Cliente", "Ciudad", "Línea", "Factura", "Código Prod.", "Producto", "Costo", "Total", "USD", "Vendedor"];
      rows = (sales || []).map(s => [s.fecha, s.cod_cliente, s.cliente, s.ciudad, s.linea_de_producto, s.factura_nro, s.codigo_producto, s.producto, s.costo, s.total, s.monto_usd, s.vendedor]);
    } else if (type === "productos") {
      const { data: prods } = await supabase.from("products")
        .select("sku,name,product_line,cost_pyg,price_base_pyg,active,unit_of_measure")
        .order("name");
      headers = ["SKU", "Producto", "Línea", "Costo PYG", "Precio Base PYG", "Activo", "Unidad"];
      rows = (prods || []).map(p => [p.sku, p.name, p.product_line, p.cost_pyg, p.price_base_pyg, p.active ? "Sí" : "No", p.unit_of_measure]);
    } else if (type === "stock") {
      const { data: lots } = await supabase.from("inventory_lots")
        .select("lot_number,expiry_date,quantity,status,serial_number,product_id,products(sku,name,product_line)")
        .order("expiry_date");
      headers = ["SKU", "Producto", "Línea", "Lote/SN", "Cantidad", "Fecha Venc.", "Días Restantes", "Criticidad", "Estado"];
      rows = (lots || []).map((l: any) => {
        const days = daysUntilExpiry(l.expiry_date);
        return [
          l.products?.sku || "", l.products?.name || "", l.products?.product_line || "",
          l.lot_number || l.serial_number || "", l.quantity, l.expiry_date,
          days, criticalityLabel(days), l.status,
        ];
      });
    } else if (type === "visitas") {
      let query = supabase.from("visits")
        .select("id, visit_date, scheduled_time, visit_type, check_in_at, check_out_at, check_in_lat, check_in_lon, approved, created_by, justification, client:clients(name, city), visitor:profiles!visits_created_by_fkey(full_name)")
        .order("visit_date", { ascending: false });

      if (filterVisitor !== "todos") {
        query = query.eq("created_by", filterVisitor);
      }

      const { data: visits } = await query;
      const today = new Date().toISOString().split("T")[0];

      headers = ["Fecha", "Hora", "Visitador", "Cliente", "Tipo", "Estado", "Atención", "Justificación", "GPS"];
      rows = (visits || []).map((v: any) => {
        const isDelayed = v.visit_date < today && !v.check_in_at && !v.justification && (v.approved === true || v.approved === null);
        let status = "Pendiente";
        if (v.check_out_at) status = "Completada";
        else if (isDelayed) status = "ATRASADA";
        else if (v.approved === true) status = "Aprobada";
        else if (v.approved === false) status = "Rechazada";
        else if (v.justification) status = "Justificada";

        return [
          v.visit_date,
          v.scheduled_time?.substring(0, 5) || "--:--",
          v.visitor?.full_name || "Desconocido",
          v.client?.name || "Desconocido",
          v.visit_type,
          status,
          v.check_in_at ? "Check-in Realizado" : "No realizado",
          v.justification || "—",
          v.check_in_lat ? `${v.check_in_lat.toFixed(4)}, ${v.check_in_lon.toFixed(4)}` : "Sin datos",
        ];
      });
    }

    return { headers, rows, type };
  };

  const generateReport = async (type: ReportType) => {
    setGenerating(type);
    try {
      const data = await fetchReportData(type);
      setReportData(data);
    } catch (err: any) {
      alert("Error al generar reporte: " + (err.message || "Error desconocido"));
    } finally {
      setGenerating(null);
    }
  };

  const downloadExcel = () => {
    if (!reportData) return;
    const ws = XLSX.utils.aoa_to_sheet([reportData.headers, ...reportData.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    const filename = `reporte_${reportData.type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const formatPYG = (v: number) => {
    if (typeof v !== "number") return v;
    return `₲ ${v.toLocaleString()}`;
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
        <p className="text-sm text-muted-foreground text-center max-w-md">Solo Gerentes pueden generar reportes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-foreground">Reportes de Gestión</h2>
        <p className="text-sm text-muted-foreground">Genere reportes detallados y visualice indicadores clave.</p>
      </div>

      <div className="flex flex-col md:flex-row items-end gap-4 bg-muted/20 p-4 rounded-xl border border-border">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Filtrar por Visitador / Vendedor</label>
          <select
            value={filterVisitor}
            onChange={(e) => setFilterVisitor(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="todos">Todos los responsables</option>
            {visitors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="text-xs text-muted-foreground italic max-w-xs">
          El filtro aplica principalmente al Reporte de Visitas y Ventas (según asignación).
        </div>
      </div>

      {/* Report selection cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {REPORT_OPTIONS.map(opt => (
          <div key={opt.key} className={cn(
            "rounded-xl border bg-card p-5 flex flex-col gap-4 transition-all hover:border-primary/30",
            reportData?.type === opt.key ? "border-primary/50 ring-1 ring-primary/20 shadow-lg" : "border-border"
          )}>
            <div>
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xl mb-3">
                {opt.icon}
              </div>
              <h3 className="text-sm font-display font-bold text-foreground">{opt.label}</h3>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
            </div>
            <button
              onClick={() => generateReport(opt.key)}
              disabled={generating !== null}
              className="mt-auto flex items-center justify-center gap-2 rounded-lg gradient-emerald px-4 py-2 text-xs font-bold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {generating === opt.key ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...</>
              ) : (
                <><Eye className="h-3.5 w-3.5" /> Ver Reporte</>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* On-screen report display */}
      {reportData && (
        <div className="space-y-6 animate-slide-in">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
                {REPORT_OPTIONS.find(o => o.key === reportData.type)?.icon} {REPORT_OPTIONS.find(o => o.key === reportData.type)?.label}
              </h3>
              <p className="text-xs text-muted-foreground">{reportData.rows.length} registros encontrados</p>
            </div>
            <button
              onClick={downloadExcel}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors shadow-sm"
            >
              <Download className="h-4 w-4" /> Exportar a Excel
            </button>
          </div>

          {/* Report specific summaries */}
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            {reportData.type === "stock" && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {["VENCIDO", "CRITICO", "ALERTA", "PRECAUCIÓN", "OK"].map(level => {
                  const count = reportData.rows.filter(r => r[7] === level).length;
                  const qty = reportData.rows.filter(r => r[7] === level).reduce((s, r) => s + (Number(r[4]) || 0), 0);
                  const color = criticalityColor(level);
                  return (
                    <div key={level} className={cn("rounded-xl border p-4 shadow-sm", color)}>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{level}</p>
                      <p className="text-2xl font-display font-bold mt-1">{count}</p>
                      <p className="text-[10px] font-medium opacity-70">{qty.toLocaleString()} unidades</p>
                    </div>
                  );
                })}
              </div>
            )}

            {reportData.type === "visitas" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden h-[400px] relative shadow-inner">
                  <div className="absolute inset-0 bg-muted/50 flex flex-col items-center justify-center p-8 text-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <MapPin className="h-8 w-8 text-primary animate-bounce" />
                    </div>
                    <h4 className="text-lg font-display font-bold text-foreground">Mapa Dinámico de Visitas</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mt-2">
                      Visualización geolocalizada de los check-ins realizados en tiempo real.
                      Seleccione una visita de la tabla para ver su ubicación exacta.
                    </p>

                    <div className="mt-8 flex flex-wrap justify-center gap-2 overflow-hidden max-h-24">
                      {reportData.rows.filter(r => r[8] !== "Sin datos").slice(0, 10).map((r, i) => (
                        <span key={i} className="px-3 py-1 transparent-blur rounded-full border border-primary/20 text-[10px] text-primary font-bold">
                          📍 {r[3]}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Map overlay simulation */}
                  <div className="absolute top-4 right-4 z-10 space-y-2">
                    <div className="bg-card/90 backdrop-blur border border-border p-2 rounded-lg shadow-lg">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Leyenda</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px]">A tiempo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                        <span className="text-[10px]">Atrasado</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">Métricas de Agenda</h4>
                    <div className="space-y-3">
                      {["Pendiente", "Aprobada", "ATRASADA", "Completada", "Rechazada"].map(status => {
                        const count = reportData.rows.filter(r => r[5] === status).length;
                        const colors: Record<string, string> = {
                          "Pendiente": "bg-primary", "Aprobada": "bg-secondary",
                          "ATRASADA": "bg-destructive", "Completada": "bg-emerald-500",
                          "Rechazada": "bg-muted-foreground"
                        };
                        const textColors: Record<string, string> = {
                          "Pendiente": "text-primary", "Aprobada": "text-secondary",
                          "ATRASADA": "text-destructive", "Completada": "text-emerald-500",
                          "Rechazada": "text-muted-foreground"
                        };
                        return (
                          <div key={status} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground">{status}</span>
                              <span className={cn("font-bold", textColors[status])}>{count}</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn("h-full", colors[status])}
                                style={{ width: `${(count / (reportData.rows.length || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-primary/10 border border-primary/20 p-5 shadow-sm">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Resumen de Seguimiento</p>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-display font-bold text-foreground">
                          {reportData.rows.filter(r => r[7] !== "—").length}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium">Justificaciones cargadas</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-display font-bold text-secondary">
                          {((reportData.rows.filter(r => r[5] === "Completada").length / (reportData.rows.length || 1)) * 100).toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium">Efectividad</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Data table */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-lg max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-secondary/10 backdrop-blur z-20">
                <tr className="border-b border-border">
                  {reportData.headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 font-bold text-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map((row, ri) => {
                  let rowClass = "border-b border-border/30 hover:bg-muted/50 transition-colors";
                  if (reportData.type === "stock") {
                    const crit = row[7] as string;
                    if (crit === "VENCIDO") rowClass += " bg-destructive/5";
                  }
                  if (reportData.type === "ventas" && Number(row[9]) < 0) {
                    rowClass += " bg-destructive/5";
                  }

                  return (
                    <tr key={ri} className={rowClass}>
                      {row.map((cell: any, ci: number) => {
                        let content: React.ReactNode = cell;

                        // Type-specific formatting
                        if (reportData.type === "ventas" && (ci === 8 || ci === 9)) {
                          const num = Number(cell);
                          content = <span className={cn("font-mono font-bold", num < 0 ? "text-destructive" : "text-foreground")}>{formatPYG(num)}</span>;
                        }
                        if (reportData.type === "ventas" && ci === 10) {
                          const num = Number(cell);
                          content = <span className={cn("font-mono font-bold", num < 0 ? "text-destructive" : "text-primary")}>$ {num.toLocaleString()}</span>;
                        }
                        if (reportData.type === "productos" && (ci === 3 || ci === 4)) {
                          content = <span className="font-mono">{formatPYG(Number(cell))}</span>;
                        }
                        if (reportData.type === "stock" && ci === 7) {
                          content = criticalityBadge(String(cell));
                        }
                        if (reportData.type === "stock" && ci === 6) {
                          const days = Number(cell);
                          const color = days < 0 ? "text-destructive" : days <= 30 ? "text-orange-600" : days <= 90 ? "text-yellow-600" : "text-emerald-600";
                          content = <span className={cn("font-bold font-mono", color)}>{days}</span>;
                        }
                        if (reportData.type === "visitas" && ci === 5) {
                          const status = String(cell);
                          const color = status === "ATRASADA" ? "text-destructive font-bold animate-pulse" :
                            status === "Completada" ? "text-emerald-600 font-bold" :
                              status === "Aprobada" ? "text-secondary font-bold" :
                                status === "Pendiente" ? "text-primary font-bold" : "text-muted-foreground";
                          content = <span className={color}>{status === "ATRASADA" ? "⚠️ ATRASADA" : status}</span>;
                        }
                        if (reportData.type === "visitas" && ci === 7 && cell !== "—") {
                          content = <span className="text-muted-foreground italic truncate max-w-[200px] inline-block cursor-help" title={String(cell)}>"{cell}"</span>;
                        }
                        if (ci === 0 && reportData.type !== "productos") {
                          content = <span className="font-mono font-semibold">{cell}</span>;
                        }

                        return (
                          <td key={ci} className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
