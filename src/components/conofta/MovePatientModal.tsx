import { useState, useEffect } from "react";
import { useWaitlist, WaitlistEntry } from "@/hooks/useWaitlist";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { Calendar as CalendarIcon, User, MapPin, Clock, Loader2, Info, Eye, Check, ChevronsUpDown, Search as SearchIcon, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface MovePatientModalProps {
  entry: WaitlistEntry | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  updateEntryStatus?: (id: string, status: any, data?: any) => Promise<void>;
  isAdmin?: boolean; // Se true, pode selecionar médico de qualquer sucursal
}

export default function MovePatientModal({ entry, onOpenChange, onSuccess, updateEntryStatus: parentUpdate, isAdmin = false }: MovePatientModalProps) {
  const { updateEntryStatus: hookUpdate } = useWaitlist();
  // Prefer parent-provided function to avoid stale state issue
  const updateEntryStatus = parentUpdate ?? hookUpdate;
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [localSurgeons, setLocalSurgeons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  
  const [selectedInstId, setSelectedInstId] = useState("");
  const [originInstId, setOriginInstId] = useState("");
  const [selectedSurgeonId, setSelectedSurgeonId] = useState("");
  const [surgeryDate, setSurgeryDate] = useState("");
  const [surgeryTime, setSurgeryTime] = useState("");
  const [selectedEye, setSelectedEye] = useState<'OD' | 'OS'>('OD');
  const [requestingDoctor, setRequestingDoctor] = useState("");
  const [openSurgeon, setOpenSurgeon] = useState(false);

  useEffect(() => {
    async function fetchInitialData() {
      setLoadingInitial(true);
      let surgQuery = supabase.from('conofta_surgeons' as any).select('*, institutions(name)').eq('is_active', true).order('name');
      const [instRes, surgRes] = await Promise.all([
        supabase.from('institutions').select('*').order('name'),
        surgQuery,
      ]);
      setInstitutions(instRes.data || []);
      setLocalSurgeons(surgRes.data || []);
      setLoadingInitial(false);
    }

    if (entry) {
      fetchInitialData();
      if (entry.assigned_institution_id) setSelectedInstId(entry.assigned_institution_id);
      if (entry.institution_id) setOriginInstId(entry.institution_id);
      if (entry.surgeon_id) setSelectedSurgeonId(entry.surgeon_id);
      if (entry.surgery_date) setSurgeryDate(entry.surgery_date);
      if (entry.surgery_time) setSurgeryTime(entry.surgery_time);
      if (entry.target_eye) setSelectedEye(entry.target_eye || 'OD');
      if (entry.requesting_doctor) setRequestingDoctor(entry.requesting_doctor);
    }
  }, [entry]);

  const handleSchedule = async () => {
    if (!selectedInstId || !selectedSurgeonId || !surgeryDate) {
      toast.error("Por favor complete todos los campos obligatorios.");
      return;
    }

    setLoading(true);
    try {
      if (entry?.id) {
        await updateEntryStatus(entry.id, 'agendado', {
          institution_id: originInstId || entry.institution_id,
          assigned_institution_id: selectedInstId,
          surgeon_id: selectedSurgeonId,
          surgery_date: surgeryDate,
          surgery_time: surgeryTime,
          target_eye: selectedEye,
          requesting_doctor: requestingDoctor,
          scheduled_at: entry.status === 'agendado' ? entry.scheduled_at : new Date().toISOString()
        });
        toast.success(entry.status === 'agendado' ? "¡Agendamiento actualizado!" : "¡Cirugía agendada con éxito!");
        onOpenChange(false);
        onSuccess?.(); // 🔑 Notify parent to refresh its own list
      }
    } catch (error) {
      console.error("error scheduling:", error);
      toast.error("Error al agendar cirugía");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-border bg-card/95 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden p-0">
        <div className="h-1.5 w-full gradient-blue" />
        
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 text-blue-500" />
             </div>
              {entry?.status === 'agendado' ? "Actualizar Agendamiento" : "Agendamiento de Cirugía"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-2 uppercase tracking-widest font-bold">
            {entry?.status === 'agendado' ? "Modificar Datos de la Cirugía" : "Definir Logística Quirúrgica"}
          </p>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="p-4 rounded-2xl bg-muted/30 border border-white/5 flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">{entry?.patient?.firstname} {entry?.patient?.lastname}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                C.I: {entry?.patient?.cedula}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
               <Label className="text-[9px] font-bold uppercase text-muted-foreground">Ojo a Operar</Label>
               <Select value={selectedEye} onValueChange={(v: any) => setSelectedEye(v)}>
                  <SelectTrigger className="h-8 bg-background/50 border-white/5 w-24">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="OD">OD</SelectItem>
                     <SelectItem value="OS">OS</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-3 w-3" /> Sede de Origen
                </Label>
                <Select value={originInstId} onValueChange={setOriginInstId}>
                  <SelectTrigger className="h-12 bg-background/50 border-white/5">
                    <SelectValue placeholder="Sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-3 w-3" /> Centro Quirúrgico *
                </Label>
                <Select value={selectedInstId} onValueChange={setSelectedInstId}>
                  <SelectTrigger className="h-12 bg-background/50 border-white/5">
                    <SelectValue placeholder="Lugar de Cirugía" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <User className="h-3 w-3" /> Médico Cirujano Asignado *
              </Label>
              <Popover open={openSurgeon} onOpenChange={setOpenSurgeon}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openSurgeon}
                    className="w-full h-12 justify-between bg-background/50 border-white/5 font-normal text-xs"
                  >
                    {selectedSurgeonId
                      ? localSurgeons.find((s) => s.id === selectedSurgeonId)?.name
                      : "Buscar o seleccionar cirujano..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0 border-white/10 bg-zinc-900 shadow-2xl overflow-hidden">
                  <Command className="bg-transparent">
                    <CommandInput placeholder="Buscar por nombre..." className="h-10 text-xs border-white/5 bg-white/5" />
                    <CommandList className="max-h-[250px] overflow-y-auto custom-scrollbar">
                      <CommandEmpty className="py-6 text-center text-xs text-muted-foreground italic">
                        No se encontraron cirujanos.
                      </CommandEmpty>
                      <CommandGroup heading="Cirujanos Activos">
                        {localSurgeons.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={`${s.name} ${isAdmin && s.institutions?.name ? s.institutions.name : ''}`}
                            onSelect={() => {
                              setSelectedSurgeonId(s.id);
                              setOpenSurgeon(false);
                            }}
                            className="flex items-center justify-between py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Check
                                className={cn(
                                  "h-3 w-3 text-emerald-500 transition-opacity",
                                  selectedSurgeonId === s.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="font-medium">{s.name}</span>
                            </div>
                            {isAdmin && s.institutions?.name && (
                              <Badge variant="outline" className="text-[9px] bg-white/5 border-white/5 opacity-60">
                                {s.institutions.name}
                              </Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Stethoscope className="h-3 w-3" /> Médico Solicitante
                </Label>
                {selectedSurgeonId && (
                  <button 
                    type="button"
                    onClick={() => setRequestingDoctor(localSurgeons.find(s => s.id === selectedSurgeonId)?.name || "")}
                    className="text-[9px] font-black text-emerald-500/80 hover:text-emerald-400 uppercase tracking-tighter flex items-center gap-1 transition-colors"
                  >
                    <Check className="h-3 w-3" /> Mismo que el cirujano
                  </button>
                )}
              </div>
              <Input
                placeholder="Nombre del médico que solicita el examen/cirugía"
                value={requestingDoctor}
                onChange={(e) => setRequestingDoctor(e.target.value)}
                className="h-12 bg-background/50 border-white/5 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <CalendarIcon className="h-3 w-3" /> Fecha Planeada *
                 </Label>
                 <Input 
                   type="date" 
                   value={surgeryDate} 
                   onChange={(e) => setSurgeryDate(e.target.value)}
                   className="h-12 bg-background/50 border-white/5"
                 />
               </div>
               <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Hora de Turno
                 </Label>
                 <Input 
                   type="time" 
                   value={surgeryTime} 
                   onChange={(e) => setSurgeryTime(e.target.value)}
                   className="h-12 bg-background/50 border-white/5"
                 />
               </div>
            </div>

            {selectedEye && (
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3">
                 <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-blue-600 leading-relaxed uppercase font-bold tracking-tight">
                    ATENCIÓN: Se está agendando la cirugía para el ojo <span className="underline">{selectedEye}</span>. 
                    El otro ojo permanecerá en lista de espera hasta su propio agendamiento.
                 </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl">
            Cancelar
          </Button>
          <Button onClick={handleSchedule} disabled={loading} className="flex-1 gradient-blue shadow-lg rounded-xl h-11 text-white">
            {loading ? <Loader2 className="animate-spin" /> : entry?.status === 'agendado' ? "Guardar Cambios" : "Confirmar Agendamiento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
