import { useState, useEffect, useMemo } from "react";
import KpiCard from "@/components/dashboard/KpiCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, FunnelChart, Funnel, LabelList } from "recharts";
import { formatUSD, formatPct } from "@/lib/formatters";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import { useConoftaData } from "@/hooks/useConoftaData";
import { useWaitlist, WaitlistStatus } from "@/hooks/useWaitlist";
import { differenceInDays } from "date-fns";
import {
    DollarSign,
    TrendingUp,
    Activity,
    ClipboardList,
    MapPin,
    Calendar,
    Wrench,
    Zap,
    BarChart3,
    AlertTriangle,
    CheckCircle2,
    Users,
    ArrowRight,
    Clock,
    Stethoscope,
    Target,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Days-in-status helper (same logic as ConoftaLista) ─────────────────────
function getDaysInStatus(entry: any): number {
    const now = new Date();
    let ref: string | undefined;
    switch (entry.status) {
        case "pendente":  ref = entry.created_at; break;
        case "informado": ref = entry.informed_at  || entry.created_at; break;
        case "apto":      ref = entry.apto_at      || entry.created_at; break;
        case "agendado":  ref = entry.scheduled_at || entry.created_at; break;
        case "operado":   ref = entry.operated_at  || entry.created_at; break;
        default:          ref = entry.created_at;
    }
    if (!ref) return 0;
    return Math.max(0, differenceInDays(now, new Date(ref)));
}

const tooltipStyle = {
    contentStyle: { backgroundColor: "hsl(0, 0%, 10%)", border: "1px solid hsl(0, 0%, 20%)", borderRadius: "8px" },
    itemStyle: { color: "hsl(0, 0% 90%)" }
};

export default function Conofta() {
    const { role, isGerente: isGerenteUser, institutionName } = useUserRole();
    const navigate = useNavigate();
    const isAdmin = isGerenteUser || role === "admin_conofta";
    const isCoordinador = role === "coordinador_local";
    
    // Financial access is RESTRICTED to Gerente only, as per request
    const hasFinancialAccess = isGerenteUser;

    const [filters, setFilters] = useState({
        year: new Date().getFullYear().toString(),
        months: ["Todos"],
        sucursal: "Todas",
        medico: "Todos"
    });

    // Coordinador local cannot see the dashboard for now
    useEffect(() => {
        if (isCoordinador) {
            navigate("/conofta/waitlist");
        }
    }, [isCoordinador, navigate]);

    // Handle initial filter for Coordinator
    useEffect(() => {
        if (isCoordinador && institutionName) {
            setFilters(prev => ({ ...prev, sucursal: institutionName }));
        }
    }, [isCoordinador, institutionName]);

    const { data, loading } = useConoftaData(filters);

    if (loading) {
        return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 rounded-lg gradient-emerald animate-pulse" /></div>;
    }

    const hasSurgeries = data.kpis.surgeries > 0;
    const roi = data.equipmentRoi;
    const roiPct = roi.surgeriesForPayback > 0 ? Math.min(100, (roi.surgeriesDone / roi.surgeriesForPayback) * 100) : 0;

    return (
        <div className="space-y-4 animate-fade-in">
      {/* Intelligent Header */}
      <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-xl p-4 sm:p-8 shadow-2xl ring-1 ring-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                     <Zap className="h-40 w-40 text-primary" />
                </div>
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                             <h1 className="text-4xl font-display font-bold text-foreground tracking-tighter">
                                Inteligencia <span className="text-primary italic">CONOFTA</span>
                             </h1>
                             <Badge className="bg-primary/20 text-primary border-primary/20">PREMIUM ANALYTICS</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4 text-emerald-500" />
                            Monitoreo operativo de Jornadas Quirúrgicas y KPIs de Gestión
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 bg-background/40 p-2 rounded-2xl border border-border/50 backdrop-blur-md">
                        <DashboardFilters
                            isGerente={isGerenteUser ?? false}
                            onFiltersChange={(f) => setFilters(prev => ({ ...prev, ...f }))}
                            hideVendedor hideLines hideTitle
                        />
                        <div className="flex items-center gap-3">
                            <div className="relative group">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                <select
                                    disabled={isCoordinador} // Local coordinators are locked to their branch
                                    value={filters.sucursal}
                                    onChange={e => setFilters(prev => ({ ...prev, sucursal: e.target.value }))}
                                    className="h-10 pl-10 pr-8 rounded-xl border border-border bg-background/50 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all min-w-[200px] appearance-none cursor-pointer"
                                >
                                    <option value="Todas">Todas Sucursales</option>
                                    {data.options.sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
      </div>

      <Tabs defaultValue="comando" className="w-full">
        <TabsList className="bg-muted/30 p-1 border border-border glass-surface h-auto flex-wrap gap-1 mb-4 w-full">
          <TabsTrigger value="comando" className="flex-1 min-w-[80px] px-2 sm:px-6 h-10 data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-bold text-xs sm:text-sm">
            <Target className="h-4 w-4 sm:mr-2 shrink-0" />
            <span className="hidden sm:inline">Centro de Comando</span>
          </TabsTrigger>
          <TabsTrigger value="kpis" className="flex-1 min-w-[80px] px-2 sm:px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 sm:mr-2 shrink-0" />
            <span className="hidden sm:inline">KPIs Operativos</span>
          </TabsTrigger>
          {hasFinancialAccess && (
            <TabsTrigger value="finance" className="flex-1 min-w-[80px] px-2 sm:px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs sm:text-sm">
              <DollarSign className="h-4 w-4 sm:mr-2 shrink-0" />
              <span className="hidden sm:inline">P&amp;L</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="results" className="flex-1 min-w-[80px] px-2 sm:px-6 h-10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs sm:text-sm">
            <Activity className="h-4 w-4 sm:mr-2 shrink-0" />
            <span className="hidden sm:inline">Resultados</span>
          </TabsTrigger>
        </TabsList>

                {/* ══ CENTRO DE COMANDO ══════════════════════════════════════ */}
                <CentroDeComando onNavigate={navigate} isGerenteUser={isGerenteUser || false} filters={filters} />

                <TabsContent value="kpis" className="space-y-8 mt-0">
                    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-6", isGerenteUser ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
                        <KpiCard 
                            title="Cirugías Realizadas" 
                            value={data.kpis.surgeries.toString()} 
                            change={isGerenteUser ? `${data.kpis.targetSurgeries} Meta` : undefined} 
                            changeType="neutral" 
                            icon={Activity} 
                            variant="gold" 
                        />
                        {isGerenteUser && (
                            <KpiCard 
                                title="Cumplimiento Global" 
                                value={formatPct(data.kpis.cumplimiento)} 
                                changeType={data.kpis.cumplimiento >= 100 ? "positive" : "neutral"} 
                                icon={ClipboardList} 
                                variant="default" 
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                        {data.summaryGauges.map((g) => (
                            <div key={g.name} className="bg-card/50 backdrop-blur-md border border-border/50 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden group hover:border-primary/50 transition-all shadow-xl shadow-black/20">
                                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] text-center mb-4">{g.name}</h3>
                                {isGerenteUser ? (
                                    <>
                                        <div className="h-28 w-full relative flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { value: Math.min(g.pct, 100) },
                                                            { value: 100 - Math.min(g.pct, 100) }
                                                        ]}
                                                        cx="50%" cy="100%"
                                                        innerRadius={40} outerRadius={55}
                                                        startAngle={180} endAngle={0}
                                                        paddingAngle={0} dataKey="value" stroke="none"
                                                    >
                                                        <Cell fill={g.pct >= 100 ? "hsl(var(--emerald))" : "hsl(var(--primary))"} />
                                                        <Cell fill="rgba(255,255,255,0.05)" />
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                                                <span className="text-2xl font-black">{Math.round(g.pct)}%</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 text-[11px] font-bold text-muted-foreground">
                                            {g.current} / {g.target} <Badge variant="outline" className="ml-1 text-[8px] h-4">JORNADA</Badge>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6">
                                        <span className="text-4xl font-black text-primary">{g.current}</span>
                                        <span className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tighter">Cirugías Realizadas</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </TabsContent>

        {hasFinancialAccess && (
          <TabsContent value="finance" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <KpiCard title="Ingresos Públicos" value={formatUSD(data.kpis.revenue)} changeType="positive" icon={DollarSign} variant="emerald" />
              <KpiCard title="Margen Neto" value={formatUSD(data.kpis.margin)} changeType={data.kpis.margin >= 0 ? "positive" : "negative"} icon={TrendingUp} variant={data.kpis.margin >= 0 ? "emerald" : "default"} />
              <KpiCard title="Margen Neto %" value={formatPct(data.kpis.grossMarginPct)} changeType={data.kpis.grossMarginPct >= 0 ? "positive" : "negative"} icon={BarChart3} variant={data.kpis.grossMarginPct >= 0 ? "emerald" : "default"} />
            </div>

            {/* Equipment ROI */}
            {roi.totalInvestment > 0 && (
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card/80 to-primary/5 p-4 sm:p-8 shadow-2xl glass-surface ring-1 ring-white/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xl shrink-0">
                    <Wrench className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-display font-bold text-foreground tracking-tight">Análisis ROI de Equipamientos</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">Cálculo dinámico de recuperación de inversión</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Inversión Total", val: formatUSD(roi.totalInvestment), sub: `${roi.items?.length || 0} Equipos`, color: "text-foreground" },
                    { label: "Margen / Cirugía", val: formatUSD(roi.avgNetPerSurgery), sub: "Promedio Real", color: "text-emerald-400" },
                    { label: "Cirugías Payback", val: roi.surgeriesForPayback.toLocaleString(), sub: `${roi.surgeriesDone} Realizadas`, color: "text-primary" },
                    { label: "Payback Estimado", val: `~${roi.monthsForPayback} m`, sub: "Meses de Retorno", color: "text-foreground" }
                  ].map((stat, i) => (
                    <div key={i} className="rounded-xl bg-background/40 border border-white/5 p-3 sm:p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                      <p className={cn("text-lg sm:text-2xl font-black", stat.color)}>{stat.val}</p>
                      <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">{stat.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-muted-foreground">Progreso de Amortización</span>
                    <span className="text-sm font-black text-primary">{roiPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-zinc-800 border border-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 gradient-gold shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                      style={{ width: `${roiPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Monthly P&L table */}
            <Card className="rounded-2xl border-border bg-card/20 shadow-2xl overflow-hidden glass-surface">
              <div className="p-4 sm:p-6 border-b border-white/5 bg-white/5 flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary shrink-0" />
                <h2 className="text-base sm:text-xl font-bold font-display uppercase tracking-tight">P&amp;L Consolidado Mensual</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-muted/30 border-b border-white/5">
                      <th className="p-3 sm:p-5 text-xs font-black text-muted-foreground uppercase tracking-widest">Métrica Financiera</th>
                      {data.monthly.map(m => <th key={m.mes} className="p-3 text-xs font-black text-muted-foreground uppercase text-center">{m.mes}</th>)}
                      <th className="p-3 sm:p-5 text-xs font-black text-primary uppercase text-center bg-primary/5">ANUAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    <tr className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
                      <td className="p-3 sm:p-5 font-bold text-emerald-400">Ingresos Proyectados</td>
                      {data.monthly.map(m => <td key={m.mes} className="p-3 text-center font-bold text-emerald-400/80">{formatUSD(m.revenue)}</td>)}
                      <td className="p-3 sm:p-5 text-center font-black text-emerald-400 bg-emerald-500/10">{formatUSD(data.kpis.revenue)}</td>
                    </tr>
                    {[
                      { label: "Costo Lentes", key: "costoLentes" },
                      { label: "Costo Insumos", key: "costoInsumos" },
                      { label: "Honorarios Médicos", key: "honorarios" },
                      { label: "RH Local", key: "rhLocal" },
                      { label: "RH Central", key: "rhCentral" },
                      { label: "Marketing", key: "marketing" },
                      { label: "Admin & Otros", key: "otros" },
                    ].map(row => (
                      <tr key={row.key} className="hover:bg-white/5 transition-all group">
                        <td className="p-3 sm:p-5 font-medium text-muted-foreground group-hover:text-foreground">{row.label}</td>
                        {data.monthly.map(m => <td key={m.mes} className="p-3 text-center text-zinc-500">{(m as any)[row.key] > 0 ? formatUSD((m as any)[row.key]) : "-"}</td>)}
                        <td className="p-3 sm:p-5 text-center font-bold bg-white/5">{(data.kpis as any)[row.key] > 0 ? formatUSD((data.kpis as any)[row.key]) : "-"}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/10 border-t-2 border-primary/20">
                      <td className="p-4 sm:p-6 font-black text-primary uppercase text-base sm:text-lg tracking-tighter">Margen Neto Real</td>
                      {data.monthly.map(m => (
                        <td key={m.mes} className={`p-3 text-center font-black ${m.margin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatUSD(m.margin)}
                        </td>
                      ))}
                      <td className={`p-4 sm:p-6 text-center font-black text-lg sm:text-xl ${data.kpis.margin >= 0 ? "text-emerald-400" : "text-rose-400"} bg-primary/20`}>
                        {formatUSD(data.kpis.margin)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        )}


                <TabsContent value="results" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <Card className="lg:col-span-1 border-border/50 bg-card/80 backdrop-blur-md">
                            <div className="p-6 space-y-8">
                                <div className="space-y-2">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Pacientes Operados</p>
                                    <p className="text-4xl font-display font-bold text-foreground">{data.kpis.surgeries}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Índice Mejora AV</p>
                                    <p className="text-3xl font-display font-bold text-emerald-500">+72%</p>
                                </div>
                            </div>
                        </Card>

                        <div className="lg:col-span-3">
                            <Card className="border-border border-dashed bg-card/10 p-24 text-center rounded-3xl">
                                <Activity className="h-12 w-12 text-zinc-700 mx-auto mb-6" />
                                <p className="text-lg font-bold text-foreground">Calidad y Resultados Clínicos</p>
                                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto italic">Visualización dinámica de resultados refractivos y satisfacción del paciente en desarrollo.</p>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {!hasSurgeries && (
                <div className="p-20 text-center border-2 border-dashed border-border rounded-3xl bg-muted/5 glass-surface">
                    <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-6 opacity-10 animate-pulse" />
                    <h3 className="text-2xl font-black text-muted-foreground tracking-tighter uppercase">Sin Datos Operativos</h3>
                    <p className="text-sm text-zinc-500 mt-4 max-w-md mx-auto leading-relaxed font-medium">
                        Debe cargar el Master Template de este año en la sección de Importación para activar la inteligencia de negocio.
                    </p>
                </div>
            )}
        </div>
    );
}


// ─── Centro de Comando Component ────────────────────────────────────────────
function CentroDeComando({ onNavigate, isGerenteUser, filters }: { onNavigate: (path: string) => void, isGerenteUser: boolean, filters: any }) {
    const { entries, loading } = useWaitlist(filters);

    const stats = useMemo(() => {
        const count = (s: string) => entries.filter(e => e.status === s).length;
        const active = entries.filter(e => !["concluido", "cancelado"].includes(e.status));

        const today = new Date();
        const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
        const thisSurgeries = entries.filter(e => {
            if (!e.surgery_date) return false;
            const d = new Date(e.surgery_date + "T12:00:00");
            return d >= today && d <= weekEnd;
        });

        const concluded = count("concluido");
        const total = entries.length;
        const convRate = total > 0 ? Math.round((concluded / total) * 100) : 0;
        const critical = active.filter(e => getDaysInStatus(e) > 14);

        return {
            pendente: count("pendente"), informado: count("informado"),
            apto: count("apto"), agendado: count("agendado"),
            operado: count("operado"), concluido: concluded,
            total, convRate, thisWeekSurgeries: thisSurgeries,
            critical, activeTotal: active.length,
        };
    }, [entries]);

    if (loading) {
        return (
            <TabsContent value="comando" className="mt-0">
                <div className="flex items-center justify-center h-48">
                    <div className="h-8 w-8 rounded-lg gradient-emerald animate-pulse" />
                </div>
            </TabsContent>
        );
    }

    const funnelSteps = [
        { label: "Ingresados",  count: stats.pendente,  color: "hsl(45,90%,55%)" },
        { label: "Pre-Op",      count: stats.informado, color: "hsl(280,60%,55%)" },
        { label: "Aptos",       count: stats.apto,      color: "hsl(160,60%,45%)" },
        { label: "Agendados",   count: stats.agendado,  color: "hsl(210,80%,60%)" },
        { label: "Operados",    count: stats.operado,   color: "hsl(240,60%,60%)" },
        { label: "Finalizados", count: stats.concluido, color: "hsl(160,60%,45%)" },
    ];

    return (
        <TabsContent value="comando" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-4">
            {/* Top KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                    { label: "Activos en Fila",     value: stats.activeTotal,          color: "text-primary",     hint: "No concluidos" },
                    { label: "Aptos p/ Agendar 🔴", value: stats.apto,                 color: "text-emerald-400", hint: "Acción urgente" },
                    { label: "Agendados",            value: stats.agendado,             color: "text-blue-400",    hint: "Con fecha asignada" },
                    { label: "Carga AV Pendiente",  value: stats.operado,              color: "text-indigo-400",  hint: "Post-op sin registrar" },
                    { label: "Críticos >14 días",   value: stats.critical.length,       color: stats.critical.length > 0 ? "text-rose-400" : "text-zinc-500", hint: "Sin movimento" },
                ].filter(Boolean).map((kpi) => (
                    <div key={kpi.label} className="rounded-2xl border border-border bg-card/60 p-4 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-tight">{kpi.label}</p>
                        <p className={cn("text-3xl font-black font-display", kpi.color)}>{kpi.value}</p>
                        <p className="text-[10px] text-muted-foreground">{kpi.hint}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Funnel visualization */}
                <div className="lg:col-span-2 rounded-2xl border border-border bg-card/60 p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <ArrowRight className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Embudo de Conversión de Pacientes</h3>
                            <p className="text-[11px] text-muted-foreground">Flujo quirúrgico completo</p>
                        </div>
                        {isGerenteUser && (
                            <div className="ml-auto">
                                <span className={cn("text-sm font-black", stats.convRate >= 70 ? "text-emerald-400" : "text-rose-400")}>
                                    {stats.convRate}% conversión
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        {funnelSteps.map((step, i) => {
                            const pct = funnelSteps[0].count > 0 ? (step.count / funnelSteps[0].count) * 100 : 0;
                            const dropPct = isGerenteUser && i > 0 && funnelSteps[i - 1].count > 0
                                ? Math.round(((funnelSteps[i - 1].count - step.count) / funnelSteps[i - 1].count) * 100)
                                : null;
                            return (
                                <div key={step.label} className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-muted-foreground w-24 shrink-0">{step.label}</span>
                                    <div className="flex-1 h-7 bg-zinc-800 rounded-lg overflow-hidden relative">
                                        <div
                                            className="h-full rounded-lg transition-all duration-700 flex items-center pl-3"
                                            style={{ width: `${Math.max(3, pct)}%`, background: step.color }}
                                        />
                                    </div>
                                    <span className="text-sm font-black w-8 text-right" style={{ color: step.color }}>{step.count}</span>
                                    {dropPct !== null && dropPct > 0 && (
                                        <span className="text-[10px] text-rose-400 font-bold w-14 text-right">-{dropPct}%</span>
                                    )}
                                    {(dropPct === null || dropPct === 0) && <span className="w-14" />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                    {/* This week surgeries */}
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="h-5 w-5 text-blue-400" />
                            <h3 className="text-sm font-bold text-blue-400">Cirugías esta semana</h3>
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs ml-auto">{stats.thisWeekSurgeries.length}</Badge>
                        </div>
                        {stats.thisWeekSurgeries.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic text-center py-3">Sin cirugías programadas</p>
                        ) : (
                            <div className="space-y-2 max-h-[140px] overflow-y-auto">
                                {stats.thisWeekSurgeries.map((e) => (
                                    <div key={e.id} className="flex items-center justify-between p-2 rounded-lg bg-background/40 border border-white/5">
                                        <div>
                                            <p className="text-xs font-bold truncate max-w-[120px]">{e.patient?.firstname} {e.patient?.lastname}</p>
                                            <p className="text-[10px] text-muted-foreground">Ojo {e.target_eye}</p>
                                        </div>
                                        <span className="text-[10px] font-bold text-blue-400 shrink-0">
                                            {e.surgery_date ? new Date(e.surgery_date + "T12:00:00").toLocaleDateString("es-PY", { weekday: "short", day: "2-digit", month: "short" }) : "—"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Critical alerts */}
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="h-5 w-5 text-rose-400" />
                            <h3 className="text-sm font-bold text-rose-400">Alertas Críticas</h3>
                            <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-xs ml-auto">{stats.critical.length}</Badge>
                        </div>
                        {stats.critical.length === 0 ? (
                            <div className="flex items-center gap-2 py-3 justify-center">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                <p className="text-xs text-emerald-400 font-bold">Sin alertas activas</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[140px] overflow-y-auto">
                                {stats.critical.slice(0, 8).map((e) => (
                                    <div key={e.id} className="flex items-center justify-between p-2 rounded-lg bg-background/40 border border-rose-500/10">
                                        <div>
                                            <p className="text-xs font-bold truncate max-w-[130px]">{e.patient?.firstname} {e.patient?.lastname}</p>
                                            <p className="text-[10px] text-muted-foreground capitalize">{e.status}</p>
                                        </div>
                                        <span className="text-[10px] font-black text-rose-400 flex items-center gap-1 shrink-0">
                                            <Clock className="h-3 w-3" /> {getDaysInStatus(e)}d
                                        </span>
                                    </div>
                                ))}
                                {stats.critical.length > 8 && (
                                    <p className="text-[10px] text-muted-foreground text-center italic">+{stats.critical.length - 8} más...</p>
                                )}
                            </div>
                        )}
                    </div>

                    <Button
                        className="w-full gradient-emerald shadow-lg rounded-xl h-11 font-bold text-sm"
                        onClick={() => onNavigate("/conofta/lista")}
                    >
                        <Users className="h-4 w-4 mr-2" /> Ir a Lista General
                    </Button>
                </div>
            </div>
        </TabsContent>
    );
}
