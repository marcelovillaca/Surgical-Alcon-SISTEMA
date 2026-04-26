import { useState, useEffect } from "react";
import { useWaitlist, Patient } from "@/hooks/useWaitlist";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  MapPin,
  Loader2,
  ClipboardCheck,
  Stethoscope,
  ShieldCheck,
  AlertTriangle,
  Eye,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SNELLEN_VALUES = [
  "20/200", "20/100", "20/70", "20/50", "20/40",
  "20/30", "20/25", "20/20", "20/15", "20/10",
];

const LOW_VISION_VALUES = [
  "Cuenta dedos (CD)",
  "Movimiento de manos (MM)",
  "Percepción de luz (PL)",
  "Sin percepción de luz (SPL)",
];

const STEPS = [
  { id: 1, label: "Paciente",    icon: Users },
  { id: 2, label: "Evaluación",  icon: Eye },
  { id: 3, label: "Confirmación", icon: ShieldCheck },
];

export default function Waitlist() {
  const { addPatientToWaitlist, surgeons } = useWaitlist();
  const { role, institutionId } = useUserRole();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lowVisionOD, setLowVisionOD] = useState(false);
  const [lowVisionOS, setLowVisionOS] = useState(false);
  const [solicitantes, setSolicitantes] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      cedula: "",
      firstname: "",
      lastname: "",
      address: "",
      city: "",
      phone: "",
      email: "",
      institution_id: "",
      notes: "",
      has_diabetes: false,
      has_hipertensao: false,
      has_anticoagulados: false,
      requesting_doctor: "",
      eye_selection: "OD",
      pre_op_va_od: "",
      pre_op_va_os: "",
      lgpd_consent: false,
      surgeon_id: "",
      exam_preop_complete: false,
    },
  });

  const lgpdConsent    = watch("lgpd_consent");
  const selectedEye    = watch("eye_selection");
  const watchedInst    = watch("institution_id");

  useEffect(() => {
    async function fetchInstitutions() {
      // Use conofta_institutions exclusively — separate from Alcon CRM's `institutions` table
      const { data } = await (supabase.from("conofta_institutions" as any).select("id, name, city").eq("is_active", true).order("name") as any);
      setInstitutions(data || []);
      if (role === "coordinador_local" && institutionId) {
        setValue("institution_id", institutionId);
      }
    }
    async function fetchSolicitantes() {
      const { data } = await supabase
        .from("conofta_waitlist" as any)
        .select("requesting_doctor")
        .not("requesting_doctor", "is", null) as any;
      if (data) {
        const unique = Array.from(
          new Set(data.map((d: any) => d.requesting_doctor))
        ).filter(Boolean) as string[];
        setSolicitantes(unique);
      }
    }
    fetchInstitutions();
    fetchSolicitantes();
  }, [role, institutionId]);

  const onRegisterSubmit = async (data: any) => {
    if (!data.lgpd_consent) {
      toast.error("Debe aceptar los términos LGPD");
      return;
    }
    setIsSubmitting(true);
    try {
      const patient: Patient = {
        cedula: data.cedula,
        firstname: data.firstname,
        lastname: data.lastname,
        address: data.address,
        city: data.city,
        phone: data.phone,
        email: data.email,
      };
      const commonEntry = {
        institution_id: data.institution_id || institutionId,
        status: "pendente" as const,
        notes: data.notes,
        has_diabetes: data.has_diabetes,
        has_hipertensao: data.has_hipertensao,
        has_anticoagulados: data.has_anticoagulados,
        requesting_doctor: data.requesting_doctor,
        surgeon_id: data.surgeon_id,
        exam_preop_complete: data.exam_preop_complete,
        pre_op_va_od: data.pre_op_va_od,
        pre_op_va_os: data.pre_op_va_os,
      };
      if (data.eye_selection === "Ambos") {
        toast.info("Registrando ambos ojos por separado...");
        await addPatientToWaitlist(patient, { ...commonEntry, target_eye: "OD" } as any);
        await addPatientToWaitlist(patient, { ...commonEntry, target_eye: "OS" } as any);
      } else {
        await addPatientToWaitlist(patient, { ...commonEntry, target_eye: data.eye_selection } as any);
      }
      setSubmitted(true);
      toast.success("¡Paciente registrado con éxito!");
    } catch (error: any) {
      console.error("error submitting form:", error);
      toast.error("Erro ao registrar paciente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewPatient = () => {
    reset();
    setCurrentStep(1);
    setSubmitted(false);
    setLowVisionOD(false);
    setLowVisionOS(false);
  };

  // ── Success Screen ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 animate-fade-in px-4">
        <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground">¡Paciente Registrado!</h2>
          <p className="text-muted-foreground mt-2 text-sm max-w-xs mx-auto">
            El ingreso fue guardado correctamente. Aparecerá en la Lista General con estado "Ingresado".
          </p>
        </div>
        <Button
          onClick={handleNewPatient}
          className="h-14 px-8 gradient-emerald rounded-2xl font-bold text-base shadow-lg shadow-emerald-500/20"
        >
          Registrar Otro Paciente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-emerald flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            Ficha de Ingreso
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-[52px]">Registro CONOFTA · {STEPS[currentStep - 1].label}</p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/20 bg-primary/5 shrink-0">
          <ShieldCheck className="h-3 w-3 mr-1" /> LGPD
        </Badge>
      </div>

      {/* Stepper indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive    = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => isCompleted && setCurrentStep(step.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 flex-1 transition-all",
                  isCompleted && "cursor-pointer"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                  isActive    && "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30",
                  isCompleted && "bg-emerald-500/20 border-emerald-500 text-emerald-400",
                  !isActive && !isCompleted && "bg-muted/30 border-border text-muted-foreground"
                )}>
                  {isCompleted
                    ? <CheckCircle2 className="h-5 w-5" />
                    : <Icon className="h-4 w-4" />
                  }
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase hidden sm:block",
                  isActive    && "text-primary",
                  isCompleted && "text-emerald-400",
                  !isActive && !isCompleted && "text-muted-foreground"
                )}>{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  "h-0.5 flex-1 mx-2 rounded-full transition-all",
                  currentStep > step.id ? "bg-emerald-500/60" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onRegisterSubmit)}>

        {/* ── STEP 1: Datos del Paciente ─────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-border/50 bg-card/80 p-5 space-y-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> Identificación del Paciente
              </h3>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cédula de Identidad *</Label>
                <Input
                  {...register("cedula")}
                  required
                  inputMode="numeric"
                  placeholder="Ej: 1.234.567"
                  className="h-14 text-base bg-background/50 border-border/50 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nombres *</Label>
                  <Input
                    {...register("firstname")}
                    required
                    autoComplete="given-name"
                    placeholder="Nombres"
                    className="h-14 text-base bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Apellidos *</Label>
                  <Input
                    {...register("lastname")}
                    required
                    autoComplete="family-name"
                    placeholder="Apellidos"
                    className="h-14 text-base bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Médico Cirujano (Responsable) *</Label>
                  <Select
                    value={watch("surgeon_id")}
                    onValueChange={(v) => {
                      setValue("surgeon_id", v);
                      const s = surgeons.find(s => s.id === v);
                      if (s) setValue("requesting_doctor", s.name);
                    }}
                  >
                    <SelectTrigger className="h-14 text-base bg-background/50 border-border/50">
                      <SelectValue placeholder="Seleccione Cirujano" />
                    </SelectTrigger>
                    <SelectContent>
                      {surgeons.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Médico Solicitante (Derivación)</Label>
                  <Input
                    {...register("requesting_doctor")}
                    required
                    placeholder="Nombre del médico"
                    className="h-14 text-base bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Sede de Origen *</Label>
                <Select
                  disabled={role === "coordinador_local"}
                  value={role === "coordinador_local" && institutionId ? institutionId : watchedInst}
                  onValueChange={(v) => setValue("institution_id", v)}
                >
                  <SelectTrigger className="h-14 text-base bg-background/50 border-border/50">
                    <SelectValue placeholder="Seleccione Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="w-full h-14 gradient-emerald rounded-2xl font-bold text-base shadow-lg shadow-emerald-500/20 gap-2"
            >
              Continuar <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* ── STEP 2: Evaluación Oftalmológica ──────────────────────────── */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-border/50 bg-card/80 p-5 space-y-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Eye className="h-3.5 w-3.5" /> Evaluación Oftalmológica
              </h3>

              {/* Selector de ojo — botões grandes para mobile */}
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ojos a Operar *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "OD", label: "OD", sub: "Derecho" },
                    { value: "OS", label: "OS", sub: "Izquierdo" },
                    { value: "Ambos", label: "Ambos", sub: "2 Cirugías" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue("eye_selection", opt.value)}
                      className={cn(
                        "h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95",
                        selectedEye === opt.value
                          ? opt.value === "OD"
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : opt.value === "OS"
                            ? "border-purple-500 bg-purple-500/10 text-purple-400"
                            : "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-border bg-muted/20 text-muted-foreground"
                      )}
                    >
                      <span className="text-base font-black">{opt.label}</span>
                      <span className="text-[9px] font-semibold uppercase opacity-70">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* AV Pre-Op OD */}
              <div className={cn("space-y-2", selectedEye === "OS" && "opacity-40 pointer-events-none")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">AV Pre-Op OD</Label>
                <div className="flex items-center gap-2 mb-1">
                  <Checkbox
                    id="lv-od"
                    checked={lowVisionOD}
                    onCheckedChange={(c) => { setLowVisionOD(!!c); setValue("pre_op_va_od", ""); }}
                  />
                  <Label htmlFor="lv-od" className="text-[10px] font-bold text-rose-400 uppercase cursor-pointer">
                    Baja Visión (No Tabla Snellen)
                  </Label>
                </div>
                <Select
                  disabled={selectedEye === "OS"}
                  value={watch("pre_op_va_od")}
                  onValueChange={(v) => setValue("pre_op_va_od", v)}
                >
                  <SelectTrigger className="h-14 text-base bg-background/50 border-border/50">
                    <SelectValue placeholder={selectedEye === "OS" ? "No aplica" : "Seleccionar AV..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {(lowVisionOD ? LOW_VISION_VALUES : SNELLEN_VALUES).map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* AV Pre-Op OS */}
              <div className={cn("space-y-2", selectedEye === "OD" && "opacity-40 pointer-events-none")}>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">AV Pre-Op OS</Label>
                <div className="flex items-center gap-2 mb-1">
                  <Checkbox
                    id="lv-os"
                    checked={lowVisionOS}
                    onCheckedChange={(c) => { setLowVisionOS(!!c); setValue("pre_op_va_os", ""); }}
                  />
                  <Label htmlFor="lv-os" className="text-[10px] font-bold text-rose-400 uppercase cursor-pointer">
                    Baja Visión (No Tabla Snellen)
                  </Label>
                </div>
                <Select
                  disabled={selectedEye === "OD"}
                  value={watch("pre_op_va_os")}
                  onValueChange={(v) => setValue("pre_op_va_os", v)}
                >
                  <SelectTrigger className="h-14 text-base bg-background/50 border-border/50">
                    <SelectValue placeholder={selectedEye === "OD" ? "No aplica" : "Seleccionar AV..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {(lowVisionOS ? LOW_VISION_VALUES : SNELLEN_VALUES).map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1 h-14 rounded-2xl font-bold gap-2 border-border/50"
              >
                <ChevronLeft className="h-5 w-5" /> Volver
              </Button>
              <Button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="flex-[2] h-14 gradient-emerald rounded-2xl font-bold gap-2 shadow-lg shadow-emerald-500/20"
              >
                Continuar <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Alertas, Contacto y Confirmación ──────────────────── */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Alertas clínicas — toggles grandes */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" /> Factores de Riesgo
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: "has_diabetes",       label: "Diabético",      desc: "Diagnóstico previo de diabetes" },
                  { key: "has_hipertensao",     label: "Hipertenso",     desc: "Diagnóstico previo de hipertensión" },
                  { key: "has_anticoagulados",  label: "Anticoagulado",  desc: "En tratamiento con anticoagulantes" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setValue(f.key as any, !watch(f.key as any))}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98]",
                      watch(f.key as any)
                        ? "border-rose-500/50 bg-rose-500/10"
                        : "border-border/50 bg-card/40"
                    )}
                  >
                    <div className={cn(
                      "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                      watch(f.key as any) ? "border-rose-500 bg-rose-500" : "border-border"
                    )}>
                      {watch(f.key as any) && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                    <div>
                      <p className={cn("font-bold text-sm", watch(f.key as any) ? "text-rose-400" : "text-foreground")}>{f.label}</p>
                      <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Contacto */}
            <div className="rounded-2xl border border-border/50 bg-card/80 p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> Localización y Contacto
              </h3>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Celular / Teléfono *</Label>
                <Input
                  {...register("phone")}
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Ej: 0981 123 456"
                  className="h-14 text-base bg-background/50 border-border/50 focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Dirección</Label>
                  <Input
                    {...register("address")}
                    placeholder="Calle, Barrio..."
                    className="h-14 text-base bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Ciudad</Label>
                  <Input
                    {...register("city")}
                    className="h-14 text-base bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Notas / Observaciones</Label>
                <Textarea
                  {...register("notes")}
                  placeholder="Información relevante sobre la consulta o pendencias..."
                  className="min-h-[80px] text-base bg-background/50 border-border/50 resize-none"
                />
              </div>
            </div>

            {/* LGPD */}
            <button
              type="button"
              onClick={() => setValue("lgpd_consent", !lgpdConsent)}
              className={cn(
                "w-full flex items-start gap-4 p-5 rounded-2xl border-2 text-left transition-all active:scale-[0.99]",
                lgpdConsent
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-border/50 bg-card/40"
              )}
            >
              <div className={cn(
                "h-6 w-6 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                lgpdConsent ? "border-emerald-500 bg-emerald-500" : "border-border"
              )}>
                {lgpdConsent && <CheckCircle2 className="h-4 w-4 text-white" />}
              </div>
              <div>
                <p className="font-black text-xs uppercase tracking-widest text-primary mb-1">
                  Compromiso LGPD & Seguridad
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Declaro conformidad con el tratamiento de datos personales exclusivos para el registro operativo CONOFTA.
                </p>
              </div>
            </button>

            {/* Pre-Op Preparado Check — Simplificado */}
            <button
              type="button"
              onClick={() => setValue("exam_preop_complete", !watch("exam_preop_complete"))}
              className={cn(
                "w-full flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all active:scale-[0.99]",
                watch("exam_preop_complete")
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-border/50 bg-card/40"
              )}
            >
              <div className={cn(
                "h-6 w-6 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                watch("exam_preop_complete") ? "border-emerald-500 bg-emerald-500" : "border-border"
              )}>
                {watch("exam_preop_complete") && <CheckCircle2 className="h-4 w-4 text-white" />}
              </div>
              <div>
                <p className="font-black text-xs uppercase tracking-widest text-emerald-400 mb-1">
                  Exámenes Pre-Op Listos
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Marque esta opción si el paciente ya dispone de todos los exámenes pre-operatorios preparados.
                </p>
              </div>
            </button>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="flex-1 h-14 rounded-2xl font-bold gap-2 border-border/50"
              >
                <ChevronLeft className="h-5 w-5" /> Volver
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !lgpdConsent}
                className={cn(
                  "flex-[2] h-14 rounded-2xl font-bold text-base gap-2 shadow-lg transition-all active:scale-[0.98]",
                  lgpdConsent
                    ? "gradient-emerald shadow-emerald-500/20"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5"
                )}
              >
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
                  : <><ClipboardCheck className="h-4 w-4" /> Confirmar Ingreso</>
                }
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
