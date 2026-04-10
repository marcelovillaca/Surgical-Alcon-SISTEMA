import { useState, useEffect, useMemo } from "react";
import { useWaitlist, WaitlistStatus } from "@/hooks/useWaitlist";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Users, Search, Filter, Eye, EyeOff, Calendar, ClipboardList,
  CheckCircle2, Droplets, Heart, AlertTriangle, Stethoscope, Clock,
  RefreshCw, PlayCircle, Loader2, ArrowUpDown, User,
  ArrowUp, ArrowDown, CheckCheck, ChevronDown, ChevronUp, SlidersHorizontal, X,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import MovePatientModal from "@/components/conofta/MovePatientModal";
import PostOpRecordModal from "@/components/conofta/PostOpRecordModal";
import { WaitlistEntry as WaitlistEntryType } from "@/hooks/useWaitlist";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysInStatus(entry: WaitlistEntryType): number {
  const now = new Date();
  let ref: string | undefined;
  switch (entry.status) {
    case "pendente":   ref = entry.created_at; break;
    case "informado":  ref = entry.informed_at  || entry.created_at; break;
    case "apto":       ref = entry.apto_at      || entry.created_at; break;
    case "agendado":   ref = entry.scheduled_at || entry.created_at; break;
    case "operado":    ref = entry.operated_at  || entry.created_at; break;
    default:           ref = entry.created_at;
  }
  return Math.max(0, differenceInDays(now, new Date(ref || Date.now())));
}

