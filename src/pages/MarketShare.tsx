import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { formatUSD, formatPct } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import { Target, TrendingUp, Award, Users, Package, ShoppingCart, ArrowUpRight, ArrowDownRight } from "lucide-react";

const COLORS = ["hsl(45,90%,55%)", "hsl(197,100%,44%)", "hsl(280,60%,55%)", "hsl(20,80%,55%)", "hsl(160,60%,45%)"];
const ttStyle = { contentStyle: { backgroundColor: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,20%)", borderRadius: "8px" }, itemStyle: { color: "hsl(0,0%,90%)" } };

const M_ABBR: Record<number, string> = { 1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun", 7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic" };
const M_NUM: Record<string, number> = { Ene: 1, Feb: 2, Mar: 3, Abr: 4, May: 5, Jun: 6, Jul: 7, Ago: 8, Sep: 9, Oct: 10, Nov: 11, Dic: 12 };

// Seasonal distribution of the market (surgeries/lenses) by month.
// Source: user-provided historical seasonality data.
// Values must sum to 1.0 (100%).
const SEASONAL_WEIGHTS: Record<number, number> = {
    1: 0.06,  // Enero     6%
    2: 0.06,  // Febrero   6%
    3: 0.08,  // Marzo     8%
    4: 0.10,  // Abril    10%
    5: 0.10,  // Mayo     10%
    6: 0.10,  // Junio    10%
    7: 0.11,  // Julio    11%
    8: 0.10,  // Agosto   10%
    9: 0.11,  // Septiembre 11%
    10: 0.07, // Octubre   7%
    11: 0.06, // Noviembre 6%
    12: 0.05, // Diciembre 5%
};

/** Returns the seasonally-adjusted market volume for a given month from the annual total. */
function seasonalMkt(annualTotal: number, month: number): number {
    return annualTotal * (SEASONAL_WEIGHTS[month] ?? 1 / 12);
}

/** Returns the YTD market volume for a set of active months (sum of seasonal weights × annual total). */
function seasonalMktYTD(annualTotal: number, months: number[]): number {
    return months.reduce((sum, m) => sum + seasonalMkt(annualTotal, m), 0);
}


function norm(v: string) { return (v || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

const MONOFOCAL_LINES = ["TOTAL MONOFOCALS", "MONOFOCAL", "MONOFOCALES"];
const ATIOL_LINES = ["ATIOLS", "ATIOL", "MULTIFOCAL", "TORICA", "TORIC", "ADVANCED"];

function classifyLine(linea: string): "monofocal" | "atiol" | "other" {
    const n = norm(linea);
    if (ATIOL_LINES.some(a => n.includes(a))) return "atiol";
    if (MONOFOCAL_LINES.some(m => n.includes(m))) return "monofocal";
    return "other";
}

interface KpiProps { label: string; value: string; sub?: string; positive?: boolean; icon?: React.ReactNode; color?: string; }
function KpiCard({ label, value, sub, positive, icon, color = "hsl(45,90%,55%)" }: KpiProps) {
    return (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20 hover:-translate-y-1 cursor-default group">
            <div className="absolute top-0 right-0 w-24 h-24 opacity-5 rounded-bl-full group-hover:opacity-10 transition-opacity" style={{ background: color }} />
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                {icon && <span className="text-muted-foreground group-hover:text-primary transition-colors">{icon}</span>}
            </div>
            <p className="text-2xl font-black font-display tracking-tight" style={{ color }}>{value}</p>
            {sub && (
                <p className={`text-[11px] font-medium flex items-center gap-1 ${positive === true ? "text-emerald-400" : positive === false ? "text-rose-400" : "text-muted-foreground/70"}`}>
                    {positive === true && <ArrowUpRight className="h-3 w-3" />}
                    {positive === false && <ArrowDownRight className="h-3 w-3" />}
                    {sub}
                </p>
            )}
        </div>
    );
}

export default function MarketShare() {
    const { isGerente, loading: roleLoading } = useUserRole();
    const { toast } = useToast();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [salesRaw, setSalesRaw] = useState<any[]>([]);
    const [marketRaw, setMarketRaw] = useState<any[]>([]);
    const [salesPrevRaw, setSalesPrevRaw] = useState<any[]>([]);
    const [marketPrevRaw, setMarketPrevRaw] = useState<any[]>([]);
    const [ventasTargetsRaw, setVentasTargetsRaw] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState<Record<number, { total_cirurgias_pais: number; total_monofocals_mercado: number; total_atiols_mercado: number; target_share_monofocal: number; target_share_atiol: number; fuente: string }>>({});

    const fetchAll = async () => {
        setLoading(true);
        const curY = parseInt(year);
        const prevY = curY - 1;
        let all: any[] = []; let from = 0;
        while (true) {
            const { data } = await supabase.from("sales_details")
                .select("fecha,linea_de_producto,total,mercado,cliente,cod_cliente")
                .range(from, from + 999);
            if (!data || data.length === 0) break;
            all = all.concat(data);
            if (data.length < 1000) break;
            from += 1000;
        }
        const [mCur, mPrev, vTargets] = await Promise.all([
            supabase.from("market_share_data" as any).select("*").eq("anio", curY),
            supabase.from("market_share_data" as any).select("*").eq("anio", prevY),
            supabase.from("sales_targets" as any).select("anio,linea_de_producto,total,enero,febrero,marzo,abril,mayo,junio,julio,agosto,septiembre,octubre,noviembre,diciembre").eq("anio", curY),
        ]);
        setSalesRaw(all.filter(s => new Date(s.fecha).getFullYear() === curY));
        setSalesPrevRaw(all.filter(s => new Date(s.fecha).getFullYear() === prevY));
        setMarketRaw((mCur.data as any[]) || []);
        setMarketPrevRaw((mPrev.data as any[]) || []);
        setVentasTargetsRaw((vTargets.data as any[]) || []);
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, [year]);

    const computed = useMemo(() => {
        const y = parseInt(year);

        // ✅ Only private market lenses count for Alcon's market share
        // Exclude any row where:
        //   - mercado field says "público" / "publico"
        //   - OR cliente / cod_cliente contains "CONOFTA" (public market client)
        const sales = salesRaw.filter(s => {
            const d = new Date(s.fecha);
            if (d.getFullYear() !== y) return false;
            const mercadoStr = (s.mercado || "").toString().toLowerCase();
            if (mercadoStr.includes("público") || mercadoStr.includes("publico") || mercadoStr.includes("conofta")) return false;
            const clienteStr = ((s.cliente || "") + " " + (s.cod_cliente || "")).toUpperCase();
            if (clienteStr.includes("CONOFTA")) return false;
            return true;
        });

        // Determine which months have Alcon private-market data
        const activeMonthsSet = new Set<number>();
        sales.forEach(s => activeMonthsSet.add(new Date(s.fecha).getMonth() + 1));
        const activeMonths = Array.from(activeMonthsSet).sort((a, b) => a - b);
        const numActiveMonths = activeMonths.length || 1;

        // We always work from the annual record only — monthly sub-records not required.
        const annualRecord = marketRaw.find(r => r.mes === 0) || {};
        const annualMonoMkt = Number(annualRecord.total_monofocals_mercado || 0);
        const annualAtiolMkt = Number(annualRecord.total_atiols_mercado || 0);
        const usingAnnualData = annualMonoMkt > 0 || annualAtiolMkt > 0;

        // Monthly breakdown — market volume distributed by seasonal weights
        const monthly = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const hasAlconData = activeMonthsSet.has(m);
            const mSales = sales.filter(s => new Date(s.fecha).getMonth() + 1 === m);
            // Apply seasonal weight to annual market total
            const monoMkt = seasonalMkt(annualMonoMkt, m);
            const atiolMkt = seasonalMkt(annualAtiolMkt, m);
            const monoAlcon = mSales.filter(s => classifyLine(s.linea_de_producto) === "monofocal").reduce((a, s) => a + Number(s.total || 0), 0);
            const atiolAlcon = mSales.filter(s => classifyLine(s.linea_de_producto) === "atiol").reduce((a, s) => a + Number(s.total || 0), 0);
            const targetMono = Number(annualRecord.target_share_monofocal || 0);
            const targetAtiol = Number(annualRecord.target_share_atiol || 0);
            return {
                mes: M_ABBR[m],
                hasData: hasAlconData,
                monoAlcon, atiolAlcon,
                monoMkt: hasAlconData ? monoMkt : 0,
                atiolMkt: hasAlconData ? atiolMkt : 0,
                monoShare: (hasAlconData && monoMkt > 0) ? (monoAlcon / monoMkt * 100) : 0,
                atiolShare: (hasAlconData && atiolMkt > 0) ? (atiolAlcon / atiolMkt * 100) : 0,
                targetMono,
                targetAtiol,
            };
        });

        // ─── YTD totals (private market only) ────────────────────────────────────
        const totalMonoAlcon = sales.filter(s => classifyLine((s as any).linea_de_producto || "") === "monofocal").reduce((a, s) => a + Number((s as any).total || 0), 0);
        const totalAtiolAlcon = sales.filter(s => classifyLine((s as any).linea_de_producto || "") === "atiol").reduce((a, s) => a + Number((s as any).total || 0), 0);

        // YTD market = sum of seasonal weights for the active months × annual total
        const totalMonoMkt = seasonalMktYTD(annualMonoMkt, activeMonths);
        const totalAtiolMkt = seasonalMktYTD(annualAtiolMkt, activeMonths);

        const totalCirurgiasPais = Number(annualRecord.total_cirurgias_pais || 0);
        const monoShare = totalMonoMkt > 0 ? totalMonoAlcon / totalMonoMkt * 100 : 0;
        const atiolShare = totalAtiolMkt > 0 ? totalAtiolAlcon / totalAtiolMkt * 100 : 0;
        const overallShare = (totalMonoMkt + totalAtiolMkt) > 0 ? (totalMonoAlcon + totalAtiolAlcon) / (totalMonoMkt + totalAtiolMkt) * 100 : 0;
        const targetMono = Number(annualRecord.target_share_monofocal || 0);
        const targetAtiol = Number(annualRecord.target_share_atiol || 0);

        // ── Target MS calculation (YTD logic) ──
        const MESES_FULL_LOWER = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const norm2 = (s: string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

        // 1. Sum target units from plan for ACTIVE MONTHS (YTD)
        const targetMonoFromPlan = ventasTargetsRaw
            .filter(t => { const n = norm2(t.linea_de_producto || ''); return n.includes('MONOFOCAL') || n.includes('TOTAL MONO'); })
            .reduce((a, t) => {
                let s = 0; activeMonths.forEach(m => { s += Number(t[MESES_FULL_LOWER[m - 1]] || 0); });
                return a + s;
            }, 0);

        const targetAtiolFromPlan = ventasTargetsRaw
            .filter(t => { const n = norm2(t.linea_de_producto || ''); return n.includes('ATIOL'); })
            .reduce((a, t) => {
                let s = 0; activeMonths.forEach(m => { s += Number(t[MESES_FULL_LOWER[m - 1]] || 0); });
                return a + s;
            }, 0);

        // 2. Compute Target MS% = Plan Units YTD / Market Units YTD
        // (totalMonoMkt and totalAtiolMkt are already seasonal YTD)
        const targetMonoAuto = totalMonoMkt > 0 ? (targetMonoFromPlan / totalMonoMkt * 100) : 0;
        const targetAtiolAuto = totalAtiolMkt > 0 ? (targetAtiolFromPlan / totalAtiolMkt * 100) : 0;

        // NEW: Prioritize manual % target if provided; fallback to sane auto-calculated target (<100%)
        const finalTargetMono = targetMono > 0 ? targetMono : (targetMonoAuto > 0 && targetMonoAuto <= 100 ? targetMonoAuto : 0);
        const finalTargetAtiol = targetAtiol > 0 ? targetAtiol : (targetAtiolAuto > 0 && targetAtiolAuto <= 100 ? targetAtiolAuto : 0);

        // 3. Overall Target MS% (Weighted)
        const targetOverall = (totalMonoMkt + totalAtiolMkt) > 0
            ? (finalTargetMono * totalMonoMkt + finalTargetAtiol * totalAtiolMkt) / (totalMonoMkt + totalAtiolMkt)
            : 0;

        return {
            monthly, totalMonoAlcon, totalAtiolAlcon, totalMonoMkt, totalAtiolMkt,
            totalCirurgiasPais, monoShare, atiolShare, overallShare,
            targetMono: finalTargetMono, targetAtiol: finalTargetAtiol,
            targetOverall,
            activeMonths, numActiveMonths, usingAnnualData, hasMonthlyMarketData: false,
            totalAlconUnits: totalMonoAlcon + totalAtiolAlcon,
            annualMonoMkt, annualAtiolMkt,
            targetMonoFromPlan, targetAtiolFromPlan,
        };
    }, [salesRaw, marketRaw, ventasTargetsRaw, year]);

    // ── Year-over-year comparison (SAME PERIOD only) ────────────────────────────
    // If current year has Jan+Feb data → compare Jan+Feb of previous year, not full year
    const yoy = useMemo(() => {
        const prevYear = parseInt(year) - 1;
        const activeMs = computed.activeMonths; // e.g. [1, 2] for Jan+Feb
        const numMs = activeMs.length || 1;

        const filterSamePeriod = (rows: any[], y: number) => rows.filter(s => {
            const d = new Date(s.fecha);
            if (d.getFullYear() !== y) return false;
            if (!activeMs.includes(d.getMonth() + 1)) return false; // same months only
            const m = (s.mercado || "").toString().toLowerCase();
            if (m.includes("público") || m.includes("publico") || m.includes("conofta")) return false;
            const c = ((s.cliente || "") + " " + (s.cod_cliente || "")).toUpperCase();
            if (c.includes("CONOFTA")) return false;
            return true;
        });

        // Previous year – same months
        const prevSales = filterSamePeriod(salesPrevRaw, prevYear);
        const prevAnnual = marketPrevRaw.find(r => r.mes === 0) || {};

        const prevMonoAlcon = prevSales
            .filter(s => classifyLine(s.linea_de_producto || "") === "monofocal")
            .reduce((a, s) => a + Number(s.total || 0), 0);
        const prevAtiolAlcon = prevSales
            .filter(s => classifyLine(s.linea_de_producto || "") === "atiol")
            .reduce((a, s) => a + Number(s.total || 0), 0);
        const prevTotalAlcon = prevMonoAlcon + prevAtiolAlcon;

        // Previous year market – seasonal YTD for the same active months
        const prevAnnualMonoMkt = Number(prevAnnual.total_monofocals_mercado || 0);
        const prevAnnualAtiolMkt = Number(prevAnnual.total_atiols_mercado || 0);
        const prevMonoMkt = seasonalMktYTD(prevAnnualMonoMkt, activeMs);
        const prevAtiolMkt = seasonalMktYTD(prevAnnualAtiolMkt, activeMs);
        const prevMonoShare = prevMonoMkt > 0 ? prevMonoAlcon / prevMonoMkt * 100 : 0;
        const prevAtiolShare = prevAtiolMkt > 0 ? prevAtiolAlcon / prevAtiolMkt * 100 : 0;
        const prevOverallShare = (prevMonoMkt + prevAtiolMkt) > 0
            ? (prevMonoAlcon + prevAtiolAlcon) / (prevMonoMkt + prevAtiolMkt) * 100 : 0;

        // ── Period targets (seasonal YTD) ─────────────────────────────────────
        const targetMonoPct = computed.targetMono;
        const targetAtiolPct = computed.targetAtiol;
        const curMonoMktPeriod = seasonalMktYTD(computed.annualMonoMkt, activeMs);
        const curAtiolMktPeriod = seasonalMktYTD(computed.annualAtiolMkt, activeMs);
        const targetMonoUnits = curMonoMktPeriod > 0 ? targetMonoPct / 100 * curMonoMktPeriod : null;
        const targetAtiolUnits = curAtiolMktPeriod > 0 ? targetAtiolPct / 100 * curAtiolMktPeriod : null;

        // ── Deltas ────────────────────────────────────────────────────────────
        const curTotal = computed.totalAlconUnits;
        const unitGrowth = prevTotalAlcon > 0 ? (curTotal - prevTotalAlcon) / prevTotalAlcon * 100 : null;
        const monoUnitGrowth = prevMonoAlcon > 0 ? (computed.totalMonoAlcon - prevMonoAlcon) / prevMonoAlcon * 100 : null;
        const atiolUnitGrowth = prevAtiolAlcon > 0 ? (computed.totalAtiolAlcon - prevAtiolAlcon) / prevAtiolAlcon * 100 : null;
        const msGrowth = prevOverallShare > 0 ? computed.overallShare - prevOverallShare : null;
        const monoMsGrowth = prevMonoShare > 0 ? computed.monoShare - prevMonoShare : null;
        const atiolMsGrowth = prevAtiolShare > 0 ? computed.atiolShare - prevAtiolShare : null;

        const periodLabel = activeMs.length === 0
            ? "—"
            : activeMs.length === 1
                ? (M_ABBR[activeMs[0]] ?? "—")
                : `${M_ABBR[activeMs[0]] ?? "?"}–${M_ABBR[activeMs[activeMs.length - 1]] ?? "?"}`;

        return {
            prevYear, periodLabel, numMs,
            prevTotalAlcon, prevMonoAlcon, prevAtiolAlcon,
            prevMonoShare, prevAtiolShare, prevOverallShare,
            unitGrowth, monoUnitGrowth, atiolUnitGrowth,
            msGrowth, monoMsGrowth, atiolMsGrowth,
            targetMonoUnits, targetAtiolUnits, targetMonoPct, targetAtiolPct,
            hasPrevData: prevTotalAlcon > 0 || prevMonoMkt > 0,
            hasCurTarget: targetMonoPct > 0 || targetAtiolPct > 0,
        };
    }, [salesPrevRaw, marketPrevRaw, computed, year]);

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 4 }, (_, i) => (currentYear - 1 + i).toString());

    const handleSaveMarket = async () => {
        const y = parseInt(year);
        // Annual data is always mes 0
        const mes = 0;
        const dataToSave = editData[mes] || {};
        
        if (Object.keys(dataToSave).length === 0) {
            toast({ title: "Sin cambios", description: "No se detectaron cambios para guardar." });
            setEditMode(false);
            return;
        }

        const rows = [{ anio: y, mes, ...dataToSave }];
        
        const { error } = await (supabase.from("market_share_data" as any).upsert(rows, { onConflict: "anio, mes" }) as any);
        
        if (error) {
            console.error("Error saving market share:", error);
            toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "✅ Datos guardados", description: `Mercado para ${y} actualizado correctamente.` });
            await fetchAll();
            setEditMode(false);
            setEditData({});
        }
    };

    if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-lg gradient-emerald animate-pulse" /></div>;

    const hasMarketData = computed.totalMonoMkt > 0 || computed.totalAtiolMkt > 0;

    const pieDataMono = [
        { name: "Alcon (Privado)", value: computed.totalMonoAlcon, color: "hsl(45,90%,55%)" },
        { name: "Resto Mercado", value: Math.max(0, computed.totalMonoMkt - computed.totalMonoAlcon), color: "hsl(0,0%,25%)" },
    ];
    const pieDataAtiol = [
        { name: "Alcon (Privado)", value: computed.totalAtiolAlcon, color: "hsl(197,100%,44%)" },
        { name: "Resto Mercado", value: Math.max(0, computed.totalAtiolMkt - computed.totalAtiolAlcon), color: "hsl(0,0%,25%)" },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-6 shadow-xl ring-1 ring-white/5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground tracking-tight flex items-center gap-3">
                            <Target className="h-8 w-8 text-primary" /> Market Share
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Participación de mercado Alcon Surgical Paraguay — Monofocales & ATIOLs</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex flex-col items-end mr-2 text-right">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Período Activo</span>
                            <span className="text-xs font-black text-primary font-mono">{yoy.periodLabel}</span>
                        </div>
                        <select value={year} onChange={e => setYear(e.target.value)} className="h-10 px-4 rounded-lg border border-border bg-background text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        {isGerente && (
                            editMode ? (
                                <div className="flex gap-2">
                                    <button onClick={handleSaveMarket} className="h-10 px-6 rounded-lg gradient-emerald text-sm font-bold text-secondary-foreground shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95 transition-all">
                                        {loading ? "..." : "Guardar Cambios"}
                                    </button>
                                    <button onClick={() => { setEditMode(false); setEditData({}); }} className="h-10 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">Cancelar</button>
                                </div>
                            ) : (
                                <button onClick={() => setEditMode(true)} className="h-10 px-4 rounded-lg border border-primary/30 text-sm font-bold text-primary hover:bg-primary/10 transition-all flex items-center gap-2">
                                    <Target className="h-4 w-4" /> Registrar Mercado
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Data Entry Form */}
            {editMode && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 mb-6 space-y-6 animate-scale-in">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-primary">📊 Registrar Mercado Anual — {year}</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Ingrese los totales proyectados para el año completo.
                            </p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Target className="h-5 w-5 text-primary" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            { key: "total_cirurgias_pais", label: "Cirugías País (anual)", hint: "Cirugías totales estimadas" },
                            { key: "total_monofocals_mercado", label: "Lentes Monofocales Mercado", hint: "Unidades totales mercado" },
                            { key: "total_atiols_mercado", label: "ATIOLs Mercado", hint: "Unidades totales mercado" },
                            { key: "target_share_monofocal", label: "Meta Share Monofocal (%)", hint: "Ej: 45.5" },
                            { key: "target_share_atiol", label: "Meta Share ATIOL (%)", hint: "Ej: 22.0" },
                            { key: "fuente", label: "Fuente / Origen", hint: "Ej: SUCEV, IMS, Estimada", isText: true },
                        ].map((field) => {
                            const mes = 0;
                            const existing = marketRaw.find(r => r.mes === 0) || {};
                            return (
                                <div key={field.key} className="rounded-xl border border-border bg-card p-4 space-y-2 focus-within:border-primary/50 transition-all">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{field.label}</label>
                                    <p className="text-[10px] text-muted-foreground/60 leading-tight">{field.hint}</p>
                                    {field.isText ? (
                                        <input 
                                            type="text" 
                                            defaultValue={existing[field.key] || ""}
                                            onChange={e => setEditData(prev => ({ 
                                                ...prev, 
                                                [mes]: { ...(prev[mes] || existing), [field.key]: e.target.value } 
                                            }))}
                                            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    ) : (
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            defaultValue={existing[field.key] || 0}
                                            onChange={e => setEditData(prev => ({ 
                                                ...prev, 
                                                [mes]: { ...(prev[mes] || existing), [field.key]: parseFloat(e.target.value) || 0 } 
                                            }))}
                                            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Market Share Total" value={`${computed.overallShare.toFixed(1)}%`}
                    sub={computed.targetOverall > 0 ? `Meta: ${computed.targetOverall.toFixed(1)}% — Gap: ${(computed.overallShare - computed.targetOverall).toFixed(1)} pp` : "Sin meta"}
                    positive={computed.targetOverall > 0 ? computed.overallShare >= computed.targetOverall : undefined}
                    icon={<Award className="h-5 w-5" />} color="hsl(45,90%,55%)" />
                <KpiCard label="MS Monofocales" value={`${computed.monoShare.toFixed(1)}%`}
                    sub={computed.targetMono > 0 ? `Meta: ${computed.targetMono.toFixed(1)}% — Gap: ${(computed.monoShare - computed.targetMono).toFixed(1)} pp` : `${computed.totalMonoAlcon.toLocaleString()} unid.`}
                    positive={computed.targetMono > 0 ? computed.monoShare >= computed.targetMono : undefined}
                    icon={<Package className="h-5 w-5" />} color="hsl(160,60%,45%)" />
                <KpiCard label="MS ATIOLs" value={`${computed.atiolShare.toFixed(1)}%`}
                    sub={computed.targetAtiol > 0 ? `Meta: ${computed.targetAtiol.toFixed(1)}% — Gap: ${(computed.atiolShare - computed.targetAtiol).toFixed(1)} pp` : `${computed.totalAtiolAlcon.toLocaleString()} unid.`}
                    positive={computed.targetAtiol > 0 ? computed.atiolShare >= computed.targetAtiol : undefined}
                    icon={<TrendingUp className="h-5 w-5" />} color="hsl(197,100%,44%)" />
                <KpiCard label="Cirugías País" value={computed.totalCirurgiasPais > 0 ? computed.totalCirurgiasPais.toLocaleString() : "—"}
                    sub={`Alcon: ${(computed.totalMonoAlcon + computed.totalAtiolAlcon).toLocaleString()} lentes`}
                    icon={<Users className="h-5 w-5" />} color="hsl(280,60%,55%)" />
            </div>

            {/* ── YoY Growth Panel ──────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-bold">
                        Crecimiento {year} vs. {yoy.prevYear}
                        {yoy.periodLabel && <span className="text-muted-foreground font-normal"> — Período {yoy.periodLabel}</span>}
                    </h3>
                    {!yoy.hasPrevData && (
                        <span className="ml-auto text-xs text-muted-foreground italic">Sin datos del año anterior</span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mb-5">
                    Análisis comparativo {yoy.periodLabel}: {year} vs. {yoy.prevYear}.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        {
                            label: "Total Lentes Alcon",
                            cur: computed.totalAlconUnits,
                            prev: yoy.prevTotalAlcon,
                            growth: yoy.unitGrowth,
                            targetUnits: (yoy.targetMonoUnits != null && yoy.targetAtiolUnits != null)
                                ? yoy.targetMonoUnits + yoy.targetAtiolUnits : null,
                            targetPct: null as number | null,
                            color: "hsl(45,90%,55%)",
                        },
                        {
                            label: "MS Monofocales",
                            cur: computed.monoShare,
                            prev: yoy.prevMonoShare,
                            growth: yoy.monoMsGrowth,
                            isShare: true,
                            unitQty: { cur: computed.totalMonoAlcon, prev: yoy.prevMonoAlcon, qGrowth: yoy.monoUnitGrowth },
                            targetUnits: yoy.targetMonoUnits,
                            targetPct: yoy.targetMonoPct,
                            color: "hsl(160,60%,45%)",
                        },
                        {
                            label: "MS ATIOLs",
                            cur: computed.atiolShare,
                            prev: yoy.prevAtiolShare,
                            growth: yoy.atiolMsGrowth,
                            isShare: true,
                            unitQty: { cur: computed.totalAtiolAlcon, prev: yoy.prevAtiolAlcon, qGrowth: yoy.atiolUnitGrowth },
                            targetUnits: yoy.targetAtiolUnits,
                            targetPct: yoy.targetAtiolPct,
                            color: "hsl(197,100%,44%)",
                        },
                    ].map(({ label, cur, prev, growth, isShare, unitQty, targetUnits, targetPct, color }) => {
                        const hasData = yoy.hasPrevData && prev > 0;
                        const up = growth !== null && growth >= 0;
                        
                        return (
                            <div key={label} className="rounded-xl border border-border bg-background/40 p-5 space-y-4 transition-all duration-300 hover:shadow-xl hover:bg-card/50 hover:border-primary/10 group cursor-default">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
                                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                                </div>
                                
                                {/* Current value + YoY delta badge */}
                                <div className="flex items-end gap-2">
                                    <p className="text-3xl font-black font-display tracking-tighter" style={{ color }}>
                                        {isShare ? `${cur.toFixed(1)}%` : cur.toLocaleString()}
                                    </p>
                                    {hasData && growth !== null && (
                                        <span className={`mb-1.5 flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full transition-transform group-hover:scale-110 ${up ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                                            {up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                                            {up ? "+" : ""}{isShare ? `${growth.toFixed(1)} pp` : `${growth.toFixed(1)}%`}
                                        </span>
                                    )}
                                </div>

                                {/* Comparison table */}
                                <div className="text-[11px] text-muted-foreground space-y-2 border-t border-border pt-3">
                                    {/* Same period prev year */}
                                    {hasData && (
                                        <div className="flex justify-between items-center group/row">
                                            <span className="text-muted-foreground/80 group-hover/row:text-foreground transition-colors">{yoy.prevYear} ({yoy.periodLabel})</span>
                                            <span className="font-bold text-foreground font-mono">
                                                {isShare ? `${prev.toFixed(1)}%` : prev.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    {/* Period target (Only if sane) */}
                                    {targetPct != null && targetPct > 0 && targetPct <= 100 && (
                                        <div className="flex justify-between items-center text-primary group/row">
                                            <span className="font-bold opacity-80 group-hover/row:opacity-100 transition-opacity">Meta ({yoy.periodLabel})</span>
                                            <span className="font-black font-mono">
                                                {targetPct.toFixed(1)}%
                                            </span>
                                        </div>
                                    )}
                                    {/* Unit details for current period */}
                                    <div className="flex justify-between items-center border-t border-border/30 pt-2 mt-1 group/row">
                                        <span className="text-muted-foreground/60 text-[10px] group-hover/row:text-foreground/80 transition-colors uppercase font-bold tracking-tighter">Und {year} ({yoy.periodLabel})</span>
                                        <span className="font-bold text-foreground font-mono">
                                            {isShare && unitQty ? unitQty.cur.toLocaleString() : cur.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Pie Charts — Participation (Market Snapshot) */}
            {hasMarketData && (() => {
                const totalMkt = computed.totalMonoMkt + computed.totalAtiolMkt;
                const totalAlcon = computed.totalMonoAlcon + computed.totalAtiolAlcon;
                const totalShare = totalMkt > 0 ? totalAlcon / totalMkt * 100 : 0;
                const pieDataTotal = [
                    { name: "Alcon (Privado)", value: totalAlcon, color: "hsl(45,90%,55%)" },
                    { name: "Resto Mercado", value: Math.max(0, totalMkt - totalAlcon), color: "hsl(0,0%,25%)" },
                ];
                const cards = [
                    { title: "Share Monofocales", data: pieDataMono, share: computed.monoShare, target: computed.targetMono, alcon: computed.totalMonoAlcon, total: Math.round(computed.totalMonoMkt), color: "hsl(160,60%,45%)" },
                    { title: "Share ATIOLs", data: pieDataAtiol, share: computed.atiolShare, target: computed.targetAtiol, alcon: computed.totalAtiolAlcon, total: Math.round(computed.totalAtiolMkt), color: "hsl(197,100%,44%)" },
                    { title: "Snapshot: Share Total", data: pieDataTotal, share: totalShare, target: computed.targetOverall, alcon: totalAlcon, total: Math.round(totalMkt), color: "hsl(45,90%,55%)" },
                ];
                return (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <PieChart className="h-4 w-4 text-primary" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">Market Snapshot: Alcon vs Mercado</h3>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {cards.map(({ title, data, share, target, alcon, total, color }) => (
                                <div key={title} className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/20">
                                    <h3 className="text-[11px] font-black uppercase tracking-tight mb-4 flex justify-between items-center">
                                        {title}
                                        <span className="text-[9px] text-muted-foreground font-mono">{yoy.periodLabel}</span>
                                    </h3>
                                    <div className="flex items-center gap-6">
                                        <div className="w-36 h-36 shrink-0 relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" stroke="none">
                                                        {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(v: any) => v.toLocaleString()} contentStyle={ttStyle.contentStyle} itemStyle={ttStyle.itemStyle} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-lg font-black font-mono leading-none" style={{ color }}>{share.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-3 min-w-0">
                                            <div>
                                                <p className="text-2xl font-black font-display tracking-tighter" style={{ color }}>{share.toFixed(1)}%</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Share Actual</p>
                                            </div>
                                            {target > 0 && (
                                                <div className="space-y-1.5 pt-1">
                                                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                                                        <span className="uppercase">Meta YTD</span>
                                                        <span className="text-foreground">{target.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ width: `${Math.min(100, share / target * 100)}%`, background: color }} />
                                                    </div>
                                                    <p className={`text-[10px] font-black uppercase tracking-tighter ${share >= target ? "text-emerald-400" : "text-amber-500"}`}>
                                                        {share >= target ? "✓ Objetivo Cumplido" : `Falta ${(target - share).toFixed(1)} pp`}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground space-y-1 pt-3 border-t border-border mt-3 flex justify-between font-mono">
                                        <div><span className="opacity-60">ALC</span> <span className="font-bold text-foreground">{alcon.toLocaleString()}</span></div>
                                        <div><span className="opacity-60">MKT</span> <span className="font-bold text-foreground">{total.toLocaleString()}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Monthly Trend */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">Tendencia Mensual: Realizado vs Meta (Market Share %)</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={computed.monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,15%)" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(0,0%,50%)", fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `${v.toFixed(0)}%`} domain={[0, 'auto']} tick={{ fontSize: 10, fill: "hsl(0,0%,50%)" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} {...ttStyle} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }} />
                        <Line type="monotone" dataKey="monoShare" name="MS Mono (Real)" stroke="hsl(160,60%,45%)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "hsl(0,0%,7%)" }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="atiolShare" name="MS ATIOL (Real)" stroke="hsl(197,100%,44%)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "hsl(0,0%,7%)" }} activeDot={{ r: 6 }} />
                        {computed.monthly.some(m => m.targetMono > 0) && <Line type="stepAfter" dataKey="targetMono" name="Meta Mono" stroke="hsl(160,60%,45%)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} opacity={0.6} />}
                        {computed.monthly.some(m => m.targetAtiol > 0) && <Line type="stepAfter" dataKey="targetAtiol" name="Meta ATIOL" stroke="hsl(197,100%,44%)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} opacity={0.6} />}
                    </LineChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted-foreground italic text-center mt-4">Las líneas punteadas representan las metas mensuales ajustadas por estacionalidad.</p>
            </div>


            {!hasMarketData && !editMode && (
                <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-bold text-muted-foreground">Sin datos de mercado para {year}</h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">Haga clic en <strong>Ingresar Datos de Mercado</strong> para registrar el total de cirugías y lentes del mercado nacional y calcular el market share.</p>
                </div>
            )}
        </div>
    );
}
