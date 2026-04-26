import { useState } from "react";
import { useWaitlist } from "@/hooks/useWaitlist";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  User, 
  Stethoscope, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Download, 
  Search, 
  Filter, 
  FileDown, 
  Users,
  Building,
  History
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WaitlistStatus } from "@/hooks/useWaitlist";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendiente",
  informado: "Pre-Op Informado",
  apto: "Apto / Quirófano",
  agendado: "Agendado",
  operado: "Operado (Post-Op)",
  concluido: "Finalizado",
  cancelado: "Cancelado"
};

export default function ConoftaReports() {
  const { entries } = useWaitlist();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [surgeons, setSurgeons] = useState<any[]>([]);
  
  const [filterSede, setFilterSede] = useState("all");
  const [filterSurgeon, setFilterSurgeon] = useState("all");
  const [filterSolicitante, setFilterSolicitante] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    // Use conofta_institutions exclusively — separate from Alcon CRM's `institutions` table
    (supabase.from("conofta_institutions" as any).select("id, name, city").eq("is_active", true).order("name") as any)
      .then(({ data }: any) => setInstitutions(data || []));
    supabase.from("conofta_surgeons" as any).select("*").order("name").then(({ data }) => setSurgeons(data || []));
  }, []);

  const solicitantesUnicos = Array.from(new Set(entries.map(e => e.requesting_doctor).filter(Boolean))) as string[];

  const filteredData = entries.filter(e => {
    const matchSede = filterSede === "all" || e.institution_id === filterSede;
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    const matchSurgeon = filterSurgeon === "all" || e.surgeon_id === filterSurgeon;
    const matchSolicitante = filterSolicitante === "all" || e.requesting_doctor === filterSolicitante;
    return matchSede && matchStatus && matchSurgeon && matchSolicitante;
  });

  const exportToExcel = () => {
    const dataToExport = filteredData.map(e => ({
      ID_Entry: e.id,
      Paciente: `${e.patient?.firstname} ${e.patient?.lastname}`,
      Cedula: e.patient?.cedula,
      Sede: institutions.find(i => i.id === e.institution_id)?.name || e.institution_id,
      Status: STATUS_LABELS[e.status] || e.status,
      Cirujano: (e as any).surgeon?.name || "Sin asignar",
      Solicitante: e.requesting_doctor || "Sin dato",
      Ojo: e.target_eye || "—",
      AV_Pre_OD: e.pre_op_va_od || "—",
      AV_Pre_OS: e.pre_op_va_os || "—",
      AV_Post_OD: e.post_op_va_od || "—",
      AV_Post_OS: e.post_op_va_os || "—",
      Fecha_Cirugia: e.surgery_date || "—",
      Fecha_Registro: e.created_at ? new Date(e.created_at).toLocaleDateString() : "—",
      Diabetes: e.has_diabetes ? "SÍ" : "NO",
      Hipertension: e.has_hipertensao ? "SÍ" : "NO",
      Anticoagulado: e.has_anticoagulados ? "SÍ" : "NO",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Operativo");
    XLSX.writeFile(wb, `Reporte_CONOFTA_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 rounded-[2rem] bg-card border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none rotate-12">
          <FileDown className="h-40 w-40 text-blue-500" />
        </div>
        
        <div className="relative z-10">
          <h1 className="text-4xl font-display font-black text-foreground tracking-tighter flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl gradient-blue flex items-center justify-center shadow-xl shadow-blue-500/20">
               <FileDown className="h-8 w-8 text-white" />
            </div>
            Informes Operativos
          </h1>
          <p className="text-sm text-muted-foreground mt-2 ml-1 font-medium flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Generación de reportes dinámicos para gestión centralizada
          </p>
        </div>

        <Button onClick={exportToExcel} size="lg" className="gradient-emerald shadow-xl shadow-emerald-500/20 h-14 px-8 rounded-2xl hover:scale-[1.02] transition-all">
          <Download className="mr-3 h-5 w-5" />
          <span className="font-bold">EXPORTAR A EXCEL</span>
        </Button>
      </div>

      {/* ── Filtros Horizontais Superiores ────────────────────────────────── */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-xl shadow-xl rounded-[1.5rem] overflow-hidden">
        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 mb-1.5 flex items-center gap-1.5">
              <Building className="h-3 w-3" /> Sede / Unidad
            </Label>
            <Select value={filterSede} onValueChange={setFilterSede}>
              <SelectTrigger className="h-11 bg-background/50 border-white/5 rounded-xl">
                <SelectValue placeholder="Todas las sedes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sedes: Todas</SelectItem>
                {institutions.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 mb-1.5 flex items-center gap-1.5">
              <Stethoscope className="h-3 w-3" /> Médico Cirujano
            </Label>
            <Select value={filterSurgeon} onValueChange={setFilterSurgeon}>
              <SelectTrigger className="h-11 bg-background/50 border-white/5 rounded-xl">
                <SelectValue placeholder="Todos los cirujanos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cirujanos: Todos</SelectItem>
                {surgeons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 mb-1.5 flex items-center gap-1.5">
              <User className="h-3 w-3" /> Médico Solicitante
            </Label>
            <Select value={filterSolicitante} onValueChange={setFilterSolicitante}>
              <SelectTrigger className="h-11 bg-background/50 border-white/5 rounded-xl">
                <SelectValue placeholder="Todos os solicitantes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Solicitantes: Todos</SelectItem>
                {solicitantesUnicos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 mb-1.5 flex items-center gap-1.5">
              <Filter className="h-3 w-3" /> Status Waitlist
            </Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-11 bg-background/50 border-white/5 rounded-xl">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: Todos</SelectItem>
                {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                  <SelectItem key={val} value={val}>{lbl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="px-6 pb-6 pt-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                  <Users className="h-3 w-3" /> {filteredData.length} registros encontrados
               </div>
            </div>
            
            {(filterSede !== "all" || filterStatus !== "all" || filterSurgeon !== "all" || filterSolicitante !== "all") && (
              <button 
                onClick={() => { setFilterSede("all"); setFilterStatus("all"); setFilterSurgeon("all"); setFilterSolicitante("all"); }}
                className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-tighter transition-colors"
              >
                Limpiar Filtros
              </button>
            )}
        </div>
      </Card>

      <Card className="border-border/50 bg-card overflow-hidden shadow-2xl ring-1 ring-border/5 rounded-[1.5rem]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border/50">
                <th className="p-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Paciente</th>
                <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-center tracking-widest">Ojo</th>
                <th className="p-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cirujano</th>
                <th className="p-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Solicitante</th>
                <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-center tracking-widest">Sede</th>
                <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-center tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 text-sm">
              {filteredData.map((e) => (
                <tr key={e.id} className="hover:bg-muted/5 transition-all group">
                  <td className="p-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">{e.patient?.firstname} {e.patient?.lastname}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">CI: {e.patient?.cedula}</span>
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <Badge variant="outline" className="text-[9px] h-5 border-white/10">{e.target_eye || "—"}</Badge>
                  </td>
                  <td className="p-5 text-xs text-muted-foreground font-medium">
                    {(e as any).surgeon?.name || <span className="opacity-30 italic">Sin asignar</span>}
                  </td>
                  <td className="p-5 text-xs text-muted-foreground">
                    {e.requesting_doctor || <span className="opacity-30 italic">Sin dato</span>}
                  </td>
                  <td className="p-5 text-center">
                    <Badge variant="outline" className="text-[9px] bg-blue-500/5 text-blue-400 border-blue-500/20">
                      {institutions.find(i => i.id === e.institution_id)?.name || "Unidad"}
                    </Badge>
                  </td>
                  <td className="p-5 text-center">
                    <Badge variant="secondary" className="text-[9px] font-bold bg-zinc-800 text-zinc-300">
                      {STATUS_LABELS[e.status] || e.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-20 text-center flex flex-col items-center justify-center gap-4">
                    <div className="h-16 w-16 rounded-3xl bg-muted/50 flex items-center justify-center">
                       <Search className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">No se encontraron pacientes com los filtros aplicados.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
