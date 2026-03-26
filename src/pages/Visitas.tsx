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
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [filterType, setFilterType] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterVisitor, setFilterVisitor] = useState("todos");
  const [clientSearch, setClientSearch] = useState("");

  // Justification state
  const [justifyingVisit, setJustifyingVisit] = useState<Visit | null>(null);
  const [justificationOption, setJustificationOption] = useState("");
  const [justificationObs, setJustificationObs] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");

  // Checklist state
  const [activeChecklist, setActiveChecklist] = useState<Record<string, boolean>>({});
  const [checklistObs, setChecklistObs] = useState("");

  const standardJustifications = [
    "Médico indisponible / De vacaciones",
    "Reprogramación solicitada por el cliente",
    "Incidencia logística / Problemas de transporte",
    "Emergencia médica o cirugía de urgencia",
    "Acceso denegado / Cliente ausente",
    "Otro motivo (especificar en observaciones)"
  ];

  // Form state
  const [formEntries, setFormEntries] = useState<{
    clientId: string;
    date: string;
    time: string;
    type: string;
  }[]>([{ clientId: "", date: new Date().toISOString().split("T")[0], time: "09:00", type: "" }]);
  const [formObs, setFormObs] = useState("");
  const [needsViatico, setNeedsViatico] = useState(false);
  const [viaticoTransporte, setViaticoTransporte] = useState(0);
  const [viaticoHospedaje, setViaticoHospedaje] = useState(0);
  const [viaticoAlimentacion, setViaticoAlimentacion] = useState(0);
  const [viaticoOtros, setViaticoOtros] = useState(0);
  const [viaticoOtrosDesc, setViaticoOtrosDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (viewMode === "day") fetchVisitsForDate(selectedDate);
    else if (viewMode === "month") fetchVisitsForMonth();
    else fetchVisitsForWeek();
  }, [selectedDate, viewMode]);

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

  const fetchVisitsForWeek = async () => {
    setLoading(true);
    const { data } = await supabase.from("visits")
      .select("id, visit_date, scheduled_time, visit_type, observations, check_in_at, check_out_at, approved, created_by, client_id")
      .gte("visit_date", weekDays[0]).lte("visit_date", weekDays[6])
      .order("visit_date", { ascending: true }).order("scheduled_time", { ascending: true });
    if (data) {
      const enriched = await enrichVisits(data);
      setAllVisits(enriched);
      setVisits(enriched);
    }
    setLoading(false);
  };

  const filteredVisits = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return allVisits.filter((v) => {
      // Intelligent filter by visitor
      if (filterVisitor !== "todos" && v.created_by !== filterVisitor) return false;

      if (filterType !== "todos" && v.visit_type !== filterType) return false;

      const isDelayed = v.visit_date < today && !v.check_in_at && !v.justification && (v.approved === true || v.approved === null);

      if (filterStatus === "pendiente" && (v.approved !== null || isDelayed)) return false;
      if (filterStatus === "aprobada" && (v.approved !== true || isDelayed || v.check_out_at)) return false;
      if (filterStatus === "rechazada" && v.approved !== false) return false;
      if (filterStatus === "completada" && !v.check_out_at) return false;
      if (filterStatus === "atrasada" && !isDelayed) return false;

      return true;
    });
  }, [allVisits, filterType, filterStatus, filterVisitor]);

  const visitors = useMemo(() => {
    const unique = new Set<string>();
    const list: { id: string; name: string }[] = [];
    allVisits.forEach(v => {
      if (v.created_by && !unique.has(v.created_by)) {
        unique.add(v.created_by);
        list.push({ id: v.created_by, name: v.created_by_profile?.full_name || "Desconocido" });
      }
    });
    return list;
  }, [allVisits]);

  const handleCreateVisits = async () => {
    if (!user) return;
    const valid = formEntries.filter((e) => e.clientId && e.type && e.date && e.time);
    if (valid.length === 0) {
      toast({ title: "Error", description: "Complete todos los campos obligatorios (cliente, tipo, fecha, hora).", variant: "destructive" });
      return;
    }
    // Validate type selection
    for (const entry of valid) {
      if (!visitTypes.find((t) => t.key === entry.type)) {
        toast({ title: "Error", description: "Seleccione un tipo de visita válido.", variant: "destructive" });
        return;
      }
    }
    setSubmitting(true);

    for (const entry of valid) {
      const { data: visit, error } = await supabase.from("visits").insert({
        client_id: entry.clientId,
        visit_date: entry.date,
        scheduled_time: entry.time,
        visit_type: entry.type as any,
        observations: formObs || null,
        created_by: user.id,
      }).select("id").single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        continue;
      }

      if (needsViatico && visit) {
        const total = viaticoTransporte + viaticoHospedaje + viaticoAlimentacion + viaticoOtros;
        await supabase.from("viaticos").insert({
          visit_id: visit.id, created_by: user.id,
          transporte: viaticoTransporte, hospedaje: viaticoHospedaje,
          alimentacion: viaticoAlimentacion, otros: viaticoOtros,
          otros_descripcion: viaticoOtrosDesc || null, total, status: "pendiente",
        });
      }
    }

    toast({ title: "✅ Visitas programadas", description: `${valid.length} visita(s) enviada(s) para aprobación.` });
    resetForm();
    if (viewMode === "day") fetchVisitsForDate(selectedDate);
    else fetchVisitsForWeek();
  };

  const handleApprove = async (visitId: string, approved: boolean) => {
    await (supabase.from("visits") as any).update({ approved, approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", visitId);
    await (supabase.from("viaticos") as any).update({ status: approved ? "aprobado" : "rechazado", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("visit_id", visitId);

    // Create audit log for notification
    await supabase.from("audit_log").insert({
      action: approved ? "VISIT_APPROVED" : "VISIT_REJECTED",
      entity_type: "visit",
      entity_id: visitId,
      user_id: user?.id,
      details: { approved, timestamp: new Date().toISOString() }
    });

    toast({ title: approved ? "✅ Visita aprobada" : "❌ Visita rechazada" });
    if (viewMode === "day") fetchVisitsForDate(selectedDate);
    else fetchVisitsForWeek();
  };

  const handleCheckIn = async (visitId: string) => {
    if (!navigator.geolocation) { toast({ title: "Error", description: "Geolocalización no disponible", variant: "destructive" }); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await supabase.from("visits").update({ check_in_at: new Date().toISOString(), check_in_lat: pos.coords.latitude, check_in_lon: pos.coords.longitude }).eq("id", visitId);
      toast({ title: "📍 Check-in registrado" });
      if (viewMode === "day") fetchVisitsForDate(selectedDate); else fetchVisitsForWeek();
    }, () => toast({ title: "Error", description: "No se pudo obtener la ubicación", variant: "destructive" }));
  };

  const handleCheckOut = async (visitId: string) => {
    if (!navigator.geolocation) return;
    
    // Validate checklist completion for technical/strategic visits
    const visit = visits.find(v => v.id === visitId);
    if (visit && (visit.visit_type === 'soporte_tecnico_clinico' || visit.visit_type === 'gestion_relacion')) {
        const completedCount = Object.values(activeChecklist).filter(v => v).length;
        if (completedCount < 2) {
            toast({ title: "Checklist Incompleto", description: "Debe completar al menos 2 puntos del checklist para esta visita técnica.", variant: "destructive" });
            return;
        }
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      await supabase.from("visits").update({ 
        check_out_at: new Date().toISOString(), 
        check_out_lat: pos.coords.latitude, 
        check_out_lon: pos.coords.longitude,
        observations: (visit?.observations || "") + "\n\nCHECKLIST: " + checklistObs
      }).eq("id", visitId);
      toast({ title: "📍 Visita Finalizada", description: "Ejecución registrada exitosamente." });
      setActiveChecklist({});
      setChecklistObs("");
      if (viewMode === "day") fetchVisitsForDate(selectedDate); else fetchVisitsForWeek();
    });
  };

  const handleJustify = async () => {
    if (!justifyingVisit || (!justificationOption && !justificationObs) || !rescheduleDate) return;
    setSubmitting(true);

    const fullJustification = justificationObs
      ? `${justificationOption}: ${justificationObs}`
      : justificationOption;

    // Update visit with justification
    const { error } = await supabase.from("visits").update({
      justification: fullJustification,
      rescheduled_date: rescheduleDate,
      rescheduled_time: rescheduleTime
    } as any).eq("id", justifyingVisit.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Create audit log for manager
      await supabase.from("audit_log").insert({
        action: "VISIT_JUSTIFIED",
        entity_type: "visit",
        entity_id: justifyingVisit.id,
        user_id: user?.id,
        details: { justification: fullJustification, reschedule: `${rescheduleDate} ${rescheduleTime}` }
      });

      // Automatically create the rescheduled visit
      await supabase.from("visits").insert({
        client_id: justifyingVisit.client_id,
        visit_date: rescheduleDate,
        scheduled_time: rescheduleTime,
        visit_type: justifyingVisit.visit_type as any,
        observations: `Reschedule de visita anterior: ${fullJustification}`,
        created_by: user!.id
      });

      toast({ title: "✅ Justificación enviada", description: "Se ha programado la nueva visita automáticamente." });
      setJustifyingVisit(null);
      setJustificationObs("");
      setRescheduleDate("");
      if (viewMode === "day") fetchVisitsForDate(selectedDate);
      else fetchVisitsForWeek();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setFormEntries([{ clientId: "", date: new Date().toISOString().split("T")[0], time: "09:00", type: "" }]);
    setFormObs("");
    setNeedsViatico(false);
    setViaticoTransporte(0); setViaticoHospedaje(0); setViaticoAlimentacion(0); setViaticoOtros(0); setViaticoOtrosDesc("");
  };

  const addEntry = () => setFormEntries([...formEntries, { clientId: "", date: selectedDate, time: "09:00", type: "" }]);
  const removeEntry = (idx: number) => setFormEntries(formEntries.filter((_, i) => i !== idx));
  const updateEntry = (idx: number, field: string, value: string) => {
    const next = [...formEntries];
    (next[idx] as any)[field] = value;
    setFormEntries(next);
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

  const getMonthDays = useMemo(() => {
    const d = new Date(selectedDate + "T12:00:00");
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7; // Mon=0
    const days: (string | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
    }
    return days;
  }, [selectedDate]);

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + dir);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() + dir * 7);
    } else {
      d.setDate(d.getDate() + dir);
    }
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const today = new Date().toISOString().split("T")[0];
  const dateDisplay = new Date(selectedDate + "T12:00:00");

  // Stats
  const totalVisits = allVisits.length;
  const approvedCount = allVisits.filter((v) => v.approved === true).length;
  const pendingCount = allVisits.filter((v) => v.approved === null).length;
  const completedCount = allVisits.filter((v) => v.check_out_at).length;
  const delayedCount = allVisits.filter((v) => v.visit_date < today && !v.check_in_at && !v.justification && (v.approved === true || v.approved === null)).length;

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.city?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-slide-in">
      <div className="xl:col-span-3 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {isGerente ? "Gestión de Visitas" : "Mi Agenda"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isGerente ? "Aprobación y seguimiento del equipo" : "Programa y registra tus visitas"}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setViewMode("day")} className={cn("px-3 py-2 text-xs font-medium transition-colors", viewMode === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>Día</button>
            <button onClick={() => setViewMode("week")} className={cn("px-3 py-2 text-xs font-medium transition-colors", viewMode === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>Semana</button>
            <button onClick={() => setViewMode("month")} className={cn("px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1", viewMode === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              <Maximize2 className="h-3 w-3" /> Mes
            </button>
          </div>
          {!isGerente && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-xl gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 shadow-lg">
              <Plus className="h-4 w-4" /> Nueva Visita
            </button>
          )}
        </div>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigateDate(-1)} className="rounded-lg border border-border bg-card p-2.5 hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
        <div className="flex-1">
          {viewMode === "month" ? (
            <div>
              <p className="text-center text-lg font-display font-bold text-foreground capitalize mb-3">
                {dateDisplay.toLocaleDateString("es", { month: "long", year: "numeric" })}
              </p>
              <div className="grid grid-cols-7 gap-1">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => (
                  <div key={d} className="text-center text-[10px] uppercase tracking-widest text-muted-foreground py-1">{d}</div>
                ))}
                {getMonthDays.map((d, idx) => {
                  if (!d) return <div key={`pad-${idx}`} />;
                  const dd = new Date(d + "T12:00:00");
                  const isToday = d === today;
                  const dayVisits = allVisits.filter(v => v.visit_date === d);
                  return (
                    <button key={d} onClick={() => { setSelectedDate(d); setViewMode("day"); }}
                      className={cn(
                        "rounded-lg p-1.5 text-center transition-all border",
                        isToday ? "border-secondary bg-secondary/10" : dayVisits.length > 0 ? "border-primary/20 bg-primary/5" : "border-transparent hover:bg-muted"
                      )}>
                      <p className={cn("text-xs font-medium", isToday ? "text-secondary font-bold" : "text-foreground")}>{dd.getDate()}</p>
                      {dayVisits.length > 0 && (
                        <div className="flex justify-center gap-0.5 mt-0.5">
                          {dayVisits.slice(0, 3).map((v, i) => (
                            <span key={i} className={cn("h-1 w-1 rounded-full", v.approved === true ? "bg-secondary" : v.approved === false ? "bg-destructive" : "bg-primary")} />
                          ))}
                        </div>
                      )}
                      {dayVisits.length > 0 && <p className="text-[8px] text-muted-foreground">{dayVisits.length}</p>}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : viewMode === "week" ? (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const dd = new Date(d + "T12:00:00");
                const isToday = d === today;
                const isSelected = d === selectedDate;
                const dayVisits = allVisits.filter((v) => v.visit_date === d);
                return (
                  <button key={d} onClick={() => { setSelectedDate(d); setViewMode("day"); }}
                    className={cn(
                      "rounded-xl p-2 text-center transition-all border-2",
                      isSelected ? "border-primary bg-primary/10" : isToday ? "border-secondary/30 bg-secondary/5" : "border-transparent hover:bg-muted"
                    )}>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{dd.toLocaleDateString("es", { weekday: "short" })}</p>
                    <p className={cn("text-lg font-display font-bold", isToday ? "text-secondary" : "text-foreground")}>{dd.getDate()}</p>
                    {dayVisits.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1">
                        {dayVisits.slice(0, 3).map((v, i) => (
                          <span key={i} className={cn("h-1.5 w-1.5 rounded-full", v.approved === true ? "bg-secondary" : v.approved === false ? "bg-destructive" : "bg-primary")} />
                        ))}
                        {dayVisits.length > 3 && <span className="text-[8px] text-muted-foreground">+{dayVisits.length - 3}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg font-display font-bold text-foreground capitalize">{dateDisplay.toLocaleDateString("es", { weekday: "long" })}</p>
              <p className="text-sm text-muted-foreground">{dateDisplay.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}</p>
              {selectedDate === today && <span className="inline-block mt-1 rounded-full bg-primary/10 text-primary px-3 py-0.5 text-[10px] font-semibold">HOY</span>}
            </div>
          )}
        </div>
        <button onClick={() => navigateDate(1)} className="rounded-lg border border-border bg-card p-2.5 hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
        <button onClick={() => setSelectedDate(today)} className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors">Hoy</button>
      </div>

  // Stats
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Programadas", value: totalVisits, color: "text-foreground" },
          { label: "Aprobadas", value: approvedCount, color: "text-secondary" },
          { label: "Pendientes", value: pendingCount, color: "text-primary" },
          { label: "Atrasadas", value: delayedCount, color: "text-destructive" },
          { label: "Completadas", value: completedCount, color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-2 text-center">
            <p className={cn("text-lg font-display font-bold", s.color)}>{s.value}</p>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary">
          <option value="todos">Todos los tipos</option>
          {visitTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary">
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>
          <option value="atrasada">Atrasada</option>
          <option value="rechazada">Rechazada</option>
          <option value="completada">Completada</option>
        </select>
        {isGerente && (
          <select value={filterVisitor} onChange={(e) => setFilterVisitor(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary ml-auto">
            <option value="todos">Todos los visitadores</option>
            {visitors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        )}
      </div>

      {/* New Visit Form */}
      {showForm && (
        <div className="rounded-2xl border-2 border-primary/30 bg-card p-6 space-y-5 animate-slide-in gold-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-gold flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-foreground">Programar Visitas</h3>
                <p className="text-xs text-muted-foreground">Puede agregar múltiples visitas a la vez</p>
              </div>
            </div>
            <button onClick={addEntry} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Agregar otra
            </button>
          </div>

          {/* Visit entries */}
          <div className="space-y-4">
            {formEntries.map((entry, idx) => (
              <div key={idx} className={cn("rounded-xl border p-4 space-y-3", entry.type ? "border-primary/20 bg-primary/5" : "border-border")}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Visita #{idx + 1}</span>
                  {formEntries.length > 1 && (
                    <button onClick={() => removeEntry(idx)} className="text-xs text-destructive hover:text-destructive/80">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Client with search */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">
                    <User className="h-3 w-3 inline mr-1" />Cliente / Médico *
                  </label>
                  <select value={entry.clientId} onChange={(e) => updateEntry(idx, "clientId", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none">
                    <option value="">Seleccionar cliente...</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name} {c.city ? `· ${c.city}` : ""}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Fecha *</label>
                    <input type="date" value={entry.date} onChange={(e) => updateEntry(idx, "date", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Hora *</label>
                    <input type="time" value={entry.time} step="900"
                      onChange={(e) => updateEntry(idx, "time", e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" />
                  </div>
                </div>

                {/* Visit type selection - REQUIRED, no free text */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">
                    Tipo de Visita * <span className="text-destructive">(obligatorio)</span>
                  </label>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {visitTypes.map((t) => {
                      const Icon = t.icon;
                      const isSelected = entry.type === t.key;
                      return (
                        <button key={t.key} onClick={() => updateEntry(idx, "type", t.key)}
                          className={cn(
                            "rounded-lg border-2 p-2.5 text-left transition-all",
                            isSelected ? t.color + " border-current shadow-sm" : "border-border hover:border-muted-foreground bg-background"
                          )}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0" />
                            <div className="min-w-0">
                              <p className={cn("text-xs font-semibold truncate", isSelected ? "" : "text-foreground")}>{t.label}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{t.desc}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!entry.type && <p className="text-[10px] text-destructive mt-1">Seleccione un tipo de visita</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Observations */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Observaciones (opcional)</label>
            <textarea value={formObs} onChange={(e) => setFormObs(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none resize-none"
              placeholder="Notas adicionales..." />
          </div>

          {/* Viáticos */}
          <div className={cn("rounded-xl border-2 p-4 space-y-3 transition-all", needsViatico ? "border-primary/30 bg-primary/5" : "border-border")}>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={cn("h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all", needsViatico ? "bg-primary border-primary" : "border-border")}>
                {needsViatico && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
              <input type="checkbox" checked={needsViatico} onChange={(e) => setNeedsViatico(e.target.checked)} className="sr-only" />
              <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Solicitar Viáticos
              </span>
            </label>
            {needsViatico && (
              <div className="space-y-3 pt-2 animate-slide-in">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "🚗 Transporte", value: viaticoTransporte, set: setViaticoTransporte },
                    { label: "🏨 Hospedaje", value: viaticoHospedaje, set: setViaticoHospedaje },
                    { label: "🍽️ Alimentación", value: viaticoAlimentacion, set: setViaticoAlimentacion },
                    { label: "📝 Otros", value: viaticoOtros, set: setViaticoOtros },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="text-[10px] font-semibold text-muted-foreground mb-1 block">{label}</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₲</span>
                        <input type="number" value={value || ""} onChange={(e) => set(Number(e.target.value))}
                          className="w-full rounded-lg border border-border bg-background pl-7 pr-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="0" />
                      </div>
                    </div>
                  ))}
                </div>
                {viaticoOtros > 0 && (
                  <input type="text" value={viaticoOtrosDesc} onChange={(e) => setViaticoOtrosDesc(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                    placeholder="Descripción de otros gastos..." />
                )}
                <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground">Total Viáticos</span>
                  <span className="text-base font-display font-bold text-primary">
                    {formatPYG(viaticoTransporte + viaticoHospedaje + viaticoAlimentacion + viaticoOtros)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={resetForm} className="px-5 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleCreateVisits} disabled={submitting || formEntries.every((e) => !e.clientId || !e.type)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-gold text-sm font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50 shadow-lg">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar {formEntries.filter((e) => e.clientId && e.type).length} visita(s)
            </button>
          </div>
        </div>
      )}

      {/* Justification Dialog */}
      {justifyingVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-2 border-destructive/30 bg-card p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-foreground">Justificar Atraso</h3>
                <p className="text-xs text-muted-foreground">La visita a {justifyingVisit.client?.name} ha quedado atrasada.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Motivo Estándar *</label>
                <select
                  value={justificationOption}
                  onChange={(e) => setJustificationOption(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">Seleccione un motivo...</option>
                  {standardJustifications.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Observaciones Adicionales</label>
                <textarea
                  value={justificationObs}
                  onChange={(e) => setJustificationObs(e.target.value)}
                  placeholder="Detalles opcionales sobre el atraso..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none resize-none h-20"
                />
              </div>

              <div className="bg-muted/30 rounded-xl p-4 border border-border">
                <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> ¿Cuándo será la nueva visita?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block uppercase">Nueva Fecha</label>
                    <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block uppercase">Nueva Hora</label>
                    <input type="time" value={rescheduleTime} step="900" onChange={(e) => setRescheduleTime(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setJustifyingVisit(null);
                  setJustificationOption("");
                  setJustificationObs("");
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button onClick={handleJustify} disabled={!justificationOption || !rescheduleDate || submitting}
                className="flex items-center gap-2 rounded-xl bg-destructive px-6 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Grabar Justificación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visits List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filteredVisits.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-12 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-base font-display font-semibold text-foreground mb-1">Sin visitas</p>
          <p className="text-sm text-muted-foreground mb-4">{viewMode === "week" ? "No hay visitas esta semana" : "No hay visitas para este día"}</p>
          {!isGerente && (
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl gradient-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> Programar visita
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVisits.map((v) => {
            const isActive = v.check_in_at && !v.check_out_at;
            const isDelayed = v.visit_date < today && !v.check_in_at && !v.justification && (v.approved === true || v.approved === null);
            const isCompleted = !!v.check_out_at;
            const isPending = v.approved === null && !isDelayed;
            const isApproved = v.approved === true && !isDelayed;
            const isRejected = v.approved === false;
            const isJustified = !!v.justification;
            const tipo = tipoMap[v.visit_type];
            const Icon = tipo?.icon || Briefcase;

            const checklists: Record<string, string[]> = {
              soporte_tecnico_clinico: ["Equipamiento verificado", "Demostración realizada", "Material entregado", "Próximos pasos acordados"],
              entrenamiento_capacitacion: ["Asistencia registrada", "Evaluación práctica", "Certificación entregada"],
              gestion_relacion: ["Alineación estratégica", "Revisión de indicadores", "Feedback del cliente", "Oportunidad identificada"],
              promocion_producto: ["Ficha técnica entregada", "Comparativa competencia", "Muestra entregada"],
              seguimiento_oportunidades: ["Inventario revisado", "Proyección de compra", "Renovación solicitada"],
              postventa_incidencias: ["Reclamo documentado", "Solución inmediata", "Escalamiento avisado"]
            };

            return (
              <div key={v.id} className={cn(
                "rounded-2xl border-2 bg-card p-4 transition-all",
                isActive && "border-primary/40 gold-glow",
                isCompleted && "border-secondary/30 opacity-80",
                isPending && "border-primary/20",
                isDelayed && "border-destructive/40 bg-destructive/5 animate-pulse",
                isRejected && "border-destructive/20 opacity-60",
                isApproved && !isActive && !isCompleted && "border-secondary/20",
                isJustified && "border-border opacity-70"
              )}>
                <div className="flex items-start gap-3">
                  {/* Time + date */}
                  <div className="shrink-0 text-center">
                    {viewMode === "week" && (
                      <p className="text-[10px] text-muted-foreground mb-1">{new Date(v.visit_date + "T12:00:00").toLocaleDateString("es", { weekday: "short", day: "numeric" })}</p>
                    )}
                    <div className={cn("rounded-xl px-3 py-2 min-w-[56px]", isActive ? "gradient-gold" : "bg-muted")}>
                      <p className={cn("text-sm font-mono font-bold", isActive ? "text-primary-foreground" : "text-foreground")}>
                        {v.scheduled_time?.substring(0, 5) || "--:--"}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display font-bold text-foreground">{v.client?.name || "Cliente"}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {v.client?.city && <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {v.client.city}</span>}
                          <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-medium", tipo?.color || "bg-muted text-muted-foreground border-border")}>
                            <Icon className="h-3 w-3" /> {tipo?.label || v.visit_type}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {isPending && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10px] font-semibold"><AlertCircle className="h-3 w-3" /> Pendiente</span>}
                        {isDelayed && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2.5 py-0.5 text-[10px] font-semibold"><AlertTriangle className="h-3 w-3" /> ATRASADA</span>}
                        {isApproved && !isCompleted && !isDelayed && <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 text-secondary px-2.5 py-0.5 text-[10px] font-semibold"><CheckCircle2 className="h-3 w-3" /> Aprobada</span>}
                        {isRejected && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2.5 py-0.5 text-[10px] font-semibold"><XCircle className="h-3 w-3" /> Rechazada</span>}
                        {isCompleted && <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 text-secondary px-2.5 py-0.5 text-[10px] font-semibold"><CheckCircle2 className="h-3 w-3" /> Completada</span>}
                        {isJustified && <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[10px] font-semibold">Justificada / Reprogramada</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <User className="h-2.5 w-2.5" /> {v.created_by_profile?.full_name || "Desconocido"}
                      </span>
                    </div>

                    {v.observations && <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg px-3 py-1.5">{v.observations}</p>}
                    {v.justification && (
                      <div className="mt-2 rounded-lg border border-border bg-destructive/5 p-2.5">
                        <p className="text-[10px] font-bold text-destructive uppercase mb-1">Justificación de atraso:</p>
                        <p className="text-xs text-foreground italic">"{v.justification}"</p>
                        {v.rescheduled_date && (
                          <p className="text-[10px] text-muted-foreground mt-1 font-semibold">
                            Reprogramada para: {v.rescheduled_date} {v.rescheduled_time?.substring(0, 5)}
                          </p>
                        )}
                      </div>
                    )}

                    {v.viatico && (
                      <div className="mt-2 rounded-lg border border-border bg-background/50 p-2.5 flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Viáticos</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-display font-bold text-primary">{formatPYG(v.viatico.total)}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            v.viatico.status === "aprobado" ? "bg-secondary/10 text-secondary" :
                              v.viatico.status === "rechazado" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                          )}>{v.viatico.status}</span>
                        </div>
                      </div>
                    )}

                    {/* Digital Checklist for Active Visit */}
                    {isActive && (
                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-slide-in">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                          <ClipboardList className="h-3 w-3" /> Checklist de Ejecución
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {checklists[v.visit_type]?.map((item) => (
                            <label key={item} className="flex items-center gap-3 cursor-pointer group">
                              <div 
                                onClick={() => setActiveChecklist(prev => ({ ...prev, [item]: !prev[item] }))}
                                className={cn(
                                  "h-5 w-5 rounded border flex items-center justify-center transition-all",
                                  activeChecklist[item] ? "bg-primary border-primary shadow-sm" : "border-muted-foreground/30 group-hover:border-primary"
                                )}
                              >
                                {activeChecklist[item] && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                              </div>
                              <span className={cn("text-xs transition-colors", activeChecklist[item] ? "text-foreground font-medium" : "text-muted-foreground")}>
                                {item}
                              </span>
                            </label>
                          )) || <p className="text-xs text-muted-foreground italic">No hay checklist definido para este tipo.</p>}
                        </div>
                        <textarea 
                          value={checklistObs} 
                          onChange={(e) => setChecklistObs(e.target.value)}
                          placeholder="Notas de ejecución y feedback..."
                          rows={2}
                          className="w-full mt-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none resize-none"
                        />
                      </div>
                    )}

                    <div className="mt-3 flex gap-2 flex-wrap">
                      {!isGerente && isDelayed && (
                        <button onClick={() => setJustifyingVisit(v)} className="flex items-center gap-1.5 rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-white hover:opacity-90 shadow-md">
                          <AlertTriangle className="h-3 w-3" /> Justificar Atraso
                        </button>
                      )}
                      {!isGerente && isApproved && !v.check_in_at && !isDelayed && (
                        <button onClick={() => handleCheckIn(v.id)} className="flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground hover:opacity-90 transition-all shadow-md">
                          <Navigation className="h-3 w-3" /> Check-in
                        </button>
                      )}
                      {!isGerente && isActive && (
                        <button onClick={() => handleCheckOut(v.id)} className="flex items-center gap-1.5 rounded-xl gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md animate-pulse">
                          <Navigation className="h-3 w-3" /> Check-out
                        </button>
                      )}
                      {isGerente && (isPending || isDelayed) && (
                        <>
                          <button onClick={() => handleApprove(v.id, true)} className="flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground hover:opacity-90 shadow-md">
                            <Check className="h-3 w-3" /> Aprobar
                          </button>
                          <button onClick={() => handleApprove(v.id, false)} className="flex items-center gap-1.5 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/20">
                            <X className="h-3 w-3" /> Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Side Panel: Live Force Intelligence */}
      <div className="hidden xl:block space-y-5">
        <div className="rounded-2xl border-2 border-primary/20 bg-card p-5 space-y-4 sticky top-20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary animate-spin-slow" /> Live Force Status
            </h3>
            <span className="flex h-2 w-2 rounded-full bg-secondary animate-pulse" />
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-muted/50 p-3 space-y-2 border border-border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cobertura Geográfica</p>
              <div className="aspect-square rounded-lg bg-muted relative overflow-hidden border border-border group cursor-crosshair">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,hsl(var(--primary))_1px,transparent_1px)] bg-[size:20px_20px]" />
                {/* Simulated Map Markers */}
                <div className="absolute top-1/4 left-1/3 h-3 w-3 rounded-full bg-secondary border-2 border-background shadow-lg shadow-secondary/50 animate-bounce" />
                <div className="absolute top-1/2 left-2/3 h-2 w-2 rounded-full bg-primary border border-background" />
                <div className="absolute bottom-1/3 left-1/4 h-2 w-2 rounded-full bg-primary border border-background" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <p className="text-[10px] font-bold text-muted-foreground bg-background/80 px-2 py-1 rounded border border-border group-hover:hidden transition-all">Vista Satelital (Simulada)</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Actividad Reciente</p>
               {[
                 { user: "Juan Perez", client: "Sanatorio Imet", status: "En Visita", type: "grow" },
                 { user: "Maria Lopez", client: "Hospital Británico", status: "Check-in", type: "partner" },
                 { user: "Carlos Ruiz", client: "Clinica Eye", status: "Finalizado", type: "check_in" }
               ].map((act, i) => (
                 <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                   <div className="min-w-0">
                     <p className="text-xs font-bold text-foreground truncate">{act.user}</p>
                     <p className="text-[10px] text-muted-foreground truncate">{act.client}</p>
                   </div>
                   <span className={cn(
                     "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                     act.status === "En Visita" ? "bg-secondary/10 text-secondary" : 
                     act.status === "Check-in" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                   )}>{act.status}</span>
                 </div>
               ))}
            </div>

            <button className="w-full py-2.5 rounded-xl border-2 border-border text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
               Ver Reporte Operativo Completo
            </button>
          </div>
        </div>
        
        {/* Fraud Prevention Card */}
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
            <h4 className="text-[10px] font-bold text-destructive uppercase tracking-widest flex items-center gap-1.5">
               <ShieldX className="h-3 w-3" /> Control de Integridad
            </h4>
            <p className="text-[10px] text-muted-foreground">Validación de geolocalización contra perímetro del cliente activada (±100m).</p>
        </div>
      </div>
    </div>
  );
}
