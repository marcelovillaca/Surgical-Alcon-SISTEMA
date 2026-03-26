import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ShieldX, Upload, Download, TrendingUp, TrendingDown, Minus, DollarSign, Calendar, Plus, Trash2, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from "recharts";
import * as XLSX from "xlsx";
import { formatUSD } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_FULL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const tooltipStyle = {
  contentStyle: { backgroundColor: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,18%)", borderRadius: "8px", fontSize: "12px", color: "hsl(0,0%,95%)" },
};

const HR_CATEGORIES = [
  { value: "salarios", label: "Salarios" },
  { value: "encargos", label: "Encargos Sociales" },
  { value: "comisiones", label: "Comisiones" },
  { value: "alquiler", label: "Alquiler" },
  { value: "marketing", label: "Marketing" },
  { value: "logistica", label: "Logística" },
  { value: "otros", label: "Otros OPEX" },
];

const EXT_CATEGORIES = [
  { value: "admin", label: "Administrativo" },
  { value: "marketing", label: "Marketing / Publicidad" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "activo_fijo", label: "Activo Fijo / Mobiliario" },
  { value: "otros", label: "Otros Extraordinarios" },
];

const FREQ_OPTIONS = [
  { value: "mensual", label: "Mensual" },
  { value: "bimestral", label: "Bimestral (c/2 meses)" },
  { value: "trimestral", label: "Trimestral (c/3 meses)" },
  { value: "semestral", label: "Semestral (c/6 meses)" },
  { value: "anual", label: "Anual (1 vez/año)" },
];

const FREQ_STEP: Record<string, number> = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };

/** Returns true if this month is active for a recurring cost row */
function isActiveMonth(h: any, month: number): boolean {
  // If the record has a specific month assigned, use it (Instance-based)
  if (h.mes !== undefined && h.mes !== null) {
    return h.mes === month;
  }

  // Rule-based fallback (if mes is null, check range and step)
  if (h.tipo === "extraordinario") return h.mes === month;

  const start = Number(h.mes_inicio ?? 1);
  const end = Number(h.mes_fin ?? 12);
  if (month < start || month > end) return false;
  const step = FREQ_STEP[h.frecuencia ?? "mensual"] ?? 1;
  return (month - start) % step === 0;
}

