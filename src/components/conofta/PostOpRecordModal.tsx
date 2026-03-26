import { useState, useEffect } from "react";
import { useWaitlist, WaitlistEntry } from "@/hooks/useWaitlist";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Calendar as CalendarIcon, Loader2, Activity } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Tabela de Snellen padrão ─────────────────────────────────────────────────
const SNELLEN_VALUES = [
  "20/200", "20/100", "20/70", "20/50", "20/40", "20/30", "20/25", "20/20", "20/15", "20/10"
];

const LOW_VISION_VALUES = [
  "Cuenta dedos (CD)",
  "Movimiento de manos (MM)",
  "Percepción de luz (PL)",
  "Sin percepción de luz (SPL)"
];

interface PostOpRecordModalProps {
  entry: WaitlistEntry | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function PostOpRecordModal({ entry, onOpenChange, onSuccess }: PostOpRecordModalProps) {
  const { refresh } = useWaitlist();
  const [loading, setLoading] = useState(false);
  const [vaOperated, setVaOperated] = useState(""); // AV do olho operado
  const [actualDate, setActualDate] = useState("");
  const [lowVision, setLowVision] = useState(false);

  const operatedEye = entry?.target_eye; // "OD" ou "OS"
  const isOD = operatedEye === "OD";

  useEffect(() => {
    if (entry) {
      // Preencher AV do olho operado se já existir
      const existingVa = isOD ? entry.post_op_va_od : entry.post_op_va_os;
      setVaOperated(existingVa || "");
      setActualDate(entry.actual_surgery_date || entry.surgery_date || new Date().toISOString().split("T")[0]);
    }
  }, [entry]);

  const handleComplete = async () => {
    if (!actualDate) {
      toast.error("Por favor, informe la fecha en que se realizó la cirugía.");
      return;
    }
    if (!vaOperated) {
      toast.error(`Informe la AV final del ojo ${operatedEye} operado. Este campo es obligatorio.`);
      return;
    }

    setLoading(true);
    try {
      const updatePayload: Record<string, any> = {
        status: "concluido",
        actual_surgery_date: actualDate,
        finalized_at: new Date().toISOString(),
      };

      // Salvar apenas no campo do olho operado
      if (isOD) {
        updatePayload.post_op_va_od = vaOperated;
      } else {
        updatePayload.post_op_va_os = vaOperated;
      }

      const { error } = await supabase
        .from("conofta_waitlist" as any)
        .update(updatePayload)
        .eq("id", entry?.id);

      if (error) throw error;

      toast.success("¡Cirugía finalizada y registrada con éxito!");
      onSuccess();
      refresh();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error al finalizar cirugía");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] border-border bg-card/95 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden p-0">
        <div className="h-1.5 w-full gradient-emerald" />
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            Conclusión de Cirugía
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-2 uppercase tracking-widest font-bold">
            Registro de AV Final — Tabla de Snellen
          </p>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Paciente + Ojo */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-white/5 flex justify-between items-center">
            <div>
              <p className="text-sm font-bold text-foreground">
                {entry?.patient?.firstname} {entry?.patient?.lastname}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                C.I: {entry?.patient?.cedula}
              </p>
            </div>
            <Badge
              className={cn(
                "text-xs font-black px-3",
                isOD
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  : "bg-purple-500/20 text-purple-400 border-purple-500/30"
              )}
            >
              OJO {operatedEye} OPERADO
            </Badge>
          </div>

          {/* Fecha */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
              <CalendarIcon className="h-3 w-3" /> Fecha Real de Operación *
            </Label>
            <Input
              type="date"
              value={actualDate}
              onChange={(e) => setActualDate(e.target.value)}
              className="h-12 bg-background/50 border-white/5"
            />
          </div>

          {/* AV del ojo operado — Snellen */}
          <div className="space-y-4">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              AV Final — Ojo {operatedEye} (Snellen) *
            </Label>
            
            <div className="flex items-center gap-2 mb-2">
              <Checkbox id="lv-post" checked={lowVision} onCheckedChange={(c) => { setLowVision(!!c); setVaOperated(""); }} />
              <Label htmlFor="lv-post" className="text-[10px] font-bold text-rose-400 uppercase cursor-pointer">Baja Visión (No usa Tabla)</Label>
            </div>

            <Select value={vaOperated} onValueChange={setVaOperated}>
              <SelectTrigger
                className={cn(
                  "h-14 text-base font-bold font-mono",
                  isOD
                    ? "bg-blue-500/5 border-blue-500/20"
                    : "bg-purple-500/5 border-purple-500/20"
                )}
              >
                <SelectValue placeholder={`Seleccionar AV — Ojo ${operatedEye}…`} />
              </SelectTrigger>
              <SelectContent>
                {(lowVision ? LOW_VISION_VALUES : SNELLEN_VALUES).map((v) => (
                  <SelectItem key={v} value={v} className="font-mono">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[9px] text-muted-foreground">
              Solo se registra el ojo operado ({operatedEye}). Campo obligatorio para finalizar.
            </p>
          </div>

          {/* Info */}
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex gap-3">
            <Activity className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-600/90 leading-relaxed italic">
              Al confirmar, el paciente pasará a <strong>Finalizado</strong> y saldrá de la Lista General.
              Los resultados alimentarán los indicadores de éxito visual.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl flex-1">
            Volver
          </Button>
          <Button
            onClick={handleComplete}
            disabled={loading || !vaOperated || !actualDate}
            className="gradient-emerald rounded-xl px-8 shadow-lg shadow-emerald-500/20 flex-1"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Confirmar y Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
