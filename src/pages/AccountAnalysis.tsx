import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/formatters";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Search, Users, Package, TrendingUp, DollarSign, ShoppingCart, ArrowUpRight } from "lucide-react";

const COLORS = ["hsl(45,90%,55%)", "hsl(197,100%,44%)", "hsl(280,60%,55%)", "hsl(20,80%,55%)", "hsl(160,60%,45%)", "hsl(340,70%,55%)", "hsl(60,80%,50%)"];
const ttStyle = { contentStyle: { backgroundColor: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,20%)", borderRadius: "8px" }, itemStyle: { color: "hsl(0,0%,90%)" } };
const M_ABBR: Record<number, string> = { 1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun", 7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic" };

interface SalesRow { fecha: string; cliente: string; cod_cliente: string; ciudad: string; linea_de_producto: string; codigo_producto: string; producto: string; costo: number; total: number; monto_usd: number; vendedor: string; mercado?: string; }

/** Show client name if available and non-numeric; fall back to cod_cliente code */
function clienteDisplay(row: SalesRow): string {
    const name = (row.cliente || '').trim();
    if (name && !/^\d+$/.test(name)) return name;
    return (row.cod_cliente || '').trim() || name || 'Sin nombre';
}

function KpiChip({ label, value, sub, color = "hsl(45,90%,55%)", icon }: { label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            {icon && <div className="mt-0.5 p-2 rounded-lg" style={{ background: `${color}22` }}><span style={{ color }}>{icon}</span></div>}
            <div>
                <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wide">{label}</p>
                <p className="text-xl font-black font-display mt-0.5" style={{ color }}>{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

export default function AccountAnalysis() {
    const [salesRaw, setSalesRaw] = useState<SalesRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [viewMode, setViewMode] = useState<"cliente" | "producto">("cliente");
    const [searchTerm, setSearchTerm] = useState("");
    const [selected, setSelected] = useState<string | null>(null);
    const [includePublic, setIncludePublic] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            let all: SalesRow[] = []; let from = 0;
            while (true) {
                const { data } = await supabase.from("sales_details")
                    .select("fecha,cliente,cod_cliente,ciudad,linea_de_producto,codigo_producto,producto,costo,total,monto_usd,vendedor,mercado")
                    .range(from, from + 999);
                if (!data || data.length === 0) break;
                all = all.concat(data as unknown as SalesRow[]);
                if (data.length < 1000) break;
                from += 1000;
            }
            setSalesRaw(all); setLoading(false);
        };
        fetch();
    }, []);

    const filtered = useMemo(() => {
        const y = parseInt(year);
        return salesRaw.filter(s => {
            const d = new Date(s.fecha);
            if (d.getFullYear() !== y) return false;
            if (!includePublic) {
                const m = (s.mercado || "").toLowerCase();
                if (m.includes("público") || m.includes("publico")) return false;
            }
            return true;
        });
    }, [salesRaw, year, includePublic]);

    // Build list of unique entities
    const entityList = useMemo(() => {
        const map = new Map<string, { revenue: number; units: number; count: number }>();
        filtered.forEach(s => {
            const key = viewMode === "cliente" ? clienteDisplay(s) : s.producto;
            if (!key?.trim()) return;
            const cur = map.get(key) || { revenue: 0, units: 0, count: 0 };
            cur.revenue += Number(s.monto_usd);
            cur.units += Number(s.total);
            cur.count++;
            map.set(key, cur);
        });
        return Array.from(map.entries())
            .map(([name, v]) => ({ name, ...v, avgPrice: v.units > 0 ? v.revenue / v.units : 0 }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [filtered, viewMode]);

    const filteredList = useMemo(() =>
        entityList.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [entityList, searchTerm]);

    const detail = useMemo(() => {
        if (!selected) return null;
        const rows = filtered.filter(s =>
            (viewMode === "cliente" ? clienteDisplay(s) : s.producto) === selected);

        const totalRevenue = rows.reduce((a, s) => a + Number(s.monto_usd), 0);
        const totalUnits = rows.reduce((a, s) => a + Number(s.total), 0);
        const avgPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;
        const uniqueCount = viewMode === "cliente"
            ? new Set(rows.map(s => s.producto)).size
            : new Set(rows.map(s => clienteDisplay(s))).size;

        // Top products/clients
        const breakdown = new Map<string, { revenue: number; units: number }>();
        rows.forEach(s => {
            const key = viewMode === "cliente" ? s.producto : clienteDisplay(s);
            if (!key?.trim()) return;
            const cur = breakdown.get(key) || { revenue: 0, units: 0 };
            cur.revenue += Number(s.monto_usd);
            cur.units += Number(s.total);
            breakdown.set(key, cur);
        });
        const topBreakdown = Array.from(breakdown.entries())
            .map(([name, v]) => ({ name, ...v, avgPrice: v.units > 0 ? v.revenue / v.units : 0 }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        // Monthly trend
        const monthlyMap = new Map<number, { revenue: number; units: number }>();
        rows.forEach(s => {
            const m = new Date(s.fecha).getMonth() + 1;
            const cur = monthlyMap.get(m) || { revenue: 0, units: 0 };
            cur.revenue += Number(s.monto_usd);
            cur.units += Number(s.total);
            monthlyMap.set(m, cur);
        });
        const monthly = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            return { mes: M_ABBR[m], ...(monthlyMap.get(m) || { revenue: 0, units: 0 }) };
        });

        // Product line mix
        const lineMap = new Map<string, number>();
        rows.forEach(s => {
            const l = s.linea_de_producto || "Otros";
            lineMap.set(l, (lineMap.get(l) || 0) + Number(s.monto_usd));
        });
        const lineMix = Array.from(lineMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { totalRevenue, totalUnits, avgPrice, uniqueCount, topBreakdown, monthly, lineMix };
    }, [filtered, selected, viewMode]);

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 4 }, (_, i) => (currentYear - 1 + i).toString());
    const maxRevenue = entityList[0]?.revenue || 1;

    if (loading) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-lg gradient-emerald animate-pulse" /></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-6 shadow-xl ring-1 ring-white/5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
                            Análisis de Cuenta
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Drill-down por cliente y producto — precios, volumen y composición de la cuenta</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* View toggle */}
                        <div className="flex rounded-lg border border-border overflow-hidden">
                            <button onClick={() => { setViewMode("cliente"); setSelected(null); setSearchTerm(""); }}
                                className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${viewMode === "cliente" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                                <Users className="h-4 w-4" /> Clientes
                            </button>
                            <button onClick={() => { setViewMode("producto"); setSelected(null); setSearchTerm(""); }}
                                className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition-colors ${viewMode === "producto" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                                <Package className="h-4 w-4" /> Productos
                            </button>
                        </div>
                        <select value={year} onChange={e => { setYear(e.target.value); setSelected(null); }}
                            className="h-10 px-4 rounded-lg border border-border bg-background text-sm">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                            <div onClick={() => setIncludePublic(!includePublic)}
                                className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${includePublic ? "bg-primary" : "bg-muted"}`}>
                                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${includePublic ? "translate-x-4" : ""}`} />
                            </div>
                            Incluir Público
                        </label>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left — search + list */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            placeholder={`Buscar ${viewMode}...`}
                            className="w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="p-3 border-b border-border bg-muted/20 flex justify-between items-center">
                            <span className="text-xs font-semibold text-muted-foreground uppercase">{viewMode === "cliente" ? "Clientes" : "Productos"} ({filteredList.length})</span>
                            <span className="text-xs text-muted-foreground">Revenue Total</span>
                        </div>
                        <div className="overflow-y-auto max-h-[600px]">
                            {filteredList.map((e, i) => (
                                <button key={e.name} onClick={() => setSelected(e.name)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left border-b border-border/50 last:border-0 ${selected === e.name ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}>
                                    <span className="text-xs font-bold text-muted-foreground w-6 shrink-0">#{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{e.name}</p>
                                        <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${e.revenue / maxRevenue * 100}%`, background: COLORS[i % COLORS.length] }} />
                                        </div>
                                    </div>
                                    <span className="text-xs font-semibold text-foreground shrink-0">{formatUSD(e.revenue)}</span>
                                </button>
                            ))}
                            {filteredList.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sin resultados</p>}
                        </div>
                    </div>
                </div>

                {/* Right — detail */}
                <div className="lg:col-span-2 space-y-4">
                    {!selected ? (
                        <div className="rounded-2xl border-2 border-dashed border-border h-[400px] flex items-center justify-center">
                            <div className="text-center">
                                {viewMode === "cliente" ? <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" /> : <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />}
                                <p className="text-sm text-muted-foreground">Seleccione un {viewMode} para ver el análisis detallado</p>
                            </div>
                        </div>
                    ) : detail && (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <KpiChip label="Revenue Total" value={formatUSD(detail.totalRevenue)} icon={<DollarSign className="h-4 w-4" />} color="hsl(45,90%,55%)" />
                                <KpiChip label="Unidades" value={detail.totalUnits.toLocaleString()} icon={<ShoppingCart className="h-4 w-4" />} color="hsl(197,100%,44%)" />
                                <KpiChip label="Precio Medio" value={formatUSD(detail.avgPrice)} sub="por unidad" icon={<TrendingUp className="h-4 w-4" />} color="hsl(160,60%,45%)" />
                                <KpiChip label={viewMode === "cliente" ? "Productos" : "Clientes"} value={detail.uniqueCount.toString()} sub={viewMode === "cliente" ? "distintos" : "distintos"} icon={<ArrowUpRight className="h-4 w-4" />} color="hsl(280,60%,55%)" />
                            </div>

                            {/* Revenue trend */}
                            <div className="rounded-xl border border-border bg-card p-4">
                                <h3 className="text-sm font-bold mb-3">📈 Revenue Mensual — {selected}</h3>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={detail.monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,15%)" />
                                        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(0,0%,60%)" }} />
                                        <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "hsl(0,0%,60%)" }} />
                                        <Tooltip formatter={(v: any) => formatUSD(Number(v))} {...ttStyle} />
                                        <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} fill="hsl(45,90%,55%)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Top breakdown */}
                            <div className="rounded-xl border border-border bg-card overflow-hidden">
                                <div className="p-4 border-b border-border bg-muted/20">
                                    <h3 className="text-sm font-bold">Top {viewMode === "cliente" ? "Productos" : "Clientes"} — {selected}</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border text-xs text-muted-foreground">
                                                <th className="p-3 text-left font-medium">{viewMode === "cliente" ? "Producto" : "Cliente"}</th>
                                                <th className="p-3 text-right font-medium">Revenue</th>
                                                <th className="p-3 text-right font-medium">Unidades</th>
                                                <th className="p-3 text-right font-medium">Precio Medio</th>
                                                <th className="p-3 text-right font-medium">% del Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {detail.topBreakdown.map((item, i) => (
                                                <tr key={item.name} className="hover:bg-muted/30 transition-colors">
                                                    <td className="p-3 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                                                            <span className="truncate max-w-[200px]">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right font-semibold text-emerald-400">{formatUSD(item.revenue)}</td>
                                                    <td className="p-3 text-right text-muted-foreground">{item.units.toLocaleString()}</td>
                                                    <td className="p-3 text-right text-muted-foreground">{formatUSD(item.avgPrice)}</td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full" style={{ width: `${item.revenue / detail.totalRevenue * 100}%`, background: COLORS[i % COLORS.length] }} />
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">{(item.revenue / detail.totalRevenue * 100).toFixed(1)}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Line Mix */}
                            {viewMode === "cliente" && detail.lineMix.length > 0 && (
                                <div className="rounded-xl border border-border bg-card p-4">
                                    <h3 className="text-sm font-bold mb-3">Mix de Líneas de Producto</h3>
                                    <div className="space-y-2">
                                        {detail.lineMix.map((l, i) => (
                                            <div key={l.name} className="flex items-center gap-3">
                                                <span className="text-xs text-muted-foreground w-32 truncate shrink-0">{l.name}</span>
                                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all" style={{ width: `${l.value / detail.totalRevenue * 100}%`, background: COLORS[i % COLORS.length] }} />
                                                </div>
                                                <span className="text-xs font-medium w-20 text-right shrink-0">{formatUSD(l.value)}</span>
                                                <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{(l.value / detail.totalRevenue * 100).toFixed(0)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
