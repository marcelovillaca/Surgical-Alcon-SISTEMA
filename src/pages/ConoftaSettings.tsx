import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  ChevronRight,
  DollarSign,
  Edit2,
  Check
} from "lucide-react";
import { toast } from "sonner";

export default function ConoftaSettings() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [surgeons, setSurgeons] = useState<any[]>([]);
  const [revenueConfig, setRevenueConfig] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  
  const [newSede, setNewSede] = useState({ name: "", city: "", address: "" });
  const [newSurgeon, setNewSurgeon] = useState({ name: "", specialty: "Oftalmología", institution_id: "" });
  const [newRevenue, setNewRevenue] = useState({ anio: new Date().getFullYear(), tipo_cirugia: "Catarata", ingreso_por_cirugia: "", sucursal: "", moneda: "USD" });

  useEffect(() => {
    fetchInstitutions();
    fetchSurgeons();
    fetchRevenueConfig();
    fetchProducts();
  }, []);

  const [products, setProducts] = useState<any[]>([]);

  async function fetchProducts() {
    const { data } = await supabase.from('conofta_products').select('*').order('name');
    if (data) setProducts(data);
  }

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

  async function fetchRevenueConfig() {
    const { data } = await (supabase.from('conofta_revenue_config' as any).select('*').order('anio', { ascending: false }) as any);
    if (data) setRevenueConfig(data);
  }

  async function handleSaveRevenue(id: string, value: number) {
    const { error } = await (supabase.from('conofta_revenue_config' as any)
      .update({ ingreso_por_cirugia: value })
      .eq('id', id) as any);
    if (error) toast.error("Error al guardar: " + error.message);
    else { toast.success("Ingreso actualizado"); setEditingRevenue(null); fetchRevenueConfig(); }
  }

  async function handleAddRevenue() {
    const val = parseFloat(String(newRevenue.ingreso_por_cirugia).replace(',', '.'));
    if (!newRevenue.tipo_cirugia || isNaN(val)) { toast.error("Complete los campos requeridos"); return; }
    setIsSaving(true);
    const { error } = await (supabase.from('conofta_revenue_config' as any).upsert({
      anio: newRevenue.anio,
      tipo_cirugia: newRevenue.tipo_cirugia,
      sucursal: newRevenue.sucursal || null,
      ingreso_por_cirugia: val,
      moneda: newRevenue.moneda
    }, { onConflict: 'anio, sucursal, tipo_cirugia' }) as any);
    if (error) toast.error("Error: " + error.message);
    else { toast.success("Ingreso configurado"); setNewRevenue({ ...newRevenue, ingreso_por_cirugia: "" }); fetchRevenueConfig(); }
    setIsSaving(false);
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

  const [newProduct, setNewProduct] = useState({ name: "", sku: "", category: "lente", unit: "un" });

  async function handleDeleteSurgeon(id: string) {
    const { error } = await supabase.from('conofta_surgeons' as any).delete().eq('id', id);
    if (error) toast.error("No se puede eliminar: tiene cirugías asociadas");
    else {
      toast.success("Cirujano eliminado");
      fetchSurgeons();
    }
  }

  async function handleAddProduct() {
    if (!newProduct.name || !newProduct.category) {
      toast.error("Nombre y Categoría son obligatorios");
      return;
    }
    setIsSaving(true);
    const { error } = await supabase.from('conofta_products' as any).insert([newProduct]);
    if (error) toast.error("Error al guardar producto: " + error.message);
    else {
      toast.success("Producto agregado");
      setNewProduct({ name: "", sku: "", category: "lente", unit: "un" });
      // Here we would ideally refresh products, but we'll add product fetching to useEffect
    }
    setIsSaving(false);
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
          <TabsTrigger value="productos" className="px-8 data-[state=active]:bg-background">
            <Zap className="h-4 w-4 mr-2" />
            Catálogo / Productos
          </TabsTrigger>
          <TabsTrigger value="ingresos" className="px-8 data-[state=active]:bg-background">
            <DollarSign className="h-4 w-4 mr-2" />
            Ingresos Públicos
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
                      <th className="p-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Código</th>
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
                          <span className="font-mono text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                            {sede.unique_code || "N/A"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
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
                        <th className="p-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Código</th>
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
                            <span className="font-mono text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                              {s.unique_code || "N/A"}
                            </span>
                          </td>
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

        <TabsContent value="productos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 border-border/50 bg-card/80 backdrop-blur-md shadow-xl h-fit">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Plus className="h-5 w-5 text-indigo-500" />
                  Nuevo Producto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nombre *</Label>
                  <Input 
                    value={newProduct.name} 
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    placeholder="Ej: Lente Alcon AcrySof IQ"
                    className="h-11 bg-background/50 border-white/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Categoría</Label>
                  <Select value={newProduct.category} onValueChange={(v) => setNewProduct({...newProduct, category: v})}>
                    <SelectTrigger className="h-11 bg-background/50 border-white/5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lente">Lente Intraocular</SelectItem>
                      <SelectItem value="insumo">Insumo Quirúrgico</SelectItem>
                      <SelectItem value="equipo">Equipo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">SKU / Ref</Label>
                  <Input 
                    value={newProduct.sku} 
                    onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                    placeholder="Ej: SN60WF"
                    className="h-11 bg-background/50 border-white/5"
                  />
                </div>
                <Button onClick={handleAddProduct} className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-lg h-11 text-white" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar Producto
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-border/50 bg-card overflow-hidden shadow-xl ring-1 ring-border/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="p-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Código</th>
                      <th className="p-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Producto</th>
                      <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-center tracking-widest">Categoría</th>
                      <th className="p-5 text-[10px] font-black text-muted-foreground uppercase text-center tracking-widest">SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-sm">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/5 transition-colors group">
                        <td className="p-4">
                          <span className="font-mono text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                            {p.unique_code || "N/A"}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-foreground">{p.name}</td>
                        <td className="p-4 text-center">
                          <Badge variant="outline" className="text-[9px] uppercase font-bold px-2 py-0.5">
                            {p.category}
                          </Badge>
                        </td>
                        <td className="p-4 text-center text-muted-foreground font-mono text-[10px]">{p.sku || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ─────── INGRESOS PÚBLICOS POR CIRUGÍA ─────── */}
        <TabsContent value="ingresos" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form: Nuevo Ingreso */}
            <Card className="lg:col-span-1 border-border/50 bg-card/80 backdrop-blur-md shadow-xl h-fit">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Configurar Ingreso
                </CardTitle>
                <p className="text-xs text-muted-foreground">Lo que paga el gobierno por cada cirugía realizada en el proyecto CONOFTA.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Año *</Label>
                  <Input
                    type="number"
                    value={newRevenue.anio}
                    onChange={(e) => setNewRevenue({...newRevenue, anio: parseInt(e.target.value)})}
                    className="h-11 bg-background/50 border-white/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Tipo de Cirugía *</Label>
                  <select
                    value={newRevenue.tipo_cirugia}
                    onChange={(e) => setNewRevenue({...newRevenue, tipo_cirugia: e.target.value})}
                    className="w-full h-11 rounded-md border border-border bg-background/50 px-3 text-sm"
                  >
                    <option value="Catarata">Catarata</option>
                    <option value="Retina">Retina</option>
                    <option value="Pterigion">Pterigion</option>
                    <option value="Glaucoma">Glaucoma</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Sede (opcional, vacío = todas)</Label>
                  <select
                    value={newRevenue.sucursal}
                    onChange={(e) => setNewRevenue({...newRevenue, sucursal: e.target.value})}
                    className="w-full h-11 rounded-md border border-border bg-background/50 px-3 text-sm"
                  >
                    <option value="">Todas las sedes</option>
                    {institutions.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Ingreso por Cirugía (USD) *</Label>
                  <Input
                    type="number"
                    value={newRevenue.ingreso_por_cirugia}
                    onChange={(e) => setNewRevenue({...newRevenue, ingreso_por_cirugia: e.target.value})}
                    placeholder="Ej: 1200.00"
                    className="h-11 bg-background/50 border-white/5"
                  />
                </div>
                <Button onClick={handleAddRevenue} className="w-full gradient-emerald shadow-lg h-11" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar Ingreso
                </Button>
              </CardContent>
            </Card>

            {/* Table: Configuración vigente */}
            <Card className="lg:col-span-2 border-border/50 bg-card overflow-hidden shadow-xl">
              <CardHeader className="bg-muted/30 border-b border-border">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  Ingresos Configurados
                </CardTitle>
                <p className="text-xs text-muted-foreground">Estos valores se usan para calcular la facturación total y el P&L de CONOFTA.</p>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="p-4 text-[10px] font-black text-muted-foreground uppercase">Año</th>
                      <th className="p-4 text-[10px] font-black text-muted-foreground uppercase">Tipo Cirugía</th>
                      <th className="p-4 text-[10px] font-black text-muted-foreground uppercase">Sede</th>
                      <th className="p-4 text-[10px] font-black text-muted-foreground uppercase text-right">USD / Cirugía</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-sm">
                    {revenueConfig.length === 0 && (
                      <tr><td colSpan={5} className="p-10 text-center text-muted-foreground italic text-sm">Sin configuración. Agregue ingresos usando el formulario.</td></tr>
                    )}
                    {revenueConfig.map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/5 group transition-colors">
                        <td className="p-4 font-bold">{r.anio}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-green-500/10 text-green-400 border border-green-500/20">
                            {r.tipo_cirugia}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">{r.sucursal || "Todas"}</td>
                        <td className="p-4 text-right font-mono font-bold">
                          {editingRevenue === r.id ? (
                            <div className="flex items-center gap-2 justify-end">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-28 h-8 text-right text-sm"
                                autoFocus
                              />
                              <Button size="icon" className="h-8 w-8 bg-green-600" onClick={() => handleSaveRevenue(r.id, parseFloat(editValue))}>
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className={r.ingreso_por_cirugia === 0 ? "text-red-400" : "text-green-400"}>
                              ${Number(r.ingreso_por_cirugia).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-blue-400"
                            onClick={() => { setEditingRevenue(r.id); setEditValue(r.ingreso_por_cirugia); }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
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
