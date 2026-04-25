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
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-card/40 backdrop-blur-sm p-5 flex flex-col gap-3 transition-all hover:bg-card/60 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center justify-between relative z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{label}</p>
        <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", color.replace("text-", "bg-") + "/10")}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
      </div>
      <div className="relative z-10">
        <p className={cn("text-3xl font-display font-black tracking-tight", color)}>{value}</p>
        {sub && <p className="text-[10px] font-medium text-muted-foreground/60 mt-1 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-primary/40" /> {sub}
        </p>}
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
  const [submitting,    setSubmitting]    = useState(false);

  // ─── Checkout Form State ──────────────────────────────────────────────────
  const [showCheckout, setShowCheckout] = useState(false);
  const [activeVisitId, setActiveVisitId] = useState<string | null>(null);
  const [interest, setInterest] = useState<"Bajo" | "Medio" | "Alto">("Medio");
  const [nextAction, setNextAction] = useState("");
  const [resultNotes, setResultNotes] = useState("");

  const nextActionOptions = [
    "Programar Demo de Equipo",
    "Enviar Cotización",
    "Entregar Muestras",
    "Seguimiento Telefónico",
    "Cierre de Venta",
    "Resolución de Incidencia",
    "Capacitación de Staff"
  ];

  const userName = user?.user_metadata?.full_name || user?.email || "";

  // ─── Fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userName) return;
    fetchAll();
  }, [userName]);

  const fetchAll = async () => {
    setLoading(true);

    const todayStr = format(new Date(), "yyyy-MM-dd");

    const [sales, targets, monthlyVisits, allClients, todayVisits] = await Promise.all([
      // 1. Sales
      supabase.from("sales_details").select("total").ilike("vendedor", `%${userName.split(" ")[0]}%`).gte("fecha", format(monthStart, "yyyy-MM-dd")).lte("fecha", format(monthEnd, "yyyy-MM-dd")),
      // 2. Targets
      supabase.from("sales_targets").select("*").ilike("visitador", `%${userName.split(" ")[0]}%`).eq("anio", now.getFullYear()),
      // 3. Visits this month
      supabase.from("visits").select("id, visit_date, visit_type, check_in_at, check_out_at, approved, client_id, justification").eq("created_by", user!.id).gte("visit_date", format(monthStart, "yyyy-MM-dd")).lte("visit_date", format(monthEnd, "yyyy-MM-dd")),
      // 4. Clients
      supabase.from("clients").select("id, name, segment, city").eq("assigned_to", user!.id),
      // 5. Today's visits with client details
      supabase.from("visits").select("*, client:clients(id, name, city)").eq("created_by", user!.id).eq("visit_date", todayStr).order("scheduled_time", { ascending: true })
    ]);

    setSalesMonth((sales.data || []).reduce((s, r) => s + (r.total || 0), 0));

    const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const currentMonth = monthNames[now.getMonth()];
    const quarterMonths = monthNames.slice(Math.floor(now.getMonth() / 3) * 3, Math.floor(now.getMonth() / 3) * 3 + 3);
    const targetsArr = targets.data || [];
    setTargetMonth(targetsArr.reduce((s, r) => s + (r[currentMonth] || 0), 0));
    setTargetQuarter(targetsArr.reduce((s, r) => s + quarterMonths.reduce((qs, m) => qs + (r[m] || 0), 0), 0));

    setVisits(monthlyVisits.data || []);
    setClients(allClients.data || []);
    setTodayAgenda(todayVisits.data || []);

    setLoading(false);
  };

  const [todayAgenda, setTodayAgenda] = useState<any[]>([]);

  // ─── Check-in / Check-out Logic ──────────────────────────────────────────────
  const handleCheckIn = async (visitId: string) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await supabase.from("visits").update({ 
        check_in_at: new Date().toISOString(), 
        check_in_lat: pos.coords.latitude, 
        check_in_lon: pos.coords.longitude 
      }).eq("id", visitId);
      fetchAll();
    });
  };

  const handleCheckOut = async (visitId: string) => {
    setActiveVisitId(visitId);
    setShowCheckout(true);
  };

  const confirmCheckOut = async () => {
    if (!activeVisitId || !navigator.geolocation) return;
    setSubmitting(true);
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const visit = todayAgenda.find(v => v.id === activeVisitId);
        const report = `[INTERÉS: ${interest.toUpperCase()}]\n[PRÓXIMA ACCIÓN: ${nextAction}]\n\nRESULTADO: ${resultNotes}`;
        
        const { error } = await supabase.from("visits").update({ 
          check_out_at: new Date().toISOString(), 
          check_out_lat: pos.coords.latitude, 
          check_out_lon: pos.coords.longitude,
          observations: (visit?.observations ? visit.observations + "\n\n" : "") + report
        }).eq("id", activeVisitId);

        if (error) throw error;
        
        setShowCheckout(false);
        setActiveVisitId(null);
        setResultNotes("");
        setNextAction("");
        fetchAll();
      } catch (err) {
        console.error(err);
      } finally {
        setSubmitting(false);
      }
    });
  };

  // ─── Computed ────────────────────────────────────────────────────────────────
  const visitStats = useMemo(() => {
    const total     = visits.length;
    const completed = visits.filter(v => v.check_out_at).length;
    const pending   = visits.filter(v => !v.approved && !v.check_out_at).length;
    const today     = format(new Date(), "yyyy-MM-dd");
    const delayed   = visits.filter(v => v.visit_date < today && !v.check_in_at && !v.justification).length;
    return { total, completed, pending, delayed };
  }, [visits]);

  const visitCoverage = pct([...new Set(visits.filter(v => v.check_out_at).map(v => v.client_id))].length, clients.length);
  const completionRate = pct(visitStats.completed, visitStats.total);

  const segmentCounts = useMemo(() => {
    const map: Record<string, number> = {};
    clients.forEach(c => { map[c.segment || "outro"] = (map[c.segment || "outro"] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [clients]);

  const visitTypeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    visits.forEach(v => { map[v.visit_type || "otro"] = (map[v.visit_type || "otro"] || 0) + 1; });
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 rounded-lg bg-primary/20 animate-pulse" /></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-20">

      {/* Header Mobile Friendly */}
      <div className="flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">{monthStr}</p>
        <h1 className="text-3xl font-display font-black text-white tracking-tight">
          Hola, {userName.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground">Aquí está tu agenda para hoy.</p>
      </div>

      {/* 📍 AGENDA DE HOY (Principal Mobile) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Calendar className="h-3 w-3" /> Agenda de Hoy
          </h2>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
            {todayAgenda.length} VISITAS
          </span>
        </div>

        {todayAgenda.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center space-y-3 bg-white/[0.02]">
            <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No tienes visitas programadas para hoy.</p>
            <button className="text-xs font-bold text-primary underline">Programar ahora</button>
          </div>
        ) : (
          <div className="space-y-3">
            {todayAgenda.map((v) => {
              const isCheckedIn = !!v.check_in_at;
              const isCheckedOut = !!v.check_out_at;
              const isActive = isCheckedIn && !isCheckedOut;

              return (
                <div key={v.id} className={cn(
                  "relative overflow-hidden rounded-2xl border transition-all duration-300",
                  isActive ? "border-primary bg-primary/5 ring-1 ring-primary/20" : 
                  isCheckedOut ? "border-border/40 bg-muted/10 opacity-70" : "border-border/60 bg-card/60"
                )}>
                  <div className="p-4 flex gap-4">
                    <div className="flex flex-col items-center justify-center w-12 shrink-0 border-r border-border/40 pr-4">
                      <p className="text-lg font-display font-black text-foreground leading-none">{v.scheduled_time?.split(":")[0] || "--"}</p>
                      <p className="text-[10px] font-bold text-muted-foreground mt-1">{v.scheduled_time?.split(":")[1] || "00"}</p>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                        {typeLabels[v.visit_type] || "Visita"}
                      </p>
                      <h3 className="text-base font-bold text-white truncate">{v.client?.name || "Cliente"}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {v.client?.city || "Sin ciudad"}
                      </p>
                    </div>

                    <div className="flex items-center">
                      {!isCheckedIn && (
                        <button 
                          onClick={() => handleCheckIn(v.id)}
                          className="h-10 w-10 rounded-xl bg-primary text-black flex items-center justify-center shadow-lg active:scale-90 transition-all"
                        >
                          <Navigation className="h-5 w-5" />
                        </button>
                      )}
                      {isActive && (
                        <button 
                          onClick={() => handleCheckOut(v.id)}
                          className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg animate-pulse active:scale-90 transition-all"
                        >
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                      )}
                      {isCheckedOut && (
                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <Check className="h-4 w-4 text-emerald-500" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isActive && (
                    <div className="bg-primary/10 px-4 py-2 flex items-center justify-between border-t border-primary/20">
                      <div className="flex items-center gap-2">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                        <p className="text-[10px] font-black text-primary tracking-[0.1em]">VISITA EN CURSO</p>
                      </div>
                      <p className="text-[10px] font-mono font-bold text-primary/60 tracking-wider">GPS TRACKING ACTIVE</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Separador */}
      <div className="h-px bg-border/40 mx-2" />

      {/* KPIs Rápidos (Simplificados para Mobile) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Facturado</p>
          <p className="text-xl font-display font-black text-emerald-400">{fmt(salesMonth)}</p>
          <ProgressBar value={salesMonth} max={targetMonth} color="bg-emerald-500" />
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visitas</p>
          <p className="text-xl font-display font-black text-blue-400">{visitStats.completed} / {visitStats.total}</p>
          <ProgressBar value={visitStats.completed} max={visitStats.total} color="bg-blue-500" />
        </div>
      </div>

      {/* Quick Action Button (Floating style but inline) */}
      <button 
        onClick={() => window.location.hash = "#/visitas"}
        className="w-full py-4 rounded-2xl gradient-gold text-primary-foreground font-black text-sm shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <Plus className="h-5 w-5" /> PROGRAMAR NUEVA VISITA
      </button>

      {/* Aviso de privacidade */}
      <p className="text-[10px] text-muted-foreground/30 text-center px-6">
        Esta vista muestra únicamente datos de facturación (valor total), sin márgenes ni costos.
      </p>

      {/* 🏁 CHECKOUT MODAL (Phase 4) */}
      {showCheckout && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-md p-0 sm:p-4">
          <div className="w-full max-w-md bg-card border-t sm:border border-border rounded-t-[2.5rem] sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-display font-bold text-white">Finalizar Visita</h3>
                <p className="text-xs text-muted-foreground">Capture los resultados antes de salir</p>
              </div>
              <button onClick={() => setShowCheckout(false)} className="h-10 w-10 rounded-full bg-muted/20 flex items-center justify-center">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Interest Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Interés del Médico</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Bajo", "Medio", "Alto"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setInterest(level)}
                      className={cn(
                        "py-3 rounded-xl border-2 text-xs font-bold transition-all",
                        interest === level 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border/40 bg-muted/5 text-muted-foreground hover:border-border"
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Next Action */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próxima Acción</label>
                <select 
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  className="w-full bg-muted/10 border border-border/40 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none appearance-none"
                >
                  <option value="" disabled className="bg-card">Seleccione siguiente paso...</option>
                  {nextActionOptions.map(opt => (
                    <option key={opt} value={opt} className="bg-card">{opt}</option>
                  ))}
                </select>
              </div>

              {/* Result Notes */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Notas del Resultado</label>
                <textarea 
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  placeholder="Describa brevemente lo conversado o acordado..."
                  className="w-full bg-muted/10 border border-border/40 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none min-h-[100px] resize-none"
                />
              </div>

              {/* Action */}
              <button 
                onClick={confirmCheckOut}
                disabled={submitting || !nextAction || !resultNotes}
                className="w-full py-4 rounded-2xl gradient-gold text-primary-foreground font-black text-sm shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                CONFIRMAR SALIDA Y GUARDAR
              </button>
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-2 text-[9px] text-muted-foreground uppercase tracking-widest">
              <MapPin className="h-3 w-3" /> Geolocalización lista para captura
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add missing imports
import { Calendar, Check, Navigation, Plus, X, Loader2 } from "lucide-react";
