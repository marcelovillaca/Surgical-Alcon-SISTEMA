import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Plus, 
  MapPin, 
  Shield, 
  Trash2, 
  Save, 
  Loader2,
  Building,
  Zap,
  Settings,
  Stethoscope,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

export default function ConoftaSettings() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [surgeons, setSurgeons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [newSede, setNewSede] = useState({ name: "", city: "", address: "" });
  const [newSurgeon, setNewSurgeon] = useState({ name: "", specialty: "Oftalmología", institution_id: "" });

  useEffect(() => {
    fetchInstitutions();
    fetchSurgeons();
  }, []);

  async function fetchInstitutions() {
    setLoading(true);
    const { data, error } = await supabase.from('institutions').select('*').order('name');
    if (error) toast.error("Error al cargar sedes");
    else setInstitutions(data || []);
    setLoading(false);
  }

  async function fetchSurgeons() {
    const { data, error } = await supabase
      .from('conofta_surgeons' as any)
      .select('*, institutions(name)')
      .order('name');
    if (!error) setSurgeons(data || []);
  }

  async function handleAddSede() {
    if (!newSede.name || !newSede.city) {
      toast.error("Nombre y Ciudad son obligatorios");
      return;
    }
    setIsSaving(true);
    const { error } = await supabase.from('institutions').insert([newSede]);
    if (error) toast.error("Error al guardar sede");
    else {
      toast.success("Sede agregada correctamente");
      setNewSede({ name: "", city: "", address: "" });
      fetchInstitutions();
    }
    setIsSaving(false);
  }

  async function handleAddSurgeon() {
    if (!newSurgeon.name) {
      toast.error("El nombre del cirujano é obligatorio");
      return;
    }
    setIsSaving(true);
    const { error } = await supabase.from('conofta_surgeons' as any).insert([newSurgeon]);
    if (error) toast.error("Error al guardar cirujano: " + error.message);
    else {
      toast.success("Cirujano registrado");
      setNewSurgeon({ name: "", specialty: "Oftalmología", institution_id: "" });
      fetchSurgeons();
    }
    setIsSaving(false);
  }

  async function handleDeleteSede(id: string) {
    const { error } = await supabase.from('institutions').delete().eq('id', id);
    if (error) toast.error("No se puede eliminar: tiene registros asociados");
    else {
      toast.success("Sede eliminada");
      fetchInstitutions();
    }
  }

  async function handleDeleteSurgeon(id: string) {
    const { error } = await supabase.from('conofta_surgeons' as any).delete().eq('id', id);
    if (error) toast.error("No se puede eliminar: tiene cirugías asociadas");
    else {
      toast.success("Cirujano eliminado");
      fetchSurgeons();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-card border border-white/5 glass-surface shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Zap className="h-32 w-32 text-emerald-500" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tighter flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 rotate-3">
               <Settings className="h-6 w-6 text-white" />
            </div>
            Configuración de Sedes y Cirujanos
          </h1>
          <p className="text-sm text-muted-foreground mt-2 ml-1 flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
            Control de infraestructura y equipo médico para la jornada CONOFTA
          </p>
        </div>
      </div>

      <Tabs defaultValue="sedes" className="w-full">
        <TabsList className="bg-muted/50 p-1 border border-border h-12 mb-6">
          <TabsTrigger value="sedes" className="px-8 data-[state=active]:bg-background">
            <Building2 className="h-4 w-4 mr-2" />
            Sedes Operativas
          </TabsTrigger>
          <TabsTrigger value="cirujanos" className="px-8 data-[state=active]:bg-background">
            <Stethoscope className="h-4 w-4 mr-2" />
            Médicos Cirujanos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sedes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 border-border/50 bg-card/80 backdrop-blur-md shadow-xl h-fit">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Plus className="h-5 w-5 text-emerald-500" />
                  Nueva Sede / Hospital
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nombre *</Label>
                  <Input 
                    value={newSede.name} 
                    onChange={(e) => setNewSede({...newSede, name: e.target.value})}
                    placeholder="Ej: Hospital de Ojos Sede Central"
                    className="h-11 bg-background/50 border-white/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Ciudad *</Label>
                  <Input 
                    value={newSede.city} 
                    onChange={(e) => setNewSede({...newSede, city: e.target.value})}
                    placeholder="Ej: Asunción"
                    className="h-11 bg-background/50 border-white/5"
                  />
                </div>
                <Button onClick={handleAddSede} className="w-full gradient-emerald shadow-lg h-11" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar Sede
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border/50 bg-card overflow-hidden shadow-xl ring-1 ring-border/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="p-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sede / Institución</th>
                      <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-center tracking-widest">Ubicación</th>
                      <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-right tracking-widest">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-sm">
                    {loading ? (
                      <tr><td colSpan={3} className="p-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></td></tr>
                    ) : institutions.map((sede) => (
                      <tr key={sede.id} className="hover:bg-muted/5 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-sm">
                              <Building className="h-5 w-5" />
                            </div>
                            <span className="font-bold text-foreground">{sede.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {sede.city}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="icon" className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteSede(sede.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cirujanos" className="space-y-6">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-1 border-border/50 bg-card/80 backdrop-blur-md shadow-xl h-fit">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Plus className="h-5 w-5 text-blue-500" />
                    Nuevo Cirujano
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nombre Completo *</Label>
                    <Input 
                      value={newSurgeon.name} 
                      onChange={(e) => setNewSurgeon({...newSurgeon, name: e.target.value})}
                      placeholder="Ej: Dr. Francisco Ferreira"
                      className="h-11 bg-background/50 border-white/5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Sede / Hospital Primario</Label>
                    <Select 
                      value={newSurgeon.institution_id}
                      onValueChange={(v) => setNewSurgeon({...newSurgeon, institution_id: v})}
                    >
                      <SelectTrigger className="h-11 bg-background/50 border-white/5">
                        <SelectValue placeholder="Opcional: Vincular Sede" />
                      </SelectTrigger>
                      <SelectContent>
                        {institutions.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Especialidad</Label>
                    <Input 
                      value={newSurgeon.specialty} 
                      onChange={(e) => setNewSurgeon({...newSurgeon, specialty: e.target.value})}
                      placeholder="Ej: Retina / Catarata"
                      className="h-11 bg-background/50 border-white/5"
                    />
                  </div>
                  <Button onClick={handleAddSurgeon} className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg h-11 text-white" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                    Registrar Cirujano
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 border-border/50 bg-card overflow-hidden shadow-xl ring-1 ring-border/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="p-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nombre del Médico</th>
                        <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-center tracking-widest">Sede</th>
                        <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-center tracking-widest">Especialidad</th>
                        <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-right tracking-widest">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 text-sm">
                      {surgeons.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/5 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                                <Stethoscope className="h-5 w-5" />
                              </div>
                              <span className="font-bold text-foreground">{s.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-[10px] px-2 py-1 rounded bg-muted font-medium text-muted-foreground">
                              {s.institutions?.name ?? "Sin Sede"}
                            </span>
                          </td>
                          <td className="p-4 text-center text-muted-foreground">
                            {s.specialty}
                          </td>
                          <td className="p-4 text-right">
                            <Button variant="ghost" size="icon" className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteSurgeon(s.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
