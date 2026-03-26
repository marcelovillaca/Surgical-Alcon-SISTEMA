import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useWaitlist, Patient } from "@/hooks/useWaitlist";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUp, Loader2, ClipboardCheck, AlertCircle, Eye } from "lucide-react";
import { toast } from "sonner";

interface WaitlistFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WaitlistForm({ open, onOpenChange }: WaitlistFormProps) {
  const { addPatientToWaitlist } = useWaitlist();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<{ request?: File; aptitude?: File }>({});

  const { register, handleSubmit, reset, setValue, watch } = useForm({
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
      pre_op_va_right: "",
      pre_op_va_left: "",
      exam_hemograma: false,
      exam_glicemia: false,
      exam_hba1c: false,
      exam_coagulograma: false,
      exam_creatinina: false,
      exam_ecg: false,
      has_diabetes: false,
      has_hipertensao: false,
      has_anticoagulados: false,
    }
  });

  useEffect(() => {
    async function fetchInstitutions() {
      setLoadingInstitutions(true);
      const { data } = await supabase.from('institutions').select('*').order('name');
      setInstitutions(data || []);
      setLoadingInstitutions(false);
    }
    if (open) fetchInstitutions();
  }, [open]);

  const onSubmit = async (data: any) => {
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

      const entry = {
        institution_id: data.institution_id,
        status: 'pendente' as const,
        notes: data.notes,
        pre_op_va_right: data.pre_op_va_right,
        pre_op_va_left: data.pre_op_va_left,
        exam_hemograma: data.exam_hemograma,
        exam_glicemia: data.exam_glicemia,
        exam_hba1c: data.exam_hba1c,
        exam_coagulograma: data.exam_coagulograma,
        exam_creatinina: data.exam_creatinina,
        exam_ecg: data.exam_ecg,
        has_diabetes: data.has_diabetes,
        has_hipertensao: data.has_hipertensao,
        has_anticoagulados: data.has_anticoagulados,
      };

      const success = await addPatientToWaitlist(patient, entry as any, files);
      if (success) {
        reset();
        setFiles({});
        onOpenChange(false);
      }
    } catch (error) {
      toast.error("Error al guardar el paciente");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto bg-card border-border shadow-2xl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Ficha Clínica de Ingreso - CONOFTA
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pt-6">
          {/* Seção 1: Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="h-1 w-4 bg-primary rounded-full" />
              Información del Paciente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cedula">Cédula de Identidad *</Label>
                <Input id="cedula" {...register("cedula")} required className="bg-muted/30" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="institution">Sede / Organización de Origen *</Label>
                <Select onValueChange={(val) => setValue("institution_id", val)}>
                  <SelectTrigger className="bg-muted/30">
                    <SelectValue placeholder="Seleccione Unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstname">Nombres *</Label>
                <Input id="firstname" {...register("firstname")} required className="bg-muted/30" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastname">Apellidos *</Label>
                <Input id="lastname" {...register("lastname")} required className="bg-muted/30" />
              </div>
            </div>
          </div>

          {/* Seção 2: Diagnóstico y Visión */}
          <div className="space-y-4 pt-4 border-t border-border/50">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Diagnóstico y Agudeza Visual
            </h3>
            <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
              <div className="space-y-2">
                <Label>Ojo Derecho (OD)</Label>
                <Input placeholder="Ej: 20/40" {...register("pre_op_va_right")} />
              </div>
              <div className="space-y-2">
                <Label>Ojo Izquierdo (OI)</Label>
                <Input placeholder="Ej: 20/100" {...register("pre_op_va_left")} />
              </div>
            </div>
          </div>

          {/* Seção 3: Checklist de Exames */}
          <div className="space-y-4 pt-4 border-t border-border/50">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
               <span className="h-1 w-4 bg-primary rounded-full" />
               Checklist de Exámenes (Obligatorios)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8 bg-emerald-500/5 p-6 rounded-xl border border-emerald-500/20">
              {[
                { id: "exam_hemograma", label: "Hemograma / Plaquetas" },
                { id: "exam_glicemia", label: "Glicemia de Ayuno" },
                { id: "exam_hba1c", label: "Hemoglobina Glicada" },
                { id: "exam_coagulograma", label: "Coagulograma (TP/INR)" },
                { id: "exam_creatinina", label: "Creatinina / Orina" },
                { id: "exam_ecg", label: "Ectrocardiograma (ECG)" },
              ].map((exam) => (
                <div key={exam.id} className="flex items-center space-x-3">
                  <Checkbox 
                    id={exam.id} 
                    onCheckedChange={(checked) => setValue(exam.id as any, checked === true)} 
                  />
                  <Label htmlFor={exam.id} className="text-xs font-medium cursor-pointer">{exam.label}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Seção 4: Pontos de Atenção (Comorbidades) */}
          <div className="space-y-4 pt-4 border-t border-border/50">
            <h3 className="text-sm font-bold uppercase tracking-widest text-rose-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Puntos de Atención (Comorbilidades)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border">
                <Checkbox id="has_diabetes" onCheckedChange={(c) => setValue("has_diabetes", c === true)} />
                <Label htmlFor="has_diabetes" className="text-xs font-bold">Diabético</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border">
                <Checkbox id="has_hipertensao" onCheckedChange={(c) => setValue("has_hipertensao", c === true)} />
                <Label htmlFor="has_hipertensao" className="text-xs font-bold">Hipertenso</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border">
                <Checkbox id="has_anticoagulados" onCheckedChange={(c) => setValue("has_anticoagulados", c === true)} />
                <Label htmlFor="has_anticoagulados" className="text-xs font-bold">Anticoagulado (AAS/Varf)</Label>
              </div>
            </div>
          </div>

          {/* Seção 5: Arquivos Adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
            <div className="space-y-2">
              <Label>Solicitud Quirúrgica (PDF)</Label>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full relative h-12 dashed-border hover:bg-muted" 
                onClick={() => document.getElementById('file-req')?.click()}
              >
                <FileUp className="mr-2 h-4 w-4 text-primary" />
                {files.request ? files.request.name.slice(0, 20) : "Vincular Solicitud"}
              </Button>
              <input id="file-req" type="file" className="hidden" accept=".pdf" onChange={(e) => setFiles(prev => ({ ...prev, request: e.target.files?.[0] }))} />
            </div>
            <div className="space-y-2">
              <Label>Aptitud Cardiológica (PDF)</Label>
              <Button 
                type="button" 
                variant="outline" 
                className="w-full relative h-12 dashed-border hover:bg-muted"
                onClick={() => document.getElementById('file-apt')?.click()}
              >
                <FileUp className="mr-2 h-4 w-4 text-primary" />
                {files.aptitude ? files.aptitude.name.slice(0, 20) : "Vincular Aptitud"}
              </Button>
              <input id="file-apt" type="file" className="hidden" accept=".pdf" onChange={(e) => setFiles(prev => ({ ...prev, aptitude: e.target.files?.[0] }))} />
            </div>
          </div>

          <DialogFooter className="bg-muted/30 p-6 rounded-xl border border-border mt-8">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="gradient-emerald min-w-[200px]" disabled={isSubmitting}>
              {isSubmitting ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Guardando...
                 </>
              ) : "Registrar en Fila de Espera"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
