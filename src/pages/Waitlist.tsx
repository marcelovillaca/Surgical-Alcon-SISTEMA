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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Users, 
  MapPin, 
  Loader2,
  ClipboardCheck,
  Stethoscope,
  ShieldCheck,
  AlertTriangle,
  Eye
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
  "20/200", "20/100", "20/70", "20/50", "20/40", "20/30", "20/25", "20/20", "20/15", "20/10"
];

const LOW_VISION_VALUES = [
  "Cuenta dedos (CD)",
  "Movimiento de manos (MM)",
  "Percepción de luz (PL)",
  "Sin percepción de luz (SPL)"
];

export default function Waitlist() {
  const { addPatientToWaitlist } = useWaitlist();
  const { role, institutionId } = useUserRole();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lowVisionOD, setLowVisionOD] = useState(false);
  const [lowVisionOS, setLowVisionOS] = useState(false);

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
      eye_selection: "OD", // OD, OS, Ambos
      pre_op_va_od: "",
      pre_op_va_os: "",
      lgpd_consent: false
    }
  });

  const lgpdConsent = watch("lgpd_consent");
  const selectedEye = watch("eye_selection");

  useEffect(() => {
    async function fetchInstitutions() {
      const { data } = await supabase.from('institutions').select('*').order('name');
      setInstitutions(data || []);
      if (role === "coordinador_local" && institutionId) {
        setValue("institution_id", institutionId);
      }
    }
    fetchInstitutions();
    fetchSolicitantes();
  }, [role, institutionId]);

  const [solicitantes, setSolicitantes] = useState<string[]>([]);

  async function fetchSolicitantes() {
     const { data } = await supabase
        .from('conofta_waitlist' as any)
        .select('requesting_doctor')
        .not('requesting_doctor', 'is', null) as any;
     
     if (data) {
        const unique = Array.from(new Set(data.map((d: any) => d.requesting_doctor))).filter(Boolean) as string[];
        setSolicitantes(unique);
     }
  }

  const onRegisterSubmit = async (data: any) => {
    if (!data.lgpd_consent) {
      toast.error("Debe aceptar los términos de protección de dados (LGPD)");
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
        email: data.email
      };

      const commonEntry = {
        institution_id: data.institution_id || institutionId,
        status: 'pendente' as const,
        notes: data.notes,
        has_diabetes: data.has_diabetes,
        has_hipertensao: data.has_hipertensao,
        has_anticoagulados: data.has_anticoagulados,
        requesting_doctor: data.requesting_doctor,
        pre_op_va_od: data.pre_op_va_od,
        pre_op_va_os: data.pre_op_va_os,
      };

      if (data.eye_selection === "Ambos") {
        // Create two entries
        toast.info("Registrando ambos ojos por separado...");
        await addPatientToWaitlist(patient, { ...commonEntry, target_eye: 'OD' } as any);
        await addPatientToWaitlist(patient, { ...commonEntry, target_eye: 'OS' } as any);
      } else {
        await addPatientToWaitlist(patient, { ...commonEntry, target_eye: data.eye_selection } as any);
      }

      reset();
      toast.success("¡Paciente registrado con éxito!");
    } catch (error: any) {
      console.error("error submitting form:", error);
      toast.error("Erro ao registrar paciente");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-emerald flex items-center justify-center shadow-lg shadow-emerald-500/20">
               <Stethoscope className="h-6 w-6 text-white" />
            </div>
            Ficha de Ingreso Operativa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Registro simplificado de pacientes para la Jornada CONOFTA</p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/20 bg-primary/5">
           <ShieldCheck className="h-3 w-3 mr-1" /> LGPD ACTIVA
        </Badge>
      </div>

      <Card className="max-w-4xl border-border shadow-2xl bg-card overflow-hidden mx-auto">
        <CardHeader className="border-b border-border bg-muted/20 p-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-500" />
              Datos del Paciente
            </h2>
        </CardHeader>
        <CardContent className="p-8">
           <form onSubmit={handleSubmit(onRegisterSubmit)} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/40 p-6 rounded-2xl border border-white/5">
                  <div className="space-y-2">
                     <Label className="text-xs uppercase font-bold text-muted-foreground">Cédula de Identidad *</Label>
                     <Input {...register("cedula")} required placeholder="Ej: 1.234.567" className="h-12 bg-background/50 border-white/5 focus:border-primary/50" />
                  </div>
                  <div className="space-y-2 relative">
                     <Label className="text-xs uppercase font-bold text-muted-foreground">Médico Solicitante *</Label>
                     <Input 
                       {...register("requesting_doctor")} 
                       required 
                       placeholder="Nombre del médico" 
                       className="h-12 bg-background/50 border-white/5 focus:border-primary/50"
                       list="solicitantes-list"
                     />
                     <datalist id="solicitantes-list">
                        {solicitantes.map(s => <option key={s} value={s} />)}
                     </datalist>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs uppercase font-bold text-muted-foreground">Sede de Origen *</Label>
                      <Select 
                        disabled={role === "coordinador_local"} 
                        value={institutionId && role === "coordinador_local" ? institutionId : watch("institution_id")}
                        onValueChange={(v) => setValue("institution_id", v)}
                      >
                         <SelectTrigger className="h-12 bg-background/50 border-white/5">
                            <SelectValue placeholder="Seleccione Unidad" />
                         </SelectTrigger>
                         <SelectContent>
                            {institutions.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                         </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs uppercase font-bold text-muted-foreground">Nombres *</Label>
                     <Input {...register("firstname")} required className="h-12 bg-background/50 border-white/5" />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-xs uppercase font-bold text-muted-foreground">Apellidos *</Label>
                     <Input {...register("lastname")} required className="h-12 bg-background/50 border-white/5" />
                  </div>
              </div>

              <div className="space-y-6">
                 <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Eye className="h-3 w-3" /> Evaluación Oftalmológica Inicial
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-900/40 p-6 rounded-2xl border border-white/5">
                    <div className="space-y-2">
                       <Label className="text-xs uppercase font-bold text-muted-foreground">Ojos a Operar *</Label>
                       <Select 
                         value={watch("eye_selection")}
                         onValueChange={(v) => setValue("eye_selection", v)}
                       >
                          <SelectTrigger className="h-12 bg-background/50 border-white/5">
                             <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="OD">Ojo Derecho (OD)</SelectItem>
                             <SelectItem value="OS">Ojo Izquierdo (OS)</SelectItem>
                             <SelectItem value="Ambos">Ambos Ojos (2 Cirugías)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-4">
                       <Label className="text-xs uppercase font-bold text-muted-foreground">AV Pre-Op OD</Label>
                       <div className="flex items-center gap-2 mb-2">
                          <Checkbox id="lv-od" checked={lowVisionOD} onCheckedChange={(c) => { setLowVisionOD(!!c); setValue("pre_op_va_od", ""); }} />
                          <Label htmlFor="lv-od" className="text-[10px] font-bold text-rose-400 uppercase cursor-pointer">Baja Visión (No Tabla)</Label>
                       </div>
                       <Select 
                         disabled={watch("eye_selection") === "OS"}
                         value={watch("pre_op_va_od")}
                         onValueChange={(v) => setValue("pre_op_va_od", v)}
                       >
                          <SelectTrigger className="h-12 bg-background/50 border-white/5 disabled:opacity-30">
                             <SelectValue placeholder={watch("eye_selection") === "OS" ? "No aplica" : "Seleccionar..."} />
                          </SelectTrigger>
                          <SelectContent>
                             {(lowVisionOD ? LOW_VISION_VALUES : SNELLEN_VALUES).map(v => (
                               <SelectItem key={v} value={v}>{v}</SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>
                    
                    <div className="space-y-4">
                       <Label className="text-xs uppercase font-bold text-muted-foreground">AV Pre-Op OS</Label>
                       <div className="flex items-center gap-2 mb-2">
                          <Checkbox id="lv-os" checked={lowVisionOS} onCheckedChange={(c) => { setLowVisionOS(!!c); setValue("pre_op_va_os", ""); }} />
                          <Label htmlFor="lv-os" className="text-[10px] font-bold text-rose-400 uppercase cursor-pointer">Baja Visión (No Tabla)</Label>
                       </div>
                       <Select 
                         disabled={watch("eye_selection") === "OD"}
                         value={watch("pre_op_va_os")}
                         onValueChange={(v) => setValue("pre_op_va_os", v)}
                       >
                          <SelectTrigger className="h-12 bg-background/50 border-white/5 disabled:opacity-30">
                             <SelectValue placeholder={watch("eye_selection") === "OD" ? "No aplica" : "Seleccionar..."} />
                          </SelectTrigger>
                          <SelectContent>
                             {(lowVisionOS ? LOW_VISION_VALUES : SNELLEN_VALUES).map(v => (
                               <SelectItem key={v} value={v}>{v}</SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> Localización y Contacto
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/40 p-6 rounded-2xl border border-white/5">
                    <div className="md:col-span-2 space-y-2">
                       <Label className="text-xs uppercase font-bold text-muted-foreground">📍 Dirección</Label>
                       <Input {...register("address")} placeholder="Calle, Barrio..." className="h-12 bg-background/50 border-white/5" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-xs uppercase font-bold text-muted-foreground">Ciudad</Label>
                       <Input {...register("city")} className="h-12 bg-background/50 border-white/5" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-xs uppercase font-bold text-muted-foreground">📞 Celular *</Label>
                       <Input {...register("phone")} required className="h-12 bg-background/50 border-white/5" />
                    </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3" /> Factores de Alerta
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-zinc-900/60 rounded-xl border border-white/5">
                       <Checkbox id="f-diabetes" checked={watch("has_diabetes")} onCheckedChange={(c) => setValue("has_diabetes", c === true)} />
                       <Label htmlFor="f-diabetes" className="text-sm font-semibold cursor-pointer">Diabético</Label>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-zinc-900/60 rounded-xl border border-white/5">
                       <Checkbox id="f-hiper" checked={watch("has_hipertensao")} onCheckedChange={(c) => setValue("has_hipertensao", c === true)} />
                       <Label htmlFor="f-hiper" className="text-sm font-semibold cursor-pointer">Hipertenso</Label>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-zinc-900/60 rounded-xl border border-white/5">
                       <Checkbox id="f-anti" checked={watch("has_anticoagulados")} onCheckedChange={(c) => setValue("has_anticoagulados", c === true)} />
                       <Label htmlFor="f-anti" className="text-sm font-semibold cursor-pointer">Anticoagulado</Label>
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                 <Label className="text-xs uppercase font-bold text-muted-foreground">Notas / Motivo de Pendencia</Label>
                 <Textarea {...register("notes")} placeholder="Justifique si hay pendencias o información relevante..." className="min-h-[100px] bg-background/50 border-white/5" />
              </div>

              <div className="p-6 bg-primary/5 text-muted-foreground rounded-2xl flex items-start gap-4 border border-primary/20">
                 <Checkbox id="lgpd" onCheckedChange={(c) => setValue("lgpd_consent", c === true)} className="mt-1 border-primary" />
                 <div className="text-[11px] leading-relaxed">
                    <p className="font-bold text-primary mb-1 uppercase tracking-widest">Compromiso LGPD & Seguridad</p>
                    Declaro conformidad con el tratamiento de datos personales exclusivos para el registro operativo CONOFTA.
                 </div>
              </div>

              <Button 
                type="submit" 
                className={cn(
                  "w-full h-16 text-xl font-bold shadow-2xl rounded-2xl hover:scale-[1.01] transition-all",
                  lgpdConsent ? "gradient-emerald" : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5"
                )} 
                disabled={isSubmitting || !lgpdConsent}
              >
                 {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Confirmar Ingreso Seguro"}
              </Button>
           </form>
        </CardContent>
      </Card>
    </div>
  );
}
