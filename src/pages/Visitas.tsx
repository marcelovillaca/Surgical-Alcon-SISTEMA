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

  // ─── Phase 4: Checkout Result State ───────────────────────────────────────
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutVisitId, setCheckoutVisitId] = useState<string | null>(null);
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

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    if (viewMode === "day") d.setDate(d.getDate() + dir);
    else if (viewMode === "week") d.setDate(d.getDate() + (dir * 7));
    else d.setMonth(d.getMonth() + dir);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const addEntry = () => setFormEntries([...formEntries, { clientId: "", date: selectedDate, time: "09:00", type: "" }]);
  const removeEntry = (idx: number) => setFormEntries(formEntries.filter((_, i) => i !== idx));
  const updateEntry = (idx: number, field: string, value: string) => {
    const newEntries = [...formEntries];
    (newEntries[idx] as any)[field] = value;
    setFormEntries(newEntries);
  };
  const resetForm = () => {
    setShowForm(false);
    setFormEntries([{ clientId: "", date: new Date().toISOString().split("T")[0], time: "09:00", type: "" }]);
    setFormObs("");
    setNeedsViatico(false);
    setViaticoTransporte(0);
    setViaticoHospedaje(0);
    setViaticoAlimentacion(0);
    setViaticoOtros(0);
    setViaticoOtrosDesc("");
  };

  const handleQuickCheckIn = async (clientId: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (!navigator.geolocation) throw new Error("GPS no disponible");
      
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej)
      );

      const { data: visit, error } = await supabase.from("visits").insert({
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
      }).select("id").single();

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

  const handleJustify = async () => {
    if (!justifyingVisit || !user) return;
    setSubmitting(true);
    try {
      const justification = `${justificationOption}${justificationObs ? ": " + justificationObs : ""}`;
      
      const { error } = await supabase.from("visits").update({
        justification,
        rescheduled_date: rescheduleDate,
        rescheduled_time: rescheduleTime
      }).eq("id", justifyingVisit.id);

      if (error) throw error;

      // Create the new visit automatically
      await supabase.from("visits").insert({
        client_id: justifyingVisit.client_id,
        visit_date: rescheduleDate,
        scheduled_time: rescheduleTime,
        visit_type: justifyingVisit.visit_type as any,
        observations: `Reprogramada por: ${justification}`,
        created_by: user.id,
        approved: true
      });

      toast({ title: "Justificación grabada", description: "Se ha creado una nueva visita reprogramada." });
      setJustifyingVisit(null);
      fetchVisitsForWeek();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleCheckOut = (visitId: string) => {
    // Validate checklist completion for technical/strategic visits
    const visit = allVisits.find(v => v.id === visitId);
    if (visit && (visit.visit_type === 'soporte_tecnico_clinico' || visit.visit_type === 'gestion_relacion')) {
        const completedCount = Object.values(activeChecklist).filter(v => v).length;
        if (completedCount < 2) {
            toast({ title: "Checklist Incompleto", description: "Debe completar al menos 2 puntos del checklist para esta visita técnica.", variant: "destructive" });
            return;
        }
    }
    
    setCheckoutVisitId(visitId);
    setShowCheckoutModal(true);
  };

  const confirmCheckOut = async () => {
    if (!checkoutVisitId || !navigator.geolocation) return;
    setSubmitting(true);
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const visit = allVisits.find(v => v.id === checkoutVisitId);
        const report = `[INTERÉS: ${interest.toUpperCase()}]\n[PRÓXIMA ACCIÓN: ${nextAction}]\n\nRESULTADO: ${resultNotes}\n\nCHECKLIST: ${checklistObs}`;
        
        const { error } = await supabase.from("visits").update({ 
          check_out_at: new Date().toISOString(), 
          check_out_lat: pos.coords.latitude, 
          check_out_lon: pos.coords.longitude,
          observations: (visit?.observations ? visit.observations + "\n\n" : "") + report
        }).eq("id", checkoutVisitId);

        if (error) throw error;
        
        toast({ title: "📍 Visita Finalizada", description: "Ejecución y resultados registrados." });
        setShowCheckoutModal(false);
        setCheckoutVisitId(null);
        setResultNotes("");
        setNextAction("");
        setActiveChecklist({});
        setChecklistObs("");
        
        if (viewMode === "day") fetchVisitsForDate(selectedDate); else fetchVisitsForWeek();
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
    }, () => {
      toast({ title: "Error", description: "No se pudo capturar la ubicación GPS para el cierre.", variant: "destructive" });
      setSubmitting(false);
    });
  };

  const handleQuickCheckIn = async (clientId: string) => {
    if (!user) return;
    if (!navigator.geolocation) {
      toast({ title: "Error", description: "Geolocalización no disponible.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const client = clients.find(c => c.id === clientId);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { data: visit, error } = await supabase.from("visits").insert({
        client_id: clientId,
        visit_date: new Date().toISOString().split("T")[0],
        scheduled_time: new Date().toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' }),
        visit_type: "promocion_producto",
        created_by: user.id,
        approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        check_in_at: new Date().toISOString(),
        check_in_lat: pos.coords.latitude,
        check_in_lon: pos.coords.longitude
      }).select("id").single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "🚀 Visita Iniciada", description: `Check-in automático en ${client?.name}` });
        setShowQuickVisit(false);
        setClientSearch("");
        if (viewMode === "day") fetchVisitsForDate(selectedDate); else fetchVisitsForWeek();
      }
      setSubmitting(false);
    }, () => {
      toast({ title: "Error", description: "Es necesario activar el GPS para el Check-in.", variant: "destructive" });
      setSubmitting(false);
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

  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [activeTimer, setActiveTimer] = useState<string>("00:00:00");

  useEffect(() => {
    const active = visits.find(v => v.check_in_at && !v.check_out_at);
    setActiveVisit(active || null);
  }, [visits]);

  useEffect(() => {
    if (!activeVisit?.check_in_at) return;
    const interval = setInterval(() => {
      const start = new Date(activeVisit.check_in_at!).getTime();
      const now = new Date().getTime();
      const diff = now - start;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setActiveTimer(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeVisit]);

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
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 animate-slide-in">
      <div className="xl:col-span-3 space-y-5">
        
        {/* SFA Active Visit Sticky Header */}
        {activeVisit && (
          <div className="sticky top-0 z-30 -mx-4 sm:mx-0 sm:rounded-2xl bg-secondary/95 backdrop-blur-md p-4 mb-4 border-b-4 border-secondary shadow-2xl animate-bounce-subtle">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                  <Navigation className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">VISITA EN CURSO</p>
                  <h3 className="text-sm font-bold text-white truncate max-w-[150px] sm:max-w-none">
                    {activeVisit.client?.name}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">DURACIÓN</p>
                  <p className="text-lg font-mono font-bold text-white leading-none">{activeTimer}</p>
                </div>
                <button 
                  onClick={() => handleCheckOut(activeVisit.id)}
                  className="bg-white text-secondary px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                  FINALIZAR
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header & Controls */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                {isGerente ? "Gestión de Visitas" : "Mi Agenda"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Control de ejecución y fuerza de ventas en campo.</p>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none no-scrollbar">
              <button
                onClick={() => { setShowQuickVisit(true); setClientSearch(""); }}
                className="whitespace-nowrap flex items-center gap-2 rounded-xl bg-secondary/10 border border-secondary/20 px-4 h-11 text-xs font-bold text-secondary shadow-lg active:scale-95 transition-all"
              >
                <Navigation className="h-4 w-4" /> Rápida
              </button>
              {!isGerente && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="whitespace-nowrap flex items-center gap-2 rounded-xl gradient-gold px-4 h-11 text-xs font-bold text-primary-foreground shadow-lg active:scale-95 transition-all"
                >
                  <Plus className="h-4 w-4" /> {showForm ? "Cerrar" : "Nueva Visita"}
                </button>
              )}
            </div>
          </div>

          {/* View Mode & Navigator */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-card/40 border border-border/40 p-2 rounded-2xl">
          <div className="flex w-full sm:w-auto p-1 bg-muted/30 rounded-xl">
            <button 
              onClick={() => setViewMode("day")}
              className={cn("flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all", viewMode === "day" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >DÍA</button>
            <button 
              onClick={() => setViewMode("week")}
              className={cn("flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all", viewMode === "week" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >SEMANA</button>
            <button 
              onClick={() => setViewMode("month")}
              className={cn("flex-1 px-4 py-2 text-xs font-bold rounded-lg transition-all", viewMode === "month" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >MES</button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <button onClick={() => navigateDate(-1)} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors h-10 w-10 flex items-center justify-center shrink-0">
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <p className="text-sm font-bold text-foreground min-w-[120px] text-center capitalize">
              {viewMode === "day" ? new Date(selectedDate + "T12:00:00").toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" }) : new Date(selectedDate + "T12:00:00").toLocaleDateString("es", { month: "long", year: "numeric" })}
            </p>

            <button onClick={() => navigateDate(1)} className="p-2 rounded-xl border border-border hover:bg-muted transition-colors h-10 w-10 flex items-center justify-center shrink-0">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Sidebar: Filters & Calendar */}
        <div className="xl:col-span-1 space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="text-center font-bold text-sm mb-2">{new Date(selectedDate + "T12:00:00").toLocaleDateString("es", { month: "long" })}</div>
            <div className="grid grid-cols-7 gap-1">
               {["L","M","M","J","V","S","D"].map(d => <div key={d} className="text-[10px] text-muted-foreground text-center">{d}</div>)}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
             <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Filtros</p>
                <Filter className="h-3 w-3 text-muted-foreground" />
             </div>
             <div className="space-y-3">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none">
                  <option value="todos">Todos los tipos</option>
                  {visitTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>

                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none">
                  <option value="todos">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="atrasada">Atrasada</option>
                  <option value="completada">Completada</option>
                </select>

                {isGerente && (
                  <select value={filterVisitor} onChange={(e) => setFilterVisitor(e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary outline-none">
                    <option value="todos">Todos los visitadores</option>
                    {visitors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                )}
             </div>
          </div>
        </div>

        {/* List Content */}
        <div className="xl:col-span-2 space-y-4">
          
          {/* New Visit Form (Inline) */}
          {showForm && (
            <div className="rounded-2xl border-2 border-primary/30 bg-card p-6 space-y-6 animate-slide-in gold-glow mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-display font-bold text-foreground">Programar Visitas</h3>
                <button onClick={addEntry} className="text-xs font-bold text-primary flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Agregar otra
                </button>
              </div>

              <div className="space-y-4">
                {formEntries.map((entry, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-border bg-background/40 space-y-4">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Visita #{idx + 1}</span>
                      {formEntries.length > 1 && (
                        <button onClick={() => removeEntry(idx)} className="text-destructive"><X className="h-4 w-4" /></button>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Cliente *</label>
                      <select value={entry.clientId} onChange={(e) => updateEntry(idx, "clientId", e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                        <option value="">Seleccionar...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.city ? `(${c.city})` : ""}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Fecha</label>
                        <input type="date" value={entry.date} onChange={(e) => updateEntry(idx, "date", e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Hora</label>
                        <input type="time" value={entry.time} onChange={(e) => updateEntry(idx, "time", e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">Objetivo de Visita</label>
                      <div className="grid grid-cols-1 gap-2">
                        {visitTypes.map(t => (
                          <button key={t.key} onClick={() => updateEntry(idx, "type", t.key)} className={cn("flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all", entry.type === t.key ? "border-primary bg-primary/5" : "border-border bg-background hover:border-muted-foreground")}>
                            <t.icon className={cn("h-4 w-4", entry.type === t.key ? "text-primary" : "text-muted-foreground")} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{t.label}</p>
                              <p className="text-[9px] text-muted-foreground truncate">{t.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Viáticos Request */}
              <div className={cn("p-4 rounded-xl border-2 transition-all", needsViatico ? "border-primary/30 bg-primary/5" : "border-border")}>
                <label className="flex items-center gap-3 cursor-pointer">
                   <div className={cn("h-5 w-5 rounded border flex items-center justify-center", needsViatico ? "bg-primary border-primary" : "border-muted-foreground")}>
                     {needsViatico && <Check className="h-3 w-3 text-white" />}
                   </div>
                   <input type="checkbox" checked={needsViatico} onChange={e => setNeedsViatico(e.target.checked)} className="hidden" />
                   <span className="text-sm font-bold flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Solicitar Viáticos</span>
                </label>
                {needsViatico && (
                  <div className="mt-4 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                    {[{l: "Transporte", v: viaticoTransporte, s: setViaticoTransporte}, {l: "Hospedaje", v: viaticoHospedaje, s: setViaticoHospedaje}, {l: "Comida", v: viaticoAlimentacion, s: setViaticoAlimentacion}, {l: "Otros", v: viaticoOtros, s: setViaticoOtros}].map(x => (
                      <div key={x.l}>
                        <label className="text-[10px] text-muted-foreground uppercase block mb-1">{x.l}</label>
                        <input type="number" value={x.v || ""} onChange={e => x.s(Number(e.target.value))} className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={resetForm} className="flex-1 h-12 rounded-xl border border-border font-bold text-muted-foreground text-sm">Cancelar</button>
                <button onClick={handleCreateVisits} disabled={submitting} className="flex-2 h-12 rounded-xl gradient-gold font-black text-primary-foreground text-sm shadow-lg shadow-primary/20">
                  {submitting ? "ENVIANDO..." : "PROGRAMAR VISITAS"}
                </button>
              </div>
            </div>
          )}

          {/* Visits List Rendering */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando agenda...</p>
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-border p-16 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center mx-auto">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-foreground">No hay visitas</h3>
                <p className="text-sm text-muted-foreground">No se encontraron registros para los filtros seleccionados.</p>
              </div>
              {!isGerente && (
                <button onClick={() => setShowForm(true)} className="gradient-gold px-6 py-2.5 rounded-xl font-bold text-primary-foreground text-sm shadow-lg">
                  Programar ahora
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVisits.map((v) => {
                const isActive = v.check_in_at && !v.check_out_at;
                const isDelayed = v.visit_date < today && !v.check_in_at && !v.justification;
                const isCompleted = !!v.check_out_at;
                const tipo = tipoMap[v.visit_type];
                const Icon = tipo?.icon || Briefcase;

                return (
                  <div key={v.id} className={cn(
                    "relative overflow-hidden rounded-2xl border-2 bg-card p-4 transition-all duration-300",
                    isActive ? "border-primary gold-glow" : "border-border/60 hover:border-border",
                    isDelayed ? "border-destructive/30 bg-destructive/5" : ""
                  )}>
                    <div className="flex gap-4">
                      {/* Left: Time Column */}
                      <div className="flex flex-col items-center justify-start w-12 shrink-0 border-r border-border/40 pr-4">
                        <p className="text-lg font-display font-black text-foreground leading-tight">{v.scheduled_time?.split(":")[0] || "--"}</p>
                        <p className="text-[10px] font-bold text-muted-foreground">{v.scheduled_time?.split(":")[1] || "00"}</p>
                        {viewMode === "week" && (
                          <p className="text-[8px] font-black uppercase text-primary mt-2">{new Date(v.visit_date + "T12:00:00").toLocaleDateString("es", { weekday: "short" })}</p>
                        )}
                      </div>

                      {/* Center: Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={cn("text-[9px] font-black uppercase tracking-[0.2em] mb-1", tipo?.color.split(" ")[1] || "text-primary")}>
                              {tipo?.label || "VISITA"}
                            </p>
                            <h3 className="text-base font-bold text-white truncate leading-none mb-1">{v.client?.name || "Sin nombre"}</h3>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" /> {v.client?.city || "Sin ciudad"}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <User className="h-2.5 w-2.5" /> {v.created_by_profile?.full_name?.split(" ")[0] || "Visitador"}
                              </span>
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <div className="shrink-0 flex flex-col items-end gap-1">
                             {v.approved === null && !isDelayed && <span className="text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full uppercase">Pendiente</span>}
                             {v.approved === true && !isCompleted && !isDelayed && <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full uppercase">Aprobada</span>}
                             {v.approved === false && <span className="text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded-full uppercase">Rechazada</span>}
                             {isDelayed && <span className="text-[8px] font-bold bg-destructive text-white px-1.5 py-0.5 rounded-full uppercase animate-pulse">Atrasada</span>}
                             {isCompleted && <span className="text-[8px] font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full uppercase">Completada</span>}
                          </div>
                        </div>

                        {v.observations && <p className="text-[10px] text-muted-foreground mt-3 bg-white/5 rounded-lg p-2 italic leading-relaxed">"{v.observations}"</p>}

                        {/* Checklist - Only for Active */}
                        {isActive && (
                          <div className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-2 animate-in slide-in-from-top-2">
                             <p className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                               <ClipboardList className="h-3 w-3" /> Checklist de Ejecución
                             </p>
                             <div className="space-y-1.5">
                               {["Ficha técnica entregada", "Demo equipo realizada", "Acuerdo de próximo paso"].map(check => (
                                 <label key={check} className="flex items-center gap-2 cursor-pointer group">
                                    <div className={cn("h-4 w-4 rounded border flex items-center justify-center transition-all", activeChecklist[check] ? "bg-primary border-primary" : "border-muted-foreground/40")}>
                                      {activeChecklist[check] && <Check className="h-2.5 w-2.5 text-black" />}
                                    </div>
                                    <input type="checkbox" className="hidden" onChange={() => setActiveChecklist({...activeChecklist, [check]: !activeChecklist[check]})} />
                                    <span className={cn("text-[10px] transition-colors", activeChecklist[check] ? "text-white font-bold" : "text-muted-foreground")}>{check}</span>
                                 </label>
                               ))}
                             </div>
                          </div>
                        )}

                        {/* Actions Mobile Optimized */}
                        <div className="mt-4 flex flex-col sm:flex-row gap-2">
                          {!isGerente && isDelayed && (
                            <button onClick={() => setJustifyingVisit(v)} className="w-full h-10 rounded-xl bg-destructive text-white text-xs font-bold active:scale-95 transition-all">JUSTIFICAR ATRASO</button>
                          )}
                          {!isGerente && v.approved === true && !v.check_in_at && !isDelayed && (
                            <button onClick={() => handleCheckIn(v.id)} className="w-full h-10 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                              <Navigation className="h-4 w-4" /> CHECK-IN 📍
                            </button>
                          )}
                          {!isGerente && isActive && (
                            <button onClick={() => handleCheckOut(v.id)} className="w-full h-10 rounded-xl gradient-gold text-primary-foreground text-xs font-black flex items-center justify-center gap-2 animate-pulse active:scale-95 transition-all">
                              <Navigation className="h-4 w-4" /> CHECK-OUT ✔️
                            </button>
                          )}
                          {isGerente && (v.approved === null || isDelayed) && (
                            <div className="flex gap-2 w-full">
                              <button onClick={() => handleApprove(v.id, true)} className="flex-1 h-10 rounded-xl bg-emerald-500 text-white text-xs font-bold active:scale-95 transition-all">APROBAR</button>
                              <button onClick={() => handleApprove(v.id, false)} className="flex-1 h-10 rounded-xl bg-destructive/20 text-destructive border border-destructive/30 text-xs font-bold active:scale-95 transition-all">RECHAZAR</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
      {/* Quick Visit Modal Overlay */}
      {showQuickVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-2 border-secondary/30 bg-card p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Navigation className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <h3 className="text-base font-display font-bold text-foreground">Visita Rápida</h3>
                  <p className="text-xs text-muted-foreground">Check-in inmediato fuera de agenda</p>
                </div>
              </div>
              <button onClick={() => { setShowQuickVisit(false); setClientSearch(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar médico o clínica..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-secondary outline-none transition-all"
                  autoFocus
                />
              </div>

              <div className="max-h-[300px] overflow-y-auto custom-sidebar-scroll space-y-2 pr-2">
                {clientSearch.length < 2 ? (
                  <p className="text-center py-8 text-xs text-muted-foreground italic">Escriba al menos 2 letras para buscar...</p>
                ) : filteredClients.length === 0 ? (
                  <p className="text-center py-8 text-xs text-muted-foreground italic">No se encontraron clientes.</p>
                ) : (
                  filteredClients.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => handleQuickCheckIn(c.id)}
                      disabled={submitting}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-secondary hover:bg-secondary/5 transition-all text-left group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" /> {c.city || "Sin ciudad"}
                        </p>
                      </div>
                      <div className="h-8 w-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-[9px] text-center text-muted-foreground uppercase tracking-widest leading-relaxed">
                Al iniciar, se capturará su ubicación GPS y hora actual para el reporte de ejecución.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🏁 CHECKOUT RESULT MODAL (Phase 4) */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border-2 border-secondary/30 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
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
              <button onClick={() => setShowCheckoutModal(false)} className="text-muted-foreground hover:text-foreground p-2">
                <X className="h-5 w-5" />
              </button>
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
                        interest === level 
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" 
                          : "border-border bg-muted/5 text-muted-foreground hover:border-muted-foreground/30"
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
                  className="w-full bg-muted/20 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none appearance-none"
                >
                  <option value="" disabled>Seleccione próximo paso...</option>
                  {nextActionOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Observaciones Finales</label>
                <textarea 
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  placeholder="Detalles sobre lo conversado, acuerdos o necesidades detectadas..."
                  className="w-full bg-muted/20 border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none min-h-[100px] resize-none"
                />
              </div>

              <button 
                onClick={confirmCheckOut}
                disabled={submitting || !nextAction || !resultNotes}
                className="w-full py-4 rounded-xl bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                CONFIRMAR Y FINALIZAR VISITA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
