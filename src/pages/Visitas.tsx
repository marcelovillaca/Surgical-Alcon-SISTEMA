import { useState, useEffect, useMemo, useCallback } from "react";
import {
  MapPin, Calendar, Clock, Plus, Check, X, Send, DollarSign,
  ChevronLeft, ChevronRight, User, Building2, CalendarDays,
  CheckCircle2, XCircle, AlertCircle, Navigation, Loader2,
  Briefcase, Stethoscope, GraduationCap, Handshake, BarChart3, AlertTriangle,
  Search, Filter, Maximize2, ClipboardList, Globe, ShieldX
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

type Visit = {
  id: string;
  visit_date: string;
  scheduled_time: string | null;
  visit_type: string;
  observations: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  approved: boolean | null;
  created_by: string;
  client_id: string;
  client: { id: string; name: string; city: string | null } | null;
  viatico: { id: string; transporte: number; hospedaje: number; alimentacion: number; otros: number; total: number; status: string } | null;
  justification: string | null;
  rescheduled_date: string | null;
  rescheduled_time: string | null;
  created_by_profile?: { full_name: string } | null;
};

type Client = { id: string; name: string; city: string | null };

const visitTypes = [
  { key: "promocion_producto", label: "Promoción de Producto", desc: "Apresentação / reforço comercial", icon: Briefcase, color: "bg-primary/10 text-primary border-primary/20" },
  { key: "soporte_tecnico_clinico", label: "Soporte Técnico / Clínico", desc: "Dúvidas técnicas, indicação", icon: Stethoscope, color: "bg-chart-3/10 text-chart-3 border-chart-3/20" },
  { key: "entrenamiento_capacitacion", label: "Entrenamiento / Capacitación", desc: "Treinamento médico, equipe técnica", icon: GraduationCap, color: "bg-secondary/10 text-secondary border-secondary/20" },
  { key: "gestion_relacion", label: "Gestión de Relación / Cuenta", desc: "KAM, planejamento estratégico", icon: Handshake, color: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
  { key: "seguimiento_oportunidades", label: "Seguimiento de Uso", desc: "Análise consumo, oportunidades", icon: BarChart3, color: "bg-chart-4/10 text-chart-4 border-chart-4/20" },
  { key: "postventa_incidencias", label: "Postventa / Incidencias", desc: "Reclamações, falhas, logística", icon: AlertTriangle, color: "bg-destructive/10 text-destructive border-destructive/20" },
];

const tipoMap = Object.fromEntries(visitTypes.map((t) => [t.key, t]));
const formatPYG = (v: number) => `₲ ${v.toLocaleString()}`;

export default function Visitas() {
  const { user } = useAuth();
  const { isGerente } = useUserRole();
  const { toast } = useToast();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showQuickVisit, setShowQuickVisit] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [filterType, setFilterType] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterVisitor, setFilterVisitor] = useState("todos");
  const [clientSearch, setClientSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Justification state
  const [justifyingVisit, setJustifyingVisit] = useState<Visit | null>(null);
  const [justificationOption, setJustificationOption] = useState("");
  const [justificationObs, setJustificationObs] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");

  // Checklist state
  const [activeChecklist, setActiveChecklist] = useState<Record<string, boolean>>({});
  const [checklistObs, setChecklistObs] = useState("");

  // ─── Phase 4: Checkout Result State ───────────────────────────────────────
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutVisitId, setCheckoutVisitId] = useState<string | null>(null);
  const [interest, setInterest] = useState<"Bajo" | "Medio" | "Alto">("Medio");
  const [nextAction, setNextAction] = useState("");
  const [resultNotes, setResultNotes] = useState("");

  const nextActionOptions = [
    "Programar Demo de Equipo", "Enviar Cotización", "Entregar Muestras",
    "Seguimiento Telefónico", "Cierre de Venta", "Resolución de Incidencia",
    "Capacitación de Staff"
  ];

  // Form entries
  const [formEntries, setFormEntries] = useState<{
    clientId: string; date: string; time: string; type: string;
  }[]>([{ clientId: "", date: new Date().toISOString().split("T")[0], time: "09:00", type: "" }]);
  const [formObs, setFormObs] = useState("");
  const [needsViatico, setNeedsViatico] = useState(false);
  const [viaticoTransporte, setViaticoTransporte] = useState(0);
  const [viaticoHospedaje, setViaticoHospedaje] = useState(0);
  const [viaticoAlimentacion, setViaticoAlimentacion] = useState(0);
  const [viaticoOtros, setViaticoOtros] = useState(0);
  const [viaticoOtrosDesc, setViaticoOtrosDesc] = useState("");

  // Week helpers
  const getWeekDays = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      return dd.toISOString().split("T")[0];
    });
  }, []);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate, getWeekDays]);

  const activeVisit = useMemo(() => 
    allVisits.find(v => v.check_in_at && !v.check_out_at),
    [allVisits]
  );

  const [activeTimer, setActiveTimer] = useState("00:00:00");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeVisit?.check_in_at) {
      interval = setInterval(() => {
        const start = new Date(activeVisit.check_in_at!).getTime();
        const now = new Date().getTime();
        const diff = now - start;
        const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
        setActiveTimer(`${h}:${m}:${s}`);
      }, 1000);
    } else {
      setActiveTimer("00:00:00");
    }
    return () => clearInterval(interval);
  }, [activeVisit]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 10);
    return clients.filter(c => 
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
      (c.city && c.city.toLowerCase().includes(clientSearch.toLowerCase()))
    ).slice(0, 20);
  }, [clients, clientSearch]);

  // API Methods
  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("id, name, city");
    if (data) setClients(data);
  };

  const enrichVisits = async (visitsData: any[]): Promise<Visit[]> => {
    return Promise.all(
      visitsData.map(async (v) => {
        const { data: clientData } = await supabase.from("clients").select("id, name, city").eq("id", v.client_id).maybeSingle();
        const { data: viaticoData } = await supabase.from("viaticos").select("id, transporte, hospedaje, alimentacion, otros, total, status").eq("visit_id", v.id).maybeSingle();
        const { data: profileData } = await supabase.from("profiles").select("full_name").eq("id", v.created_by).maybeSingle();
        return { ...v, client: clientData, viatico: viaticoData, created_by_profile: profileData } as Visit;
      })
    );
  };

  const fetchVisitsForWeek = async () => {
    setLoading(true);
    const { data } = await supabase.from("visits")
      .select("id, visit_date, scheduled_time, visit_type, observations, check_in_at, check_out_at, approved, created_by, client_id, justification")
      .gte("visit_date", weekDays[0])
      .lte("visit_date", weekDays[6])
      .order("visit_date", { ascending: true })
      .order("scheduled_time", { ascending: true });

    if (data) {
      const enriched = await enrichVisits(data);
      setAllVisits(enriched);
      setVisits(enriched);
    }
    setLoading(false);
  };

  const fetchVisitsForDate = async (date: string) => {
    setLoading(true);
    const { data } = await supabase.from("visits")
      .select("id, visit_date, scheduled_time, visit_type, observations, check_in_at, check_out_at, approved, created_by, client_id")
      .eq("visit_date", date).order("scheduled_time", { ascending: true });
    if (data) {
      const enriched = await enrichVisits(data);
      setVisits(enriched);
      setAllVisits(enriched);
    }
    setLoading(false);
  };

  const fetchVisitsForMonth = async () => {
    setLoading(true);
    const d = new Date(selectedDate + "T12:00:00");
    const first = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
    const { data } = await supabase.from("visits")
      .select("id, visit_date, scheduled_time, visit_type, observations, check_in_at, check_out_at, approved, created_by, client_id")
      .gte("visit_date", first).lte("visit_date", last)
      .order("visit_date", { ascending: true }).order("scheduled_time", { ascending: true });
    if (data) {
      const enriched = await enrichVisits(data);
      setAllVisits(enriched);
      setVisits(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (viewMode === "day") fetchVisitsForDate(selectedDate);
    else if (viewMode === "month") fetchVisitsForMonth();
    else fetchVisitsForWeek();
  }, [selectedDate, viewMode]);

  // Check-out / Result Logic
  const handleCheckOut = (visitId: string) => {
    setCheckoutVisitId(visitId);
    setShowCheckoutModal(true);
  };

  const confirmCheckOut = async () => {
    if (!checkoutVisitId || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("visits").update({
        check_out_at: new Date().toISOString(),
        result_notes: resultNotes,
        rating: interest === "Bajo" ? 1 : interest === "Medio" ? 3 : 5,
        next_action: nextAction
      }).eq("id", checkoutVisitId);

      if (error) throw error;
      toast({ title: "Visita finalizada", description: "Reporte guardado correctamente." });
      setShowCheckoutModal(false);
      setResultNotes("");
      setNextAction("");
      fetchVisitsForWeek();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickCheckIn = async (clientId: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (!navigator.geolocation) throw new Error("GPS no disponible");
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej)
      );
      const { error } = await supabase.from("visits").insert({
        client_id: clientId,
        visit_date: new Date().toISOString().split("T")[0],
        scheduled_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        visit_type: "gestion_relacion",
        observations: "Visita rápida (SFA Check-in)",
        created_by: user.id,
        approved: true,
        check_in_at: new Date().toISOString(),
        check_in_lat: pos.coords.latitude,
        check_in_lon: pos.coords.longitude
      });
      if (error) throw error;
      toast({ title: "📍 Check-in Rápido exitoso" });
      setShowQuickVisit(false);
      fetchVisitsForWeek();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    if (viewMode === "day") d.setDate(d.getDate() + dir);
    else if (viewMode === "week") d.setDate(d.getDate() + (dir * 7));
    else d.setMonth(d.getMonth() + dir);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  // Stats
  const today = new Date().toISOString().split("T")[0];
  const stats = useMemo(() => {
    return {
      total: allVisits.length,
      approved: allVisits.filter(v => v.approved === true).length,
      pending: allVisits.filter(v => v.approved === null).length,
      completed: allVisits.filter(v => v.check_out_at).length,
      delayed: allVisits.filter(v => v.visit_date < today && !v.check_in_at && !v.justification && (v.approved === true || v.approved === null)).length
    };
  }, [allVisits, today]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 animate-slide-in">
      <div className="xl:col-span-3 space-y-5">
        
        {/* Active Visit Bar */}
        {activeVisit && (
          <div className="sticky top-0 z-30 -mx-4 sm:mx-0 sm:rounded-2xl bg-secondary p-4 mb-4 border-b-4 border-secondary/20 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                  <Navigation className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">VISITA EN CURSO</p>
                  <h3 className="text-sm font-bold text-white truncate">{activeVisit.client?.name}</h3>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">DURACIÓN</p>
                  <p className="text-lg font-mono font-bold text-white">{activeTimer}</p>
                </div>
                <button 
                  onClick={() => handleCheckOut(activeVisit.id)}
                  className="bg-white text-secondary px-6 py-2 rounded-xl font-bold text-xs"
                >
                  FINALIZAR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-black text-foreground flex items-center gap-3">
              <MapPin className="h-6 w-6 text-primary" /> Visitas & SFA
            </h1>
            <p className="text-sm text-muted-foreground">Gestión de ruta y ejecución en campo</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowQuickVisit(true)} className="flex-1 sm:flex-none px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-bold text-xs flex items-center justify-center gap-2">
              <Navigation className="h-4 w-4" /> CHECK-IN RÁPIDO
            </button>
            <button onClick={() => setShowForm(true)} className="flex-1 sm:flex-none px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-xs flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" /> NUEVA RUTA
            </button>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="flex items-center justify-between bg-card p-3 rounded-2xl border border-border">
          <div className="flex items-center gap-2">
            <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-muted rounded-lg transition-colors"><ChevronLeft className="h-5 w-5" /></button>
            <span className="text-sm font-bold text-foreground px-2">{new Date(selectedDate + "T12:00:00").toLocaleDateString('es-PY', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <button onClick={() => navigateDate(1)} className="p-2 hover:bg-muted rounded-lg transition-colors"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="flex p-1 bg-muted rounded-xl">
            {(["day", "week", "month"] as const).map(m => (
              <button 
                key={m} 
                onClick={() => setViewMode(m)}
                className={cn("px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all capitalize", viewMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {m === "day" ? "Día" : m === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid View */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {visits.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
                <CalendarDays className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">No hay visitas programadas para este período</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visits.map(v => (
                  <div key={v.id} className="bg-card border border-border p-4 rounded-2xl hover:shadow-lg transition-all group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", tipoMap[v.visit_type]?.color || "bg-muted text-muted-foreground")}>
                          {(() => {
                            const Icon = tipoMap[v.visit_type]?.icon || Briefcase;
                            return <Icon className="h-5 w-5" />;
                          })()}
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground truncate max-w-[200px]">{v.client?.name}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {v.client?.city}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">{v.scheduled_time || "--:--"}</p>
                        <p className="text-[10px] text-muted-foreground">{v.visit_date}</p>
                      </div>
                    </div>
                    {v.observations && <p className="text-xs text-muted-foreground line-clamp-2 mb-3 px-1">{v.observations}</p>}
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex gap-2">
                         {v.approved === null && <span className="text-[9px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full uppercase">Pendiente</span>}
                         {v.approved === true && <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full uppercase">Aprobada</span>}
                         {v.check_out_at && <span className="text-[9px] font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full uppercase">Realizada</span>}
                      </div>
                      <button className="text-[10px] font-bold text-primary hover:underline">VER DETALLES</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar: Stats */}
      <div className="space-y-5">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-display font-bold text-foreground mb-4">Resumen de Ruta</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total Programadas</span>
              <span className="text-sm font-bold text-foreground">{stats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Realizadas</span>
              <span className="text-sm font-bold text-emerald-500">{stats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pendientes</span>
              <span className="text-sm font-bold text-amber-500">{stats.pending}</span>
            </div>
            {stats.delayed > 0 && (
              <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20 mt-2">
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-bold">Ruta Atrasada</span>
                </div>
                <p className="text-[10px] text-destructive/80 font-medium">{stats.delayed} visitas sin justificar.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🏁 CHECKOUT RESULT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-foreground">Resultados de Visita</h3>
                  <p className="text-xs text-muted-foreground">Registre el impacto comercial</p>
                </div>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="text-muted-foreground hover:text-foreground p-2"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Interés detectado</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Bajo", "Medio", "Alto"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setInterest(level)}
                      className={cn(
                        "py-3 rounded-xl border-2 text-xs font-bold transition-all",
                        interest === level ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-border bg-muted/5 text-muted-foreground"
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Siguiente Acción</label>
                <select 
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  className="w-full bg-muted/20 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none"
                >
                  <option value="" disabled>Seleccione próximo paso...</option>
                  {nextActionOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Observaciones Finales</label>
                <textarea 
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  placeholder="Detalles sobre lo conversado..."
                  className="w-full bg-muted/20 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none min-h-[100px] resize-none"
                />
              </div>

              <button 
                onClick={confirmCheckOut}
                disabled={submitting || !nextAction || !resultNotes}
                className="w-full py-4 rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                CONFIRMAR Y FINALIZAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Check-in Modal */}
      {showQuickVisit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Navigation className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-foreground">Check-in Rápido</h3>
                  <p className="text-xs text-muted-foreground">Inicie una visita fuera de ruta</p>
                </div>
              </div>
              <button onClick={() => setShowQuickVisit(false)} className="text-muted-foreground hover:text-foreground p-2"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar médico o clínica..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-muted/20 text-sm focus:ring-2 focus:ring-secondary outline-none"
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                {filteredClients.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => handleQuickCheckIn(c.id)}
                    disabled={submitting}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-secondary hover:bg-secondary/5 transition-all text-left group"
                  >
                    <div>
                      <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> {c.city}</p>
                    </div>
                    <Plus className="h-4 w-4 text-secondary opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