export default function Intelligence() {
  const { user } = useAuth();
  const { isGerente, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [availableYears, setAvailableYears] = useState<number[]>([currentYear, currentYear - 1, currentYear - 2]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMarket, setSelectedMarket] = useState<"privado" | "todos">("privado");
  const [salesData, setSalesData] = useState<any[]>([]);
  const [hrData, setHrData] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  // ── New cost form state ────────────────────────────────────────────────────
  const [costForm, setCostForm] = useState({
    tipo: "recorrente" as "recorrente" | "extraordinario",
    categoria: "salarios",
    categoria_ext: "admin",
    descripcion: "",
    monto: "",
    frecuencia: "mensual",
    mes_inicio: 1,
    mes_fin: 12,
    mes_unico: new Date().getMonth() + 1,
    anio: currentYear,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isGerente) return;
    fetchData();
  }, [isGerente, selectedYear, selectedMarket]);

  const fetchData = async () => {
    setLoadingSales(true);
    let allSales: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let query = supabase
      .from("sales_details")
      .select("fecha, costo, total, monto_usd, linea_de_producto, vendedor, mercado")
      .gte("fecha", `${selectedYear - 1}-01-01`)
      .lte("fecha", `${selectedYear}-12-31`);
    if (selectedMarket === "privado") query = query.eq("mercado", "Privado");
    while (true) {
      const { data } = await query.range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      allSales = allSales.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    setSalesData(allSales);
    const [{ data: oldest }, { data: newest }] = await Promise.all([
      supabase.from("sales_details").select("fecha").order("fecha", { ascending: true }).limit(1),
      supabase.from("sales_details").select("fecha").order("fecha", { ascending: false }).limit(1),
    ]);
    if (oldest?.length && newest?.length) {
      const minY = new Date(oldest[0].fecha).getFullYear();
      const maxY = new Date(newest[0].fecha).getFullYear();
      const yrs: number[] = [];
      for (let y = maxY; y >= minY; y--) yrs.push(y);
      setAvailableYears(yrs);
    }
    const { data: hr } = await supabase.from("hr_costs").select("*").gte("anio", selectedYear - 1).lte("anio", selectedYear);
    setHrData(hr || []);
    setLoadingSales(false);
  };

  // ── Save new cost entry ────────────────────────────────────────────────────
  const handleSaveCost = useCallback(async () => {
    const monto = parseFloat(costForm.monto);
    if (!monto || monto <= 0) { toast({ title: "Monto inválido", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (costForm.tipo === "recorrente") {
        // Insert one row per "active month" based on frequency (for the chosen year)
        const rows: any[] = [];
        for (let m = costForm.mes_inicio; m <= costForm.mes_fin; m++) {
          const step = FREQ_STEP[costForm.frecuencia] ?? 1;
          if ((m - costForm.mes_inicio) % step === 0) {
            rows.push({
              anio: costForm.anio, mes: m,
              categoria: costForm.categoria, descripcion: costForm.descripcion || "",
              monto, tipo: "recorrente", frecuencia: costForm.frecuencia,
              mes_inicio: costForm.mes_inicio, mes_fin: costForm.mes_fin,
              uploaded_by: user!.id,
            });
          }
        }
        const { error } = await supabase.from("hr_costs").upsert(rows as any, { onConflict: "anio,mes,categoria,descripcion" });
        if (error) throw error;
        toast({ title: `✅ ${rows.length} meses de custo recorrente registrados` });
      } else {
        // Extraordinary — single month
        const { error } = await supabase.from("hr_costs").upsert([{
          anio: costForm.anio, mes: costForm.mes_unico,
          categoria: costForm.categoria_ext, descripcion: costForm.descripcion || "",
          monto, tipo: "extraordinario", frecuencia: null,
          mes_inicio: costForm.mes_unico, mes_fin: costForm.mes_unico,
          categoria_ext: costForm.categoria_ext,
          uploaded_by: user!.id,
        }] as any, { onConflict: "anio,mes,categoria,descripcion" });
        if (error) throw error;
        toast({ title: "✅ Custo extraordinario registrado" });
      }
      setCostForm(prev => ({ ...prev, monto: "", descripcion: "" }));
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  }, [costForm, user]);

  const handleDeleteCost = async (id: string) => {
    await supabase.from("hr_costs").delete().eq("id", id);
    toast({ title: "Custo eliminado" });
    fetchData();
  };

  // ── P&L calculation ────────────────────────────────────────────────────────
  const plData = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth(); // 0-indexed

    const buildMonthly = (year: number) => {
      return MESES.map((label, idx) => {
        const month = idx + 1;
        const monthSales = salesData.filter(s => {
          const d = new Date(s.fecha);
          return d.getFullYear() === year && d.getMonth() === idx;
        });

        const revenue = monthSales.reduce((sum: number, s: any) => sum + Number(s.monto_usd || 0), 0);
        const standardSales = monthSales.filter(s => s.vendedor?.trim().toLowerCase() !== "la policlinica");
        const polySales = monthSales.filter(s => s.vendedor?.trim().toLowerCase() === "la policlinica");
        const cogs = standardSales.reduce((sum: number, s: any) => sum + Number(s.costo || 0), 0);
        const autofactura = polySales.reduce((sum: number, s: any) => sum + Number(s.costo || 0), 0);
        const grossMargin = revenue - cogs - autofactura;

        // YTD Logic: If current year, don't show costs for current or future months 
        // unless requested otherwise. The user said "if we haven't finished March, don't show costs"
        const isFutureOrCurrent = year === curY && idx >= curM;
        const shouldShowCosts = !isFutureOrCurrent || (revenue > 0 && idx === curM);

        const monthHr = hrData.filter(h => h.anio === year && isActiveMonth(h, month));
        const rhCost = shouldShowCosts
          ? monthHr.filter(h => ["salarios", "encargos", "comisiones"].includes(h.categoria))
            .reduce((s: number, h: any) => s + Number(h.monto || 0), 0)
          : 0;
        const opex = shouldShowCosts
          ? monthHr.filter(h => !["salarios", "encargos", "comisiones"].includes(h.categoria))
            .reduce((s: number, h: any) => s + Number(h.monto || 0), 0)
          : 0;

        const netMargin = grossMargin - rhCost - opex;

        return { mes: label, month_idx: idx, revenue, cogs, autofactura, grossMargin, rhCost, opex, netMargin, isYTD: !isFutureOrCurrent };
      });
    };
    return { current: buildMonthly(selectedYear), previous: buildMonthly(selectedYear - 1) };
  }, [salesData, hrData, selectedYear]);

  const yoyData = useMemo(() => {
    return MESES.map((label, idx) => ({
      mes: label,
      [`Revenue ${selectedYear}`]: plData.current[idx].revenue,
      [`Revenue ${selectedYear - 1}`]: plData.previous[idx].revenue,
      [`GM ${selectedYear}`]: plData.current[idx].grossMargin,
      [`GM ${selectedYear - 1}`]: plData.previous[idx].grossMargin,
      [`Net ${selectedYear}`]: plData.current[idx].netMargin,
      [`Net ${selectedYear - 1}`]: plData.previous[idx].netMargin,
    }));
  }, [plData, selectedYear]);

  const totals = useMemo(() => {
    const isCurrentYearSelected = selectedYear === (new Date().getFullYear());

    // Find the last month that has any revenue in the current view
    let lastMonthIndex = 11;
    if (isCurrentYearSelected) {
      const lastRevIdx = [...plData.current].reverse().findIndex(m => m.revenue > 0);
      lastMonthIndex = lastRevIdx === -1 ? 0 : 11 - lastRevIdx;
    }

    const periodCurrent = plData.current.filter((_, idx) => idx <= lastMonthIndex);
    const periodPrevious = plData.previous.filter((_, idx) => idx <= lastMonthIndex);

    const sum = (arr: any[], key: string) => arr.reduce((s: number, r: any) => s + r[key], 0);

    const curRev = sum(periodCurrent, "revenue");
    const prevRev = sum(periodPrevious, "revenue");
    const curGM = sum(periodCurrent, "grossMargin");
    const curNet = sum(periodCurrent, "netMargin");
    const curRH = sum(periodCurrent, "rhCost");
    const curOpex = sum(periodCurrent, "opex");
    const curCogs = sum(periodCurrent, "cogs");
    const curAuto = sum(periodCurrent, "autofactura");

    return {
      revenue: curRev,
      revenuePrev: prevRev,
      revenueChange: prevRev ? ((curRev - prevRev) / prevRev * 100) : 0,
      grossMargin: curGM,
      gmPct: curRev ? (curGM / curRev * 100) : 0,
      netMargin: curNet,
      netPct: curRev ? (curNet / curRev * 100) : 0,
      rhCost: curRH,
      opex: curOpex,
      cogs: curCogs,
      autofactura: curAuto,
      monthsCount: lastMonthIndex + 1,
      isShowingYTD: isCurrentYearSelected
    };
  }, [plData, selectedYear]);

  if (roleLoading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-lg gradient-emerald animate-pulse" /></div>;
  if (!isGerente) return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center"><ShieldX className="h-8 w-8 text-destructive" /></div>
      <h2 className="text-lg font-display font-bold text-foreground">Acceso Denegado</h2>
      <p className="text-sm text-muted-foreground">Solo gerentes tienen acceso a Inteligencia.</p>
    </div>
  );

  const ChangeIndicator = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
    const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
    const color = value > 0 ? "text-primary" : value < 0 ? "text-destructive" : "text-muted-foreground";
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
        <Icon className="h-3 w-3" />
        {value > 0 ? "+" : ""}{value.toFixed(1)}{suffix}
      </span>
    );
  };

  const currentYearHr = hrData.filter(h => h.anio === selectedYear);

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-6 shadow-xl ring-1 ring-white/5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Inteligencia Financiera</h1>
            <p className="text-sm text-muted-foreground mt-1">P&L completo en USD con comparativo año anterior</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-background/50 p-1.5 rounded-xl border border-border shadow-md">
              <button onClick={() => setSelectedMarket('privado')} className={cn("px-6 py-2 text-xs font-bold rounded-lg transition-all", selectedMarket === 'privado' ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>Mercado Privado</button>
              <button onClick={() => setSelectedMarket('todos')} className={cn("px-6 py-2 text-xs font-bold rounded-lg transition-all ml-1", selectedMarket === 'todos' ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/20" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>Ver Todo (Inc. Público)</button>
            </div>
            <div className="h-10 w-px bg-border hidden lg:block mx-1" />
            <div className="relative group">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="h-10 pl-10 pr-4 rounded-lg border border-border bg-background text-xs font-bold text-foreground outline-none ring-primary/20 focus:ring-2 transition-all min-w-[120px] appearance-none cursor-pointer hover:bg-muted/50">
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* YTD Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 backdrop-blur-md">
          <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70">Revenue YTD</p>
          <h2 className="text-3xl font-display font-black text-foreground mt-1">{formatUSD(totals.revenue)}</h2>
          <div className="flex items-center gap-2 mt-2">
            <ChangeIndicator value={totals.revenueChange} suffix="%" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase">vs Año Anterior</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 backdrop-blur-md">
          <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500/70">Gross Margin YTD</p>
          <h2 className="text-3xl font-display font-black text-foreground mt-1">{formatUSD(totals.grossMargin)}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-blue-400">{totals.gmPct.toFixed(1)}%</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase">de margen</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 backdrop-blur-md">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Minus size={80} /></div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500/70">RH & OPEX YTD</p>
          <h2 className="text-3xl font-display font-black text-foreground mt-1">{formatUSD(totals.rhCost + totals.opex)}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-bold text-rose-400">{((totals.rhCost + totals.opex) / totals.revenue * 100 || 0).toFixed(1)}%</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase">sobre ventas</span>
          </div>
        </div>

        <div className={cn("relative overflow-hidden rounded-2xl border p-6 backdrop-blur-md", totals.netMargin >= 0 ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10")}>
          <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl">{totals.netMargin >= 0 ? "✓" : "!"}</div>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Net Margin YTD</p>
          <h2 className="text-3xl font-display font-black text-foreground mt-1">{formatUSD(totals.netMargin)}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn("text-sm font-bold", totals.netPct >= 0 ? "text-emerald-400" : "text-destructive")}>{totals.netPct.toFixed(1)}%</span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase">final YTD</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pl">
        <TabsList className="bg-muted">
          <TabsTrigger value="pl">📊 P&L Mensual</TabsTrigger>
          <TabsTrigger value="yoy">📈 YoY Comparativo</TabsTrigger>
          <TabsTrigger value="costs">💰 Gestionar Costos</TabsTrigger>
        </TabsList>

        <TabsContent value="pl">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-display font-semibold text-foreground mb-4">P&L Mensual — {selectedYear}</h3>
            {loadingSales ? (
              <div className="flex justify-center py-12"><div className="h-8 w-8 rounded-lg gradient-emerald animate-pulse" /></div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={plData.current} barGap={2}>
                    <CartesianGrid strokeDasharray="3 4" stroke="hsl(0,0%,20%)" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: "hsl(0,0%,65%)", fontSize: 11 }} axisLine={false} />
                    <YAxis tickFormatter={v => formatUSD(v)} tick={{ fill: "hsl(0,0%,65%)", fontSize: 10 }} axisLine={false} />
                    <Tooltip formatter={(v: number) => formatUSD(v)} {...tooltipStyle} />
                    <Legend wrapperStyle={{ paddingTop: 20, fontSize: 11 }} iconType="circle" />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(142,76%,36%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="grossMargin" name="Gross Margin" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="netMargin" name="Net Margin" fill="hsl(160,84%,39%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-6 overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="text-left py-2.5 px-4 text-muted-foreground font-bold uppercase tracking-wider">Concepto</th>
                        {MESES.map(m => (
                          <th key={m} className="text-right py-2.5 px-2 text-muted-foreground font-bold">{m}</th>
                        ))}
                        <th className="text-right py-2.5 px-4 text-primary font-black bg-primary/5 uppercase tracking-wider">Total YTD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {[
                        { label: "Revenue (Ventas)", key: "revenue", bold: true, color: "text-emerald-400" },
                        { label: "COGS (Standard)", key: "cogs" },
                        { label: "Autofacturas", key: "autofactura" },
                        { label: "Gross Margin", key: "grossMargin", bold: true, color: "text-blue-400" },
                        { label: "RH & Comisiones", key: "rhCost" },
                        { label: "Gastos Op. (OPEX)", key: "opex" },
                        { label: "Net Margin (Pre-Tax)", key: "netMargin", bold: true, color: "text-amber-400" },
                      ].map(row => {
                        const rowTotal = plData.current.reduce((s, m) => s + (m as any)[row.key], 0);

                        return (
                          <tr key={row.key} className={cn(
                            "group hover:bg-muted/20 transition-colors",
                            row.bold ? "bg-muted/10 font-bold" : "text-muted-foreground"
                          )}>
                            <td className={cn("py-2 px-4 transition-colors", row.color || "text-foreground/80")}>{row.label}</td>
                            {plData.current.map((m, i) => {
                              const val = (m as any)[row.key];
                              return (
                                <td key={i} className={cn(
                                    "text-right py-2 px-2 font-mono tabular-nums leading-none",
                                    val < 0 ? "text-rose-400/80" : ""
                                )}>
                                  {formatUSD(val)}
                                </td>
                              );
                            })}
                            <td className={cn(
                                "text-right py-2 px-4 font-black font-mono tabular-nums bg-muted/5 group-hover:bg-muted/30 transition-colors",
                                row.color || "text-foreground"
                            )}>
                              {formatUSD(rowTotal)}
                            </td>
                          </tr>
                        );
                      })}
                      {/* GM % Row */}
                      <tr className="bg-primary/5 border-t border-primary/20">
                        <td className="py-2.5 px-4 text-primary font-black uppercase tracking-tighter italic">GM % Ratio</td>
                        {plData.current.map((m, i) => (
                          <td key={i} className="text-right py-2 px-2 text-primary font-black font-mono">
                            {m.revenue ? (m.grossMargin / m.revenue * 100).toFixed(1) : "0"}%
                          </td>
                        ))}
                        <td className="text-right py-2 px-4 text-primary font-black font-mono bg-primary/10">
                          {plData.current.reduce((s, m) => s + m.revenue, 0) > 0
                            ? ((plData.current.reduce((s, m) => s + m.grossMargin, 0) / plData.current.reduce((s, m) => s + m.revenue, 0)) * 100).toFixed(1)
                            : "0"}%
                        </td>
                      </tr>
                      {/* Net Margin % Row */}
                      <tr className="bg-amber-500/5 text-[11px] transition-colors hover:bg-amber-500/10">
                        <td className="py-2.5 px-4 text-amber-500 font-black uppercase tracking-tighter italic">Net Margin %</td>
                        {plData.current.map((m, i) => (
                          <td key={i} className={cn("text-right py-2 px-2 font-mono font-black", m.netMargin < 0 ? 'text-rose-400' : 'text-amber-500')}>
                            {m.revenue ? (m.netMargin / m.revenue * 100).toFixed(1) : "0"}%
                          </td>
                        ))}
                        <td className="text-right py-2 px-4 text-amber-500 font-black font-mono bg-amber-500/10">
                          {plData.current.reduce((s, m) => s + m.revenue, 0) > 0
                            ? ((plData.current.reduce((s, m) => s + m.netMargin, 0) / plData.current.reduce((s, m) => s + m.revenue, 0)) * 100).toFixed(1)
                            : "0"}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="yoy">
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">Revenue YoY — {selectedYear} vs {selectedYear - 1}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={yoyData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 4" stroke="hsl(0,0%,20%)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(0,0%,65%)", fontSize: 11 }} axisLine={false} />
                  <YAxis tickFormatter={v => formatUSD(v)} tick={{ fill: "hsl(0,0%,65%)", fontSize: 10 }} axisLine={false} />
                  <Tooltip formatter={(v: number) => formatUSD(v)} {...tooltipStyle} />
                  <Legend wrapperStyle={{ paddingTop: 20, fontSize: 11 }} />
                  <Bar dataKey={`Revenue ${selectedYear}`} name={`Ventas ${selectedYear}`} fill="hsl(142,76%,36%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={`Revenue ${selectedYear - 1}`} name={`Ventas ${selectedYear - 1}`} fill="hsl(215,20%,40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">Net Margin YoY — {selectedYear} vs {selectedYear - 1}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={yoyData}>
                  <defs>
                    <linearGradient id="netCur" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(142,76%,36%)" stopOpacity={0.4} /><stop offset="95%" stopColor="hsl(142,76%,36%)" stopOpacity={0} /></linearGradient>
                    <linearGradient id="netPrev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(215,20%,40%)" stopOpacity={0.2} /><stop offset="95%" stopColor="hsl(215,20%,40%)" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" stroke="hsl(0,0%,20%)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(0,0%,65%)", fontSize: 11 }} axisLine={false} />
                  <YAxis tickFormatter={v => formatUSD(v)} tick={{ fill: "hsl(0,0%,65%)", fontSize: 10 }} axisLine={false} />
                  <Tooltip formatter={(v: number) => formatUSD(v)} {...tooltipStyle} />
                  <Legend wrapperStyle={{ paddingTop: 20, fontSize: 11 }} />
                  <Area name={`Net Margin ${selectedYear}`} type="monotone" dataKey={`Net ${selectedYear}`} stroke="hsl(142,76%,36%)" fill="url(#netCur)" strokeWidth={3} />
                  <Area name={`Net Margin ${selectedYear - 1}`} type="monotone" dataKey={`Net ${selectedYear - 1}`} stroke="hsl(215,20%,60%)" fill="url(#netPrev)" strokeWidth={2} strokeDasharray="6 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* ── COSTS TAB: Inline form for recurring & extraordinary ── */}
        <TabsContent value="costs">
          <div className="space-y-6">

            {/* ── New cost form ── */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-primary" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Registrar Nuevo Custo</h3>
                  <p className="text-[11px] text-muted-foreground">Recorrentes se aplicam automaticamente; Extraordinários são pontuais</p>
                </div>
              </div>

              {/* Tipo toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setCostForm(f => ({ ...f, tipo: "recorrente" }))}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border",
                    costForm.tipo === "recorrente" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Recorrente
                </button>
                <button
                  onClick={() => setCostForm(f => ({ ...f, tipo: "extraordinario" }))}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border",
                    costForm.tipo === "extraordinario" ? "bg-amber-500 text-black border-amber-500" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  <Zap className="h-3.5 w-3.5" /> Extraordinário
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Categoria */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Categoria</label>
                  {costForm.tipo === "recorrente" ? (
                    <select value={costForm.categoria} onChange={e => setCostForm(f => ({ ...f, categoria: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                      {HR_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  ) : (
                    <select value={costForm.categoria_ext} onChange={e => setCostForm(f => ({ ...f, categoria_ext: e.target.value, categoria: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500/20 transition-all">
                      {EXT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  )}
                </div>

                {/* Descripción */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Descripción</label>
                  <input type="text" placeholder={costForm.tipo === "recorrente" ? "ej: Equipo Comercial" : "ej: Compra silla de escritório"}
                    value={costForm.descripcion} onChange={e => setCostForm(f => ({ ...f, descripcion: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>

                {/* Monto */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Monto USD</label>
                  <input type="number" placeholder="0.00" min="0" step="0.01"
                    value={costForm.monto} onChange={e => setCostForm(f => ({ ...f, monto: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>

                {/* Año */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Año</label>
                  <select value={costForm.anio} onChange={e => setCostForm(f => ({ ...f, anio: Number(e.target.value) }))}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                {costForm.tipo === "recorrente" ? (
                  <>
                    {/* Frecuencia */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Frecuencia</label>
                      <select value={costForm.frecuencia} onChange={e => setCostForm(f => ({ ...f, frecuencia: e.target.value }))}
                        className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                        {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    {/* Mes inicio → fin */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Período (Mês Inicio → Fin)</label>
                      <div className="flex gap-2">
                        <select value={costForm.mes_inicio} onChange={e => setCostForm(f => ({ ...f, mes_inicio: Number(e.target.value) }))}
                          className="flex-1 h-9 px-2 rounded-lg border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <span className="flex items-center text-muted-foreground text-xs">→</span>
                        <select value={costForm.mes_fin} onChange={e => setCostForm(f => ({ ...f, mes_fin: Number(e.target.value) }))}
                          className="flex-1 h-9 px-2 rounded-lg border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                          {MESES.map((m, i) => <option key={i} value={i + 1} disabled={i + 1 < costForm.mes_inicio}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Mes único para extraordinário */
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Mês do Gasto</label>
                    <select value={costForm.mes_unico} onChange={e => setCostForm(f => ({ ...f, mes_unico: Number(e.target.value) }))}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500/20 transition-all">
                      {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Summary preview */}
              {costForm.monto && parseFloat(costForm.monto) > 0 && (
                <div className={cn("rounded-lg p-3 text-xs border", costForm.tipo === "recorrente" ? "bg-primary/5 border-primary/20 text-primary" : "bg-amber-500/10 border-amber-500/20 text-amber-400")}>
                  {costForm.tipo === "recorrente" ? (
                    <>💡 Este custo de <strong>{formatUSD(parseFloat(costForm.monto))}</strong> será registrado <strong>{FREQ_OPTIONS.find(f => f.value === costForm.frecuencia)?.label.toLowerCase()}</strong> de {MESES[costForm.mes_inicio - 1]} a {MESES[costForm.mes_fin - 1]} — total de <strong>{Math.floor((costForm.mes_fin - costForm.mes_inicio) / (FREQ_STEP[costForm.frecuencia] ?? 1)) + 1} entradas</strong></>
                  ) : (
                    <>⚡ Gasto extraordinário de <strong>{formatUSD(parseFloat(costForm.monto))}</strong> em <strong>{MESES[costForm.mes_unico - 1]}/{costForm.anio}</strong> — categória: <strong>{EXT_CATEGORIES.find(c => c.value === costForm.categoria_ext)?.label}</strong></>
                  )}
                </div>
              )}

              <button onClick={handleSaveCost} disabled={saving || !costForm.monto}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                <Plus className="h-4 w-4" /> {saving ? "Salvando..." : "Registrar Custo"}
              </button>
            </div>

            {/* ── Registered costs list ── */}
            {currentYearHr.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  📋 Custos registrados — {selectedYear}
                  <span className="ml-auto text-xs text-muted-foreground">{currentYearHr.length} entradas</span>
                  <button
                    onClick={async () => {
                      if (confirm(`¿Estás seguro de eliminar TODOS los ${currentYearHr.length} costos de ${selectedYear}? Esta acción no se puede deshacer.`)) {
                        const { error } = await supabase.from("hr_costs").delete().eq("anio", selectedYear);
                        if (!error) {
                          toast({ title: "Todos los costos del año eliminados" });
                          fetchData();
                        }
                      }
                    }}
                    className="ml-2 p-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                    title="Eliminar todos los costos de este año"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </h4>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {currentYearHr.sort((a, b) => a.mes - b.mes).map(h => (
                    <div key={h.id} className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 hover:shadow-lg hover:border-primary/30 group",
                        h.tipo === "extraordinario" ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-muted/20"
                    )}>
                      <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                          h.tipo === "extraordinario" ? "bg-amber-500/10 text-amber-400" : "bg-primary/10 text-primary"
                      )}>
                        {h.tipo === "extraordinario" ? <Zap className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-bold text-foreground tracking-tight">{h.descricion || h.descripcion || h.categoria}</span>
                          <span className={cn(
                              "text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                              h.tipo === "extraordinario" ? "bg-amber-500/20 text-amber-500" : "bg-primary/20 text-primary"
                          )}>
                            {h.tipo === "extraordinario" ? "Extraordinário" : h.frecuencia || "Recorrente"}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 font-medium italic">
                          {MESES[(h.mes ?? 1) - 1]}/{h.anio} · {h.categoria}
                          {h.tipo === "recorrente" && h.mes_inicio && h.mes_fin && ` · Ciclo: ${MESES[h.mes_inicio - 1]}–${MESES[h.mes_fin - 1]}`}
                        </div>
                      </div>
                      <span className="font-black text-foreground font-mono tabular-nums text-sm shrink-0">{formatUSD(h.monto)}</span>
                      <button onClick={() => handleDeleteCost(h.id)} className="p-2 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Summary by category */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border">
                  {HR_CATEGORIES.concat(EXT_CATEGORIES.filter(e => !HR_CATEGORIES.find(h => h.value === e.value))).map(cat => {
                    const total = currentYearHr.filter(h => h.categoria === cat.value).reduce((s, h) => s + (h.monto || 0), 0);
                    if (total === 0) return null;
                    return (
                      <div key={cat.value} className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-[10px] text-muted-foreground uppercase">{cat.label}</p>
                        <p className="text-sm font-display font-bold text-foreground">{formatUSD(total)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs >
    </div >
  );
}
