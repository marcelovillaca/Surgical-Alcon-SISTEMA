import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { es } from "date-fns/locale";
import {
  TrendingUp, MapPin, Target, Users, CheckCircle2,
  Clock, AlertTriangle, BarChart3, Briefcase, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat("es-PY", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const pct = (num: number, den: number) =>
  den === 0 ? 0 : Math.round((num / den) * 100);

function StatCard({
  label, value, sub, color = "text-primary", icon: Icon,
}: {
  label: string; value: string | number; sub?: string;
  color?: string; icon: typeof TrendingUp;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 ring-1 ring-white/5 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", color.replace("text-", "bg-") + "/10")}>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
      </div>
      <div>
        <p className={cn("text-2xl font-display font-bold", color)}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pctVal = pct(value, max);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">Progreso</span>
        <span className={cn("font-bold", pctVal >= 80 ? "text-emerald-400" : pctVal >= 50 ? "text-amber-400" : "text-rose-400")}>
          {pctVal}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(pctVal, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function VisitadorDashboard() {
  const { user } = useAuth();
  const { role } = useUserRole();

  const now           = new Date();
  const monthStart    = startOfMonth(now);
  const monthEnd      = endOfMonth(now);
  const quarterStart  = startOfQuarter(now);
  const quarterEnd    = endOfQuarter(now);

  const monthStr    = format(now, "MMMM yyyy", { locale: es });
  const quarterName = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;

  // ─── State ──────────────────────────────────────────────────────────────────
  const [salesMonth,    setSalesMonth]    = useState(0);
  const [targetMonth,   setTargetMonth]   = useState(0);
  const [targetQuarter, setTargetQuarter] = useState(0);
  const [visits,        setVisits]        = useState<any[]>([]);
  const [clients,       setClients]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);

  const userName = user?.user_metadata?.full_name || user?.email || "";

  // ─── Fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userName) return;
    fetchAll();
  }, [userName]);

  const fetchAll = async () => {
    setLoading(true);

    // 1. Sales this month — only factured value (no cost, no margin)
    const { data: salesData } = await supabase
      .from("sales_details")
      .select("total, fecha, linea_de_producto")
      .ilike("vendedor", `%${userName.split(" ")[0]}%`)
      .gte("fecha", format(monthStart, "yyyy-MM-dd"))
      .lte("fecha", format(monthEnd, "yyyy-MM-dd"));
    const monthTotal = (salesData || []).reduce((s, r) => s + (r.total || 0), 0);
    setSalesMonth(monthTotal);

    // 2. Targets — current month + quarter (NO full year exposed)
    const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const currentMonth = monthNames[now.getMonth()];
    const quarterMonths = monthNames.slice(Math.floor(now.getMonth() / 3) * 3, Math.floor(now.getMonth() / 3) * 3 + 3);

    const { data: targetsData } = await supabase
      .from("sales_targets")
      .select("*")
      .ilike("visitador", `%${userName.split(" ")[0]}%`)
      .eq("anio", now.getFullYear());

    const targets = targetsData || [];
    const mTarget = targets.reduce((s, r) => s + (r[currentMonth] || 0), 0);
    const qTarget = targets.reduce((s, r) =>
      s + quarterMonths.reduce((qs, m) => qs + (r[m] || 0), 0), 0);

    setTargetMonth(mTarget);
    setTargetQuarter(qTarget);

    // 3. Visits this month
    const { data: visitsData } = await supabase
      .from("visits")
      .select("id, visit_date, visit_type, check_in_at, check_out_at, approved, client_id, justification")
      .eq("created_by", user!.id)
      .gte("visit_date", format(monthStart, "yyyy-MM-dd"))
      .lte("visit_date", format(monthEnd, "yyyy-MM-dd"));
    setVisits(visitsData || []);

    // 4. Clients assigned to this user
    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name, segment, city")
      .eq("assigned_to", user!.id);
    setClients(clientsData || []);

    setLoading(false);
  };

  // ─── Computed ────────────────────────────────────────────────────────────────
  const visitStats = useMemo(() => {
    const total     = visits.length;
    const completed = visits.filter(v => v.check_out_at).length;
    const pending   = visits.filter(v => !v.approved && !v.check_out_at).length;
    const today     = format(new Date(), "yyyy-MM-dd");
    const delayed   = visits.filter(v =>
      v.visit_date < today && !v.check_in_at && !v.justification
    ).length;
    return { total, completed, pending, delayed };
  }, [visits]);

  const visitCoverage = pct(
    [...new Set(visits.filter(v => v.check_out_at).map(v => v.client_id))].length,
    clients.length
  );

  const completionRate = pct(visitStats.completed, visitStats.total);

  const segmentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    clients.forEach(c => {
      map[c.segment || "outro"] = (map[c.segment || "outro"] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [clients]);

  const visitTypeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    visits.forEach(v => {
      map[v.visit_type || "otro"] = (map[v.visit_type || "otro"] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [visits]);

  const typeLabels: Record<string, string> = {
    promocion_producto:      "Promoción",
    soporte_tecnico_clinico: "Soporte Técnico",
    entrenamiento_capacitacion: "Capacitación",
    gestion_relacion:        "Gestión de Cuenta",
    seguimiento_oportunidades: "Seguimiento",
    postventa_incidencias:   "Postventa",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-lg bg-primary/20 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Mi Dashboard · {monthStr}
          </p>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            Hola, {userName.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aquí están tus métricas del mes — solo lo que necesitas saber.
          </p>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Facturado este mes"
          value={fmt(salesMonth)}
          sub={`Target: ${fmt(targetMonth)}`}
          color="text-emerald-400"
          icon={TrendingUp}
        />
        <StatCard
          label={`Target ${quarterName}`}
          value={fmt(targetQuarter)}
          sub="Máximo visible — no acumulado"
          color="text-amber-400"
          icon={Target}
        />
        <StatCard
          label="Visitas realizadas"
          value={`${visitStats.completed} / ${visitStats.total}`}
          sub={`${completionRate}% de ejecución`}
          color="text-blue-400"
          icon={MapPin}
        />
        <StatCard
          label="Cobertura de base"
          value={`${visitCoverage}%`}
          sub={`${clients.length} clientes asignados`}
          color="text-purple-400"
          icon={Users}
        />
      </div>

      {/* Target do mês — barra de progresso */}
      <div className="rounded-2xl border border-border/50 bg-card/60 ring-1 ring-white/5 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Avance vs. Target del Mes</p>
            <p className="text-lg font-display font-bold text-foreground mt-0.5">
              {fmt(salesMonth)} <span className="text-sm text-muted-foreground font-normal">de {fmt(targetMonth)}</span>
            </p>
          </div>
          <div className={cn(
            "px-3 py-1.5 rounded-xl text-xs font-bold border",
            pct(salesMonth, targetMonth) >= 80 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            pct(salesMonth, targetMonth) >= 50 ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
            "bg-rose-500/10 text-rose-400 border-rose-500/20"
          )}>
            {pct(salesMonth, targetMonth) >= 80 ? "✅ En camino" :
             pct(salesMonth, targetMonth) >= 50 ? "⚠️ Atención" : "🔴 Rezagado"}
          </div>
        </div>
        <ProgressBar value={salesMonth} max={targetMonth} color={
          pct(salesMonth, targetMonth) >= 80 ? "bg-emerald-500" :
          pct(salesMonth, targetMonth) >= 50 ? "bg-amber-500" : "bg-rose-500"
        } />
        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] text-muted-foreground">
            <span className="font-bold text-amber-400">Target {quarterName}:</span> {fmt(targetQuarter)} — solo visible el trimestre actual
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Visitas — estado */}
        <div className="rounded-2xl border border-border/50 bg-card/60 ring-1 ring-white/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado de Visitas — {monthStr}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Completadas",  value: visitStats.completed, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
              { label: "Pendientes",   value: visitStats.pending,   color: "text-amber-400 bg-amber-500/10 border-amber-500/20",       icon: Clock },
              { label: "Atrasadas",    value: visitStats.delayed,   color: "text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse", icon: AlertTriangle },
              { label: "Total prog.",  value: visitStats.total,     color: "text-blue-400 bg-blue-500/10 border-blue-500/20",          icon: MapPin },
            ].map(s => (
              <div key={s.label} className={cn("rounded-xl border p-3 flex items-center gap-3", s.color)}>
                <s.icon className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xl font-display font-bold">{s.value}</p>
                  <p className="text-[10px] opacity-70">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
          <ProgressBar value={visitStats.completed} max={visitStats.total} color="bg-blue-500" />
        </div>

        {/* Clientes por segmento */}
        <div className="rounded-2xl border border-border/50 bg-card/60 ring-1 ring-white/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-purple-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mi Base — Por Segmento</p>
          </div>
          {segmentCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin clientes asignados</p>
          ) : (
            <div className="space-y-2.5">
              {segmentCounts.map(([seg, count]) => (
                <div key={seg} className="flex items-center gap-3">
                  <div className="w-28 truncate">
                    <span className="text-xs text-muted-foreground capitalize">{seg}</span>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500/60"
                      style={{ width: `${pct(count, clients.length)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tipo de visitas */}
        <div className="rounded-2xl border border-border/50 bg-card/60 ring-1 ring-white/5 p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Distribución por Tipo de Visita — {monthStr}</p>
          </div>
          {visitTypeBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin visitas registradas este mes</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visitTypeBreakdown.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Briefcase className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">{count}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{typeLabels[type] || type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Aviso de privacidade */}
      <p className="text-[10px] text-muted-foreground/40 text-center">
        Esta vista muestra únicamente datos de facturación (valor total), sin márgenes ni costos. Consulta a tu gerente para métricas financieras.
      </p>
    </div>
  );
}