function getDaysBadge(days: number, status: WaitlistStatus) {
  if (["concluido", "cancelado"].includes(status)) return null;
  const cls =
    days < 15 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    days < 30 ? "text-amber-400  bg-amber-500/10  border-amber-500/20" :
                "text-rose-400   bg-rose-500/10   border-rose-500/20 animate-pulse";
  const Icon = days < 15 ? Clock : AlertTriangle;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border", cls)}>
      <Icon className="h-3 w-3" /> {days}d
    </span>
  );
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_META: Record<WaitlistStatus, { label: string; badgeClass: string }> = {
  pendente:  { label: "Ingresado",      badgeClass: "bg-amber-500/10  text-amber-500  border-amber-500/20"  },
  informado: { label: "Pend. Pre-Op",   badgeClass: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  apto:      { label: "Listo / Apto",   badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  agendado:  { label: "Agendado",       badgeClass: "bg-blue-500/10   text-blue-500   border-blue-500/20"   },
  operado:   { label: "Operado (AV)",   badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  concluido: { label: "Finalizado",     badgeClass: "bg-zinc-500/10   text-zinc-400   border-zinc-500/20"   },
  cancelado: { label: "Cancelado",      badgeClass: "bg-rose-500/10   text-rose-500   border-rose-500/20"   },
};

// Apenas estes aparecem na lista geral (concluido excluído)
const ACTIVE_STATUSES: WaitlistStatus[] = ["pendente", "informado", "apto", "agendado", "operado"];

const ROW_BG: Record<WaitlistStatus, string> = {
  pendente:  "bg-amber-500/[0.02]",
  informado: "bg-purple-500/[0.02]",
  apto:      "bg-emerald-500/[0.04] border-l-2 border-l-emerald-500/40",
  agendado:  "bg-blue-500/[0.03]",
  operado:   "bg-indigo-500/[0.02]",
  concluido: "",
  cancelado: "opacity-50",
};

const STATUS_ORDER: Record<WaitlistStatus, number> = {
  operado: 1, agendado: 2, apto: 3, informado: 4, pendente: 5,
  concluido: 6, cancelado: 7,
};

type SortField = "date_asc" | "date_desc" | "status";

// ─── Confirm Surgery Modal (agendado → operado) ────────────────────────────────
function ConfirmSurgeryModal({
  entry, onClose, onConfirm,
}: { entry: WaitlistEntryType | null; onClose: () => void; onConfirm: (date: string, lensId?: string) => Promise<void> }) {
  const [date, setDate] = useState(entry?.surgery_date || new Date().toISOString().split("T")[0]);
  const [lensId, setLensId] = useState<string>("");
  const [availableLenses, setAvailableLenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLenses, setLoadingLenses] = useState(false);

  useEffect(() => {
    if (entry) {
      setDate(entry.actual_surgery_date || (entry.surgery_date ?? new Date().toISOString().split("T")[0]));
      fetchAvailableLenses(entry.assigned_institution_id || entry.institution_id);
    }
  }, [entry]);

  const fetchAvailableLenses = async (instId: string) => {
    setLoadingLenses(true);
    try {
      // Busca produtos da categoria 'lente' que estão ativos
      const { data: lenses } = await supabase
        .from('conofta_products')
        .select('id, name, sku, unit')
        .eq('category', 'lente')
        .eq('is_active', true)
        .order('name');
      
      setAvailableLenses(lenses || []);
    } finally {
      setLoadingLenses(false);
    }
  };

  const handle = async () => {
    if (!date) return toast.error("La fecha es obligatoria");
    setLoading(true);
    try {
      await onConfirm(date, lensId || undefined);
      onClose();
    }
    catch (err: any) {
      console.error(err);
      toast.error("Error al confirmar cirugía");
    }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={!!entry} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[400px] border-border bg-card/95 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden p-0">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <PlayCircle className="h-5 w-5 text-blue-400" />
            </div>
            Confirmar Realización de Cirugía
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {entry?.patient?.firstname} {entry?.patient?.lastname} — Ojo {entry?.target_eye}
          </p>
        </DialogHeader>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Fecha planeada: <span className="font-bold text-foreground">
              {entry?.surgery_date ? format(parseISO(entry.surgery_date), "dd/MM/yyyy") : "N/D"}
            </span>
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Fecha Real de Realización *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 bg-background/50 border-white/5"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Lente Intraocular Implantado (Stock)</Label>
              <Select value={lensId} onValueChange={setLensId}>
                <SelectTrigger className="h-12 bg-background/50 border-white/5">
                  <SelectValue placeholder={loadingLenses ? "Cargando catálogo..." : "Seleccione lente..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin registrar lente ahora</SelectItem>
                  {availableLenses.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic">Opcional: Al seleccionar una lente, se descontará automáticamente del stock de la sede.</p>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-400">
              Al confirmar, el paciente pasará a estado <strong>Operado</strong>, el stock de la lente será debitado y se esperará el registro de AV post-op.
            </div>
          </div>
        </div>
        <DialogFooter className="p-6 pt-0 gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1 rounded-xl">Cancelar</Button>
          <Button onClick={handle} disabled={loading || !date} className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg">
            {loading ? <Loader2 className="animate-spin" /> : "Confirmar Cirugía Realizada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ConoftaLista() {
  const { entries, loading, updateEntryStatus, refresh } = useWaitlist();
  const { isGerente, isAdminConofta, isCoordinadorLocal, role, institutionId, institutionName } = useUserRole();
  const navigate = useNavigate();

  const [searchTerm,          setSearchTerm]          = useState("");
  const [selectedEntry,       setSelectedEntry]       = useState<WaitlistEntryType | null>(null);
  const [postOpEntry,         setPostOpEntry]         = useState<WaitlistEntryType | null>(null);
  const [confirmSurgEntry,    setConfirmSurgEntry]    = useState<WaitlistEntryType | null>(null);
  const [showSensitive,       setShowSensitive]       = useState<Record<string, boolean>>({});
  const [institutions,        setInstitutions]        = useState<any[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState("all");
  const [selectedMonth,       setSelectedMonth]       = useState("all");
  const [selectedStatus,      setSelectedStatus]      = useState("all");

  const [localEntries,        setLocalEntries]        = useState<WaitlistEntryType[]>([]);
  const [sortField,           setSortField]           = useState<SortField>("status");
  const [showFilters,         setShowFilters]         = useState(true);

  useEffect(() => {
    supabase.from("institutions").select("*").order("name").then(({ data }) => setInstitutions(data || []));
  }, []);

  useEffect(() => { setLocalEntries(entries); }, [entries]);

  // ── helpers ──────────────────────────────────────────────────────────────
  const getInstitutionName = (id: string) =>
    institutions.find((i) => i.id === id)?.name ?? id.slice(0, 10) + "…";

  const maskData = (v?: string) => !v ? "N/A" : v.slice(0, 3) + "****" + v.slice(-2);
  const toggleSensitive = (id: string) => setShowSensitive(p => ({ ...p, [id]: !p[id] }));

  const isEntryApto = (e: WaitlistEntryType) =>
    !!(e.exam_hemograma && e.exam_glicemia && e.exam_hba1c && e.exam_crasis && e.exam_orina);

  // ── base entries — EXCLUI concluídos e cancelados da lista geral ──────────
  const baseEntries = useMemo(() =>
    localEntries.filter(e => {
      // Filtro de instituição para coordenador local
      if (role === "coordinador_local" && institutionId && e.institution_id !== institutionId) return false;
      
      // Se não há filtro específico, omitimos concluídos e cancelados da lista geral (Default)
      if (selectedStatus === "all") {
        return ACTIVE_STATUSES.includes(e.status);
      }
      
      // Se o usuário selecionou um filtro específico (como clicando no passo "Finalizado" do funil),
      // permitimos que ele apareça na base para que o filteredEntries o mostre.
      return true;
    }),
  [localEntries, role, institutionId, selectedStatus]);

  // scopedEntries — apenas filtro de instituição, usado para as contagens do funil serem estáveis
  const scopedEntries = useMemo(() =>
    localEntries.filter(e => {
      if (role === "coordinador_local" && institutionId && e.institution_id !== institutionId) return false;
      return true;
    }),
  [localEntries, role, institutionId]);

  const funnelCounts = useMemo(() => ({
    pendente:  scopedEntries.filter(e => e.status === "pendente").length,
    informado: scopedEntries.filter(e => e.status === "informado").length,
    apto:      scopedEntries.filter(e => e.status === "apto").length,
    agendado:  scopedEntries.filter(e => e.status === "agendado").length,
    operado:   scopedEntries.filter(e => e.status === "operado").length,
    concluido: scopedEntries.filter(e => e.status === "concluido").length,
    alertas:   scopedEntries.filter(e => ACTIVE_STATUSES.includes(e.status) && getDaysInStatus(e) > 30).length,
  }), [scopedEntries]);

  // ── filtered + sorted ─────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    let list = baseEntries.filter(e => {
      const name = `${e.patient?.firstname} ${e.patient?.lastname}`.toLowerCase();
      if (!name.includes(searchTerm.toLowerCase()) && !e.patient?.cedula.includes(searchTerm)) return false;
      if (selectedInstitution !== "all" && e.institution_id !== selectedInstitution) return false;
      if (selectedStatus !== "all" && e.status !== selectedStatus) return false;
      if (selectedMonth !== "all") {
        const d = parseISO(e.created_at || "");
        const [y, m] = selectedMonth.split("-");
        if (d.getFullYear() !== parseInt(y) || d.getMonth() !== parseInt(m)) return false;
      }
      return true;
    });

    // Ordenação
    list = [...list].sort((a, b) => {
      if (sortField === "date_asc") {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      if (sortField === "date_desc") {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      // status: por prioridade (operado primeiro)
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    });

    return list;
  }, [baseEntries, searchTerm, selectedInstitution, selectedStatus, selectedMonth, sortField]);

  // ── update exam toggle — só quando informado ──────────────────────────────
  const updateExam = async (entryId: string, field: string, value: boolean, currentStatus: WaitlistStatus) => {
    if (currentStatus !== "informado") return; // só edita quando pendente pre-op
    try {
      await supabase.from("conofta_waitlist" as any).update({ [field]: value }).eq("id", entryId);
      setLocalEntries(prev => prev.map(e => e.id === entryId ? { ...e, [field]: value } : e));
      const updated = localEntries.find(e => e.id === entryId);
      if (updated && value && field.startsWith("exam_")) {
        const projected = { ...updated, [field]: true };
        if (isEntryApto(projected) && updated.status === "informado") {
          toast.success("✅ ¡Todos los exámenes completos! Puedes marcar al paciente como Apto.");
        }
      }
    } catch { toast.error("Error al actualizar examen"); }
  };

  // ── action button logic ───────────────────────────────────────────────────
  const getNextAction = (e: WaitlistEntryType) => {
    switch (e.status) {
      case "pendente":
        return { label: "Solicitar Pre-Op", icon: <ClipboardList className="h-4 w-4" />, color: "text-purple-400 border-purple-500/30 hover:bg-purple-500/10" };
      case "informado":
        if (isEntryApto(e))
          return { label: "Marcar Apto ✓",   icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 font-bold" };
        return { label: "Exámenes Incompletos", icon: <ClipboardList className="h-4 w-4" />, color: "text-zinc-500 border-zinc-700 cursor-not-allowed", disabled: true };
      case "apto":
        return { label: "Agendar Cirugía",   icon: <Calendar className="h-4 w-4" />, color: "text-blue-400 border-blue-500/30 hover:bg-blue-500/10" };
      case "agendado":
        return { 
          label: "Confirmar Cirugía", 
          icon: <PlayCircle className="h-4 w-4" />, 
          color: "text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10",
          hasEdit: true // Add flag for extra edit button
        };
      case "operado":
        return { label: "Registrar AV Final", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" };
      default:
        return null;
    }
  };

  // ── advance status ────────────────────────────────────────────────────────
  const advanceStatus = async (entry: WaitlistEntryType) => {
    switch (entry.status) {
      case "pendente":
        await updateEntryStatus(entry.id!, "informado");
        break;
      case "informado":
        if (!isEntryApto(entry)) {
          toast.warning("Completa todos los exámenes primero (H, G, A1c, C, O)");
          return;
        }
        await updateEntryStatus(entry.id!, "apto");
        break;
      case "apto":
        setSelectedEntry(entry);
        break;
      case "agendado":
        setConfirmSurgEntry(entry);
        break;
      case "operado":
        setPostOpEntry(entry);
        break;
      default:
        break;
    }
  };

  const handleConfirmSurgery = async (actualDate: string, lensId?: string) => {
    if (!confirmSurgEntry?.id) return;
    
    // Prepara os metadados adicionais (lente)
    const extraData: any = {
      actual_surgery_date: actualDate,
      operated_at: new Date().toISOString(),
    };

    if (lensId && lensId !== "none") {
      extraData.lens_product_id = lensId;
      extraData.lens_qty = 1;
      extraData.lens_registered_at = new Date().toISOString();
      extraData.lens_registered_by = (await supabase.auth.getUser()).data.user?.id;
    }

    await updateEntryStatus(confirmSurgEntry.id, "operado", extraData);
    refresh();
  };



  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1);
    if (d > new Date()) return null;
    return { label: format(d, "MMMM yyyy"), value: `${d.getFullYear()}-${d.getMonth()}` };
  }).filter(Boolean) as { label: string; value: string }[];

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => setSortField(field)}
      className={cn(
        "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
        sortField === field
          ? "bg-primary/10 text-primary border-primary/30"
          : "text-muted-foreground border-white/5 hover:bg-white/5"
      )}
    >
      {field === "date_asc" ? <ArrowUp className="h-3 w-3" /> : field === "date_desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
      {label}
    </button>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-emerald flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Users className="h-6 w-6 text-white" />
            </div>
            Lista General de Pacientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedStatus === "concluido" 
              ? `Visualizando ${filteredEntries.length} casos finalizados`
              : `${baseEntries.length} pacientes activos · Finalizados salen de esta lista automática`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 text-xs border-border/50" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Actualizar
          </Button>
          <Button className="gradient-emerald shadow-lg" onClick={() => navigate("/conofta/waitlist")}>
            <ClipboardList className="mr-2 h-4 w-4" /> Nueva Ficha
          </Button>
        </div>
      </div>

      {/* ── Funil visual ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card/40 p-4 overflow-x-auto">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Jornada del Paciente — Paso a Paso</p>
        <div className="flex items-center gap-1 min-w-max">
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-none">
            {[
              { label: "1. Ingresado",    desc: "Ficha registrada",       color: "bg-amber-500/20 text-amber-400 border-amber-500/30",    count: funnelCounts.pendente,  status: "pendente" },
              { label: "2. Pend. Pre-Op", desc: "Solicitar exámenes",     color: "bg-purple-500/20 text-purple-400 border-purple-500/30", count: funnelCounts.informado, status: "informado" },
              { label: "3. Apto",         desc: "Pre-op completo",        color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", count: funnelCounts.apto,   status: "apto" },
              { label: "4. Agendado",     desc: "Fecha + cirujano",       color: "bg-blue-500/20 text-blue-400 border-blue-500/30",       count: funnelCounts.agendado,  status: "agendado" },
              { label: "5. Operado",      desc: "Registrar AV post-op",   color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", count: funnelCounts.operado,   status: "operado" },
              { label: "6. Final.",       desc: "Caso cerrado",           color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",       count: funnelCounts.concluido, status: "concluido" },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSelectedStatus(selectedStatus === step.status ? "all" : step.status)}
                  className={cn(
                    "flex flex-col items-center px-3 py-2 rounded-xl border text-center min-w-[90px] transition-all active:scale-[0.97]",
                    step.color,
                    selectedStatus === step.status && "ring-2 ring-white/20"
                  )}
                >
                  <span className="text-sm font-black">{step.count}</span>
                  <span className="text-[10px] font-bold leading-tight">{step.label}</span>
                  <span className="text-[9px] opacity-70 leading-tight mt-0.5 hidden sm:block">{step.desc}</span>
                </button>
                {i < 5 && <span className="text-zinc-600 text-lg shrink-0">›</span>}
              </div>
            ))}
          </div>
        </div>
        {/* Leyenda */}
        <div className="flex items-center gap-6 mt-3 pt-3 border-t border-white/5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Leyenda:</p>
          <div className="flex gap-4">
            {[
              { cls: "text-emerald-400", label: "< 15 días — Normal" },
              { cls: "text-amber-400",   label: "15-30 días — Atención" },
              { cls: "text-rose-400",    label: "> 30 días — CRÍTICO" },
            ].map(l => (
              <span key={l.label} className={cn("text-[10px] font-bold flex items-center gap-1", l.cls)}>
                <Clock className="h-3 w-3" /> {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Alerta crítica ──────────────────────────────────────────────── */}
      {funnelCounts.alertas > 0 && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-4">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
          <p className="text-sm font-bold text-rose-400 flex-1">
            {funnelCounts.alertas} pacientes sin avance por más de <strong>30 días</strong> — Requieren atención urgente.
          </p>
          <Button size="sm" variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs shrink-0"
            onClick={() => setSelectedStatus("all")}>Ver todos</Button>
        </div>
      )}

      {/* ── Filter Bar — horizontal colapsável ───────────────────────────── */}
      <div className="rounded-2xl border border-border/50 bg-card/60 ring-1 ring-white/5 overflow-hidden">
        {/* Barra de controle */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {/* Busca sempre visível */}
            <div className="relative min-w-[200px] flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Nombre o cédula..."
                className="pl-8 bg-background/50 h-9 border-white/5 text-xs w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filtros colapsáveis */}
            {showFilters && (
              <>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-9 bg-background/50 border-white/5 text-xs w-[160px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {ACTIVE_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro de sede: dropdown para gerente/admin, badge fixo para coordinador_local */}
                {isCoordinadorLocal ? (
                  <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                    <span className="text-[10px] font-bold text-blue-400">📍 {institutionName ?? "Mi Sede"}</span>
                  </div>
                ) : (
                  <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                    <SelectTrigger className="h-9 bg-background/50 border-white/5 text-xs w-[180px]">
                      <SelectValue placeholder="Sede" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las sedes</SelectItem>
                      {institutions.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-9 bg-background/50 border-white/5 text-xs w-[160px]">
                    <SelectValue placeholder="Mes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los meses</SelectItem>
                    {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* Botão limpar filtros — aparece se há algum ativo */}
                {(selectedStatus !== "all" || selectedInstitution !== "all" || selectedMonth !== "all" || searchTerm) && (
                  <button
                    onClick={() => { setSelectedStatus("all"); setSelectedInstitution("all"); setSelectedMonth("all"); setSearchTerm(""); }}
                    className="flex items-center gap-1 text-[10px] font-bold text-rose-400 border border-rose-500/20 rounded-lg px-2.5 py-1.5 hover:bg-rose-500/10 transition-all"
                  >
                    <X className="h-3 w-3" /> Limpiar
                  </button>
                )}
              </>
            )}
          </div>

          {/* Controles direita: ordenação + toggle filtros */}
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span className="text-[10px] text-muted-foreground font-bold uppercase hidden sm:block">Ord.:</span>
            <SortButton field="status"    label="Status" />
            <SortButton field="date_asc"  label="↑ Fecha" />
            <SortButton field="date_desc" label="↓ Fecha" />

            <div className="w-px h-5 bg-white/10 mx-1" />

            <button
              onClick={() => setShowFilters(f => !f)}
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all",
                showFilters
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-muted-foreground border-white/10 hover:bg-white/5"
              )}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span className="hidden sm:inline">{showFilters ? "Ocultar" : "Filtros"}</span>
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Indicadores de filtros ativos */}
        {(selectedStatus !== "all" || selectedInstitution !== "all" || selectedMonth !== "all") && (
          <div className="px-4 pb-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-bold text-muted-foreground uppercase">Filtros activos:</span>
            {selectedStatus !== "all" && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                {STATUS_META[selectedStatus as WaitlistStatus]?.label}
                <button onClick={() => setSelectedStatus("all")} className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {selectedInstitution !== "all" && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                {institutions.find(i => i.id === selectedInstitution)?.name ?? "Sede"}
                <button onClick={() => setSelectedInstitution("all")} className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {selectedMonth !== "all" && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                {months.find(m => m.value === selectedMonth)?.label ?? "Mes"}
                <button onClick={() => setSelectedMonth("all")} className="hover:text-white"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── DESKTOP: Tabela ──────────────────────────────────────────────── */}
      <Card className="hidden lg:block border-border/50 bg-card/80 overflow-hidden shadow-2xl ring-1 ring-white/5">
            {loading && (
              <div className="flex items-center justify-center h-24">
                <div className="h-6 w-6 rounded-lg gradient-emerald animate-pulse" />
              </div>
            )}
            {!loading && filteredEntries.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Users className="h-10 w-10 text-zinc-700" />
                <p className="text-sm text-muted-foreground">No hay pacientes activos con los filtros actuales</p>
                <Button variant="ghost" size="sm" className="text-xs"
                  onClick={() => { setSelectedStatus("all"); setSearchTerm(""); setSelectedInstitution("all"); }}>
                  Limpiar filtros
                </Button>
              </div>
            )}
            {!loading && filteredEntries.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-muted/10 border-b border-white/5 text-[10px] font-bold text-muted-foreground uppercase">

                      <th className="p-3 min-w-[100px]">Status</th>
                      <th className="p-3">Paciente / Sede</th>
                      <th className="p-3 text-center">Ojo</th>
                      <th className="p-3">Cédula</th>
                      <th className="p-3">Alertas</th>
                      <th className="p-3 text-center">Exámenes Pre-Op</th>
                      <th className="p-3 text-center min-w-[90px]">Fecha Agend.</th>
                      <th className="p-3">Médico</th>
                      <th className="p-3 text-center">Días</th>
                      <th className="p-3 text-right">Próxima Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {filteredEntries.map((entry) => {
                      const action = getNextAction(entry);
                      const days   = getDaysInStatus(entry);
                      const isApto = isEntryApto(entry);


                      return (
                        <tr key={entry.id} className={cn("hover:bg-white/[0.05] transition-all", ROW_BG[entry.status])}>


                          {/* STATUS — 1ª coluna */}
                          <td className="p-3">
                            <Badge variant="outline" className={cn("text-[9px] font-bold whitespace-nowrap", STATUS_META[entry.status].badgeClass)}>
                              {STATUS_META[entry.status].label}
                            </Badge>
                          </td>

                          {/* Paciente + Sede */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xs border border-white/5 shrink-0">
                                {entry.patient?.firstname?.[0]}
                              </div>
                              <div>
                                <p className="font-bold text-foreground leading-tight truncate max-w-[130px] text-[12px]">
                                  {entry.patient?.firstname} {entry.patient?.lastname}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                                  {getInstitutionName(entry.institution_id)}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Ojo — apenas badge, sem duplicidade */}
                          <td className="p-3 text-center">
                            <Badge className={cn("text-[9px] font-black h-5 px-1.5",
                              entry.target_eye === "OD"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            )}>
                              {entry.target_eye || "—"}
                            </Badge>
                          </td>

                          {/* Cédula mascarada */}
                          <td className="p-3">
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span className="bg-zinc-800/80 px-1.5 py-0.5 rounded text-zinc-300 border border-white/5">
                                {showSensitive[entry.id!] ? entry.patient?.cedula : maskData(entry.patient?.cedula)}
                              </span>
                              <button onClick={() => toggleSensitive(entry.id!)} className="text-muted-foreground hover:text-primary">
                                {showSensitive[entry.id!] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </td>

                          {/* Alertas clínicas */}
                          <td className="p-3">
                            <div className="flex gap-1.5">
                              {entry.has_diabetes && (
                                <TooltipProvider><Tooltip><TooltipTrigger>
                                  <Droplets className="h-4 w-4 text-rose-500" />
                                </TooltipTrigger><TooltipContent>Diabético</TooltipContent></Tooltip></TooltipProvider>
                              )}
                              {entry.has_hipertensao && (
                                <TooltipProvider><Tooltip><TooltipTrigger>
                                  <Heart className="h-4 w-4 text-orange-500" />
                                </TooltipTrigger><TooltipContent>Hipertenso</TooltipContent></Tooltip></TooltipProvider>
                              )}
                              {entry.has_anticoagulados && (
                                <TooltipProvider><Tooltip><TooltipTrigger>
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                </TooltipTrigger><TooltipContent>Anticoagulado</TooltipContent></Tooltip></TooltipProvider>
                              )}
                              {!entry.has_diabetes && !entry.has_hipertensao && !entry.has_anticoagulados && (
                                <span className="text-[10px] text-zinc-700">—</span>
                              )}
                            </div>
                          </td>

                          {/* Exámenes Pre-Op — editáveis APENAS quando informado, check quando apto */}
                          <td className="p-3">
                            <div className="flex flex-col items-center gap-1">
                              {entry.status === "apto" || (entry.status !== "informado" && isApto) ? (
                                // Paciente já apto: mostra check verde
                                <div className="flex items-center gap-1">
                                  <CheckCheck className="h-4 w-4 text-emerald-400" />
                                  <span className="text-[10px] text-emerald-400 font-bold">Pre-Op OK</span>
                                </div>
                              ) : entry.status === "informado" ? (
                                // Pendente pre-op: checkboxes editáveis
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex gap-1">
                                    {[
                                      { key: "exam_hemograma", lbl: "H",   tip: "Hemograma" },
                                      { key: "exam_glicemia",  lbl: "G",   tip: "Glicemia" },
                                      { key: "exam_hba1c",     lbl: "A1c", tip: "HbA1c" },
                                      { key: "exam_crasis",    lbl: "C",   tip: "Crasis" },
                                      { key: "exam_orina",     lbl: "O",   tip: "Orina" },
                                    ].map(ex => (
                                      <TooltipProvider key={ex.key}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => updateExam(entry.id!, ex.key, !(entry as any)[ex.key], entry.status)}
                                              className={cn(
                                                "h-6 min-w-[26px] rounded px-1 text-[9px] font-bold border transition-all hover:scale-110",
                                                (entry as any)[ex.key]
                                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                                  : "bg-zinc-800/50 text-zinc-600 border-white/5"
                                              )}
                                            >{ex.lbl}</button>
                                          </TooltipTrigger>
                                          <TooltipContent>{ex.tip}: {(entry as any)[ex.key] ? "✓ Completo" : "✗ Pendiente"}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    ))}
                                  </div>
                                  <span className="text-[9px] text-zinc-600">
                                    {[entry.exam_hemograma, entry.exam_glicemia, entry.exam_hba1c, entry.exam_crasis, entry.exam_orina].filter(Boolean).length}/5
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-zinc-700">—</span>
                              )}
                            </div>
                          </td>

                          {/* Data Agendada */}
                          <td className="p-3 text-center">
                            {entry.surgery_date ? (
                              <span className="text-[10px] font-bold text-blue-400 flex items-center justify-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(entry.surgery_date), "dd/MM/yy")}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-700">—</span>
                            )}
                          </td>

                          {/* Médico — sem repetir o olho (já está na coluna Ojo) */}
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5">
                              {(entry as any).surgeon?.name ? (
                                <div className="flex items-center gap-1 text-[10px] text-foreground font-bold">
                                  <User className="h-3 w-3 shrink-0 text-primary/60" />
                                  <span className="truncate max-w-[120px]">{(entry as any).surgeon?.name}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-zinc-700 italic">Cirujano: Sin asignar</span>
                              )}
                              
                              {entry.requesting_doctor && (
                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground opacity-80">
                                  <Stethoscope className="h-2.5 w-2.5 shrink-0 text-amber-500/60" />
                                  <span className="truncate max-w-[120px]">Sol: {entry.requesting_doctor}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Días en status */}
                          <td className="p-3 text-center">{getDaysBadge(days, entry.status)}</td>

                          {/* Próxima Acción */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {action && !action.disabled && (
                                <div className="flex items-center gap-1.5">
                                  {(action as any).hasEdit && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline" size="sm"
                                            className="h-9 w-9 p-0 border-white/10 hover:bg-white/5 rounded-xl text-zinc-400"
                                            onClick={() => setSelectedEntry(entry)}
                                          >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Editar Agendamiento / Sede</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  <Button
                                    variant="ghost" size="sm"
                                    className={cn("h-9 px-3 gap-1.5 transition-all border rounded-xl text-[10px] font-bold uppercase hover:scale-[1.02]", action.color)}
                                    onClick={() => advanceStatus(entry)}
                                  >
                                    {action.icon}
                                    <span className="hidden xl:inline">{action.label}</span>
                                  </Button>
                                </div>
                              )}
                              {action?.disabled && (
                                <span className={cn("text-[10px] font-bold px-2 py-1 border rounded-lg", action.color)}>
                                  {action.label}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

      {/* ── MOBILE: Cards ────────────────────────────────────────────────── */}
      <div className="lg:hidden space-y-3">
        {loading && (
          <div className="flex items-center justify-center h-24">
            <div className="h-6 w-6 rounded-lg gradient-emerald animate-pulse" />
          </div>
        )}
        {!loading && filteredEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Users className="h-10 w-10 text-zinc-700" />
            <p className="text-sm text-muted-foreground text-center">No hay pacientes activos con los filtros actuales</p>
            <Button variant="ghost" size="sm" className="text-xs h-10"
              onClick={() => { setSelectedStatus("all"); setSearchTerm(""); setSelectedInstitution("all"); }}>
              Limpiar filtros
            </Button>
          </div>
        )}
        {!loading && filteredEntries.map((entry) => {
          const action = getNextAction(entry);
          const days   = getDaysInStatus(entry);
          const isApto = isEntryApto(entry);
          return (
            <div key={entry.id} className={cn("rounded-2xl border border-border/50 bg-card/80 overflow-hidden shadow-lg ring-1 ring-white/5", ROW_BG[entry.status])}>
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-black text-sm border border-white/10 shrink-0">
                    {entry.patient?.firstname?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm leading-tight truncate">
                      {entry.patient?.firstname} {entry.patient?.lastname}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{getInstitutionName(entry.institution_id)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {getDaysBadge(days, entry.status)}
                  <Badge variant="outline" className={cn("text-[9px] font-bold whitespace-nowrap", STATUS_META[entry.status].badgeClass)}>
                    {STATUS_META[entry.status].label}
                  </Badge>
                </div>
              </div>

              {/* Card Body */}
              <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Ojo:</span>
                  <Badge className={cn("text-[9px] font-black h-5 px-1.5",
                    entry.target_eye === "OD" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                  )}>{entry.target_eye || "—"}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">CI:</span>
                  <span className="font-mono text-zinc-300 text-[11px] truncate">
                    {showSensitive[entry.id!] ? entry.patient?.cedula : maskData(entry.patient?.cedula)}
                  </span>
                  <button onClick={() => toggleSensitive(entry.id!)} className="text-muted-foreground p-1 shrink-0">
                    {showSensitive[entry.id!] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
                {(entry as any).surgeon?.name && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <User className="h-3 w-3 text-primary/60 shrink-0" />
                    <span className="text-foreground font-semibold truncate">{(entry as any).surgeon?.name}</span>
                  </div>
                )}
                {entry.surgery_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-blue-400 shrink-0" />
                    <span className="text-blue-400 font-bold">{format(parseISO(entry.surgery_date), "dd/MM/yy")}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  {entry.has_diabetes && <Droplets className="h-3.5 w-3.5 text-rose-500" />}
                  {entry.has_hipertensao && <Heart className="h-3.5 w-3.5 text-orange-500" />}
                  {entry.has_anticoagulados && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                  {!entry.has_diabetes && !entry.has_hipertensao && !entry.has_anticoagulados && (
                    <span className="text-zinc-700 text-[10px]">Sin alertas</span>
                  )}
                </div>
                {entry.status === "informado" && (
                  <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">Pre-Op:</span>
                    {[
                      { key: "exam_hemograma", lbl: "H" },
                      { key: "exam_glicemia", lbl: "G" },
                      { key: "exam_hba1c", lbl: "A1c" },
                      { key: "exam_crasis", lbl: "C" },
                      { key: "exam_orina", lbl: "O" },
                    ].map(ex => (
                      <button key={ex.key}
                        onClick={() => updateExam(entry.id!, ex.key, !(entry as any)[ex.key], entry.status)}
                        className={cn("h-7 min-w-[28px] rounded px-1.5 text-[10px] font-bold border transition-all active:scale-95",
                          (entry as any)[ex.key] ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-zinc-800/50 text-zinc-600 border-white/5"
                        )}
                      >{ex.lbl}</button>
                    ))}
                    <span className="text-[10px] text-zinc-600">
                      {[entry.exam_hemograma, entry.exam_glicemia, entry.exam_hba1c, entry.exam_crasis, entry.exam_orina].filter(Boolean).length}/5
                    </span>
                  </div>
                )}
                {(entry.status === "apto" || (entry.status !== "informado" && isApto)) && (
                  <div className="col-span-2 flex items-center gap-1.5">
                    <CheckCheck className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold text-[11px]">Exámenes Pre-Op OK</span>
                  </div>
                )}
              </div>

              {/* Card Footer — Ação principal mobile */}
              {action && (
                <div className="px-4 pb-4 pt-1 flex gap-2">
                  {(action as any).hasEdit && (
                    <Button variant="outline" size="sm" className="h-12 w-12 p-0 border-white/10 shrink-0 rounded-xl" onClick={() => setSelectedEntry(entry)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  {!action.disabled ? (
                    <Button
                      className={cn("flex-1 h-12 gap-2 text-sm font-bold rounded-xl border transition-all active:scale-[0.98]", action.color)}
                      variant="ghost"
                      onClick={() => advanceStatus(entry)}
                    >
                      {action.icon}
                      {action.label}
                    </Button>
                  ) : (
                    <div className={cn("flex-1 h-12 flex items-center justify-center rounded-xl border text-sm font-bold", action.color)}>
                      {action.label}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <MovePatientModal
        entry={selectedEntry}
        onOpenChange={() => setSelectedEntry(null)}
        onSuccess={refresh}
        updateEntryStatus={updateEntryStatus}
        isAdmin={isAdminConofta}
      />

      <ConfirmSurgeryModal
        entry={confirmSurgEntry}
        onClose={() => setConfirmSurgEntry(null)}
        onConfirm={handleConfirmSurgery}
      />

      <PostOpRecordModal
        entry={postOpEntry}
        onOpenChange={() => setPostOpEntry(null)}
        onSuccess={refresh}
      />
    </div>
  );
}
