import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  User, Building2, Stethoscope, ShieldCheck, TrendingUp, 
  AlertTriangle, Save, ChevronLeft, Plus, Trash2, 
  Settings, Award, Info, Activity, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Subspecialty = 'cataract_refractive' | 'retina' | 'glaucoma' | 'oculoplastics' | 'pediatric' | 'clinical';

const SUBSPECIALTIES: { id: Subspecialty; label: string; color: string }[] = [
  { id: 'cataract_refractive', label: 'Catarata y Cir. Refractiva', color: 'bg-blue-500' },
  { id: 'retina', label: 'Retina', color: 'bg-purple-500' },
  { id: 'glaucoma', label: 'Glaucoma', color: 'bg-emerald-500' },
  { id: 'oculoplastics', label: 'Oculoplástica', color: 'bg-orange-500' },
  { id: 'pediatric', label: 'Oftalmopediatría', color: 'bg-pink-500' },
  { id: 'clinical', label: 'Oftalmología Clínica', color: 'bg-slate-500' },
];

const EQUIPMENT_TYPES = [
  { id: 'faco', label: 'Facoemulsificador' },
  { id: 'vitreofago', label: 'Vitrêofago' },
  { id: 'microscopio', label: 'Microscópio' },
  { id: 'biometro', label: 'Biômetro' },
];

export default function MedicalIntelligence() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGerente } = useUserRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Client State
  const [client, setClient] = useState<any>(null);
  const [subspecialties, setSubspecialties] = useState<Subspecialty[]>([]);
  const [clientType, setClientType] = useState<'doctor' | 'institution'>('doctor');

  // Institutions State
  const [clientInstitutions, setClientInstitutions] = useState<any[]>([]);
  const [allInstitutions, setAllInstitutions] = useState<any[]>([]);

  // Equipment State
  const [equipment, setEquipment] = useState<any[]>([]);
  
  // Contacts State
  const [contacts, setContacts] = useState<any[]>([]);

  // Intelligence State
  const [intelligence, setIntelligence] = useState<any>(null);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Client Basic Info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);
      setSubspecialties(clientData.subspecialties || []);
      setClientType(clientData.client_type || 'doctor');

      // 2. Fetch Linked Institutions with volume/primary
      const { data: ciData } = await supabase
        .from('client_institutions')
        .select(`
          *,
          institution:institutions(*)
        `)
        .eq('client_id', id);
      setClientInstitutions(ciData || []);

      // 3. Fetch Equipment for these institutions
      const instIds = ciData?.map(ci => ci.institution_id) || [];
      if (instIds.length > 0) {
        const { data: equipData } = await supabase
          .from('institution_equipment')
          .select('*')
          .in('institution_id', instIds);
        setEquipment(equipData || []);

        const { data: contactData } = await supabase
          .from('institution_key_contacts')
          .select('*')
          .in('institution_id', instIds);
        setContacts(contactData || []);
      }

      // 4. Fetch Intelligence
      const { data: intelData } = await supabase
        .from('client_intelligence')
        .select('*')
        .eq('client_id', id)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single();
      setIntelligence(intelData);

      // 5. Fetch all institutions for linking
      const { data: allInsts } = await supabase.from('institutions').select('*');
      setAllInstitutions(allInsts || []);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update Client Info
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          subspecialties,
          client_type: clientType,
          visit_frequency: client.visit_frequency
        })
        .eq('id', id);

      if (clientError) throw clientError;

      // Update volumes and primary status
      for (const ci of clientInstitutions) {
        await supabase
          .from('client_institutions')
          .update({
            monthly_volume: ci.monthly_volume,
            is_primary: ci.is_primary
          })
          .eq('client_id', id)
          .eq('institution_id', ci.institution_id);
      }

      toast({ title: "✅ Datos guardados", description: "La Ficha do Cliente ha sido actualizada." });
      fetchData(); // Refresh to trigger server-side re-calculations if any triggers exist
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSubspecialty = (sub: Subspecialty) => {
    setSubspecialties(prev => 
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Cargando inteligencia de cliente...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10 py-4 border-b border-border/50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/crm')} className="p-2 hover:bg-muted rounded-full transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              {client?.name}
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {clientType === 'doctor' ? 'Cliente' : 'Institución'}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">{client?.cod_cliente || 'Sin código'} · {client?.city || 'Ciudad no definida'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50"
          >
            {saving ? <Activity className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Cambios
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Profiling & Intelligence */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Intelligence Scorecard */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <TrendingUp className="h-24 w-24" />
            </div>
            <h3 className="text-sm font-display font-bold text-foreground mb-6 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Segmentación Inteligente
            </h3>
            
            <div className="flex flex-col items-center text-center space-y-4 mb-6">
              <div className={cn(
                "h-24 w-24 rounded-full flex flex-col items-center justify-center border-4 shadow-inner",
                client?.segment === 'partner' ? "border-secondary bg-secondary/5 text-secondary" :
                client?.segment === 'grow' ? "border-primary bg-primary/5 text-primary" :
                client?.segment === 'protect' ? "border-amber-500 bg-amber-500/5 text-amber-500" :
                "border-slate-400 bg-slate-500/5 text-slate-500"
              )}>
                <span className="text-3xl font-black uppercase">{client?.segment?.split('_')[0]}</span>
                <span className="text-[10px] font-bold tracking-tighter opacity-70">CURRENT</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground capitalize">
                  {client?.segment?.replace('_', ' ') || 'Sin clasificar'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 px-4 italic">
                  "{intelligence?.next_step_suggestion || 'Realice una visita para actualizar el plan de acción.'}"
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Volume Band</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{intelligence?.volume_band || 'N/A'}</Badge>
                  <span className="text-xs font-mono font-bold text-foreground">{intelligence?.total_monthly_volume || 0} / mes</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Penetración Alcon</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{intelligence?.penetration_band || 'N/A'}</Badge>
                  <span className="text-xs font-mono font-bold text-foreground">{Math.round(intelligence?.alcon_penetration_pct || 0)}%</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Frecuencia de Visita</p>
                {isGerente ? (
                  <select 
                    value={client?.visit_frequency || 'mensual'} 
                    onChange={(e) => setClient({...client, visit_frequency: e.target.value})}
                    className="bg-background border border-border rounded-lg px-2 py-1 text-[10px] font-bold text-primary outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="semanal">SEMANAL</option>
                    <option value="quincenal">QUINCENAL</option>
                    <option value="mensual">MENSUAL</option>
                    <option value="trimestral">TRIMESTRAL</option>
                  </select>
                ) : (
                  <Badge className="bg-primary/10 text-primary border-none text-[9px] uppercase">{client?.visit_frequency || 'Mensual'}</Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {isGerente 
                  ? "Como gerente, puede sobreescribir la frecuencia automática para acelerar resultados."
                  : `Ajustada automáticamente según el segmento ${client?.segment}.`
                }
              </p>
            </div>
          </div>

          {/* Subspecialties */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="text-sm font-display font-bold text-foreground mb-4 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              Subespecialidades
            </h3>
            <div className="flex flex-wrap gap-2">
              {SUBSPECIALTIES.map(sub => {
                const isSelected = subspecialties.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    onClick={() => toggleSubspecialty(sub.id)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-2",
                      isSelected 
                        ? `${sub.color} border-transparent text-white shadow-md shadow-${sub.color.split('-')[1]}/20`
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {sub.label}
                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Institutions, Equipment, Contacts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Institutions & Volume */}
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Instituciones y Volumen Quirúrgico (Cliente)
              </h3>
              <button className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                <Plus className="h-3 w-3" /> Vincular nueva
              </button>
            </div>
            <div className="divide-y divide-border/50">
              {clientInstitutions.map((ci) => (
                <div key={ci.institution_id} className="p-6 hover:bg-muted/30 transition-colors group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                        ci.is_primary ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground"
                      )}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm flex items-center gap-2">
                          {ci.institution?.name}
                          {ci.is_primary && <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] h-4">PRINCIPAL</Badge>}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{ci.institution?.city} · {ci.institution?.type}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-end">
                        <label className="text-[9px] font-black text-muted-foreground uppercase mb-1">Volumen Mensual</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={ci.monthly_volume || 0}
                            onChange={(e) => {
                              const newVal = parseInt(e.target.value) || 0;
                              setClientInstitutions(prev => prev.map(p => 
                                p.institution_id === ci.institution_id ? { ...p, monthly_volume: newVal } : p
                              ));
                            }}
                            className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono font-bold text-center focus:ring-1 focus:ring-primary outline-none"
                          />
                          <span className="text-[10px] font-medium text-muted-foreground">cir/mes</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setClientInstitutions(prev => prev.map(p => ({
                            ...p,
                            is_primary: p.institution_id === ci.institution_id
                          })));
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border uppercase tracking-wider",
                          ci.is_primary 
                            ? "border-primary bg-primary/5 text-primary" 
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {ci.is_primary ? 'Principal' : 'Set Principal'}
                      </button>
                    </div>
                  </div>

                  {/* Sub-section: Equipment for this institution */}
                  <div className="mt-6 ml-14 bg-muted/30 rounded-xl p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Settings className="h-3 w-3" /> Equipamiento en Sitio
                      </p>
                      <button className="text-[9px] font-bold text-primary hover:underline">+ Agregar</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {equipment.filter(e => e.institution_id === ci.institution_id).map(e => (
                        <div key={e.id} className="bg-background rounded-lg border border-border/50 p-3 flex items-center justify-between group/item">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              e.is_alcon ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
                            )}>
                              {e.is_alcon ? <Award className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground capitalize">{e.equipment_type}</p>
                              <p className="text-[10px] text-muted-foreground">{e.brand} · {e.model} ({e.quantity})</p>
                            </div>
                          </div>
                          <button className="opacity-0 group-item-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {equipment.filter(e => e.institution_id === ci.institution_id).length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic col-span-2">No se han registrado equipos para esta institución.</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Decision Makers */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-display font-bold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Tomadores de Decisión por Cuenta
              </h3>
              <button className="text-xs font-bold text-primary hover:underline">+ Nuevo contacto</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map(contact => (
                <div key={contact.id} className="rounded-xl border border-border p-4 flex items-start gap-4 hover:border-primary/30 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-black">
                    {contact.contact_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{contact.contact_name}</p>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-tighter mb-1">{contact.role}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {allInstitutions.find(i => i.id === contact.institution_id)?.name}
                    </p>
                  </div>
                </div>
              ))}
              {contacts.length === 0 && (
                <div className="col-span-2 py-8 text-center bg-muted/20 rounded-xl border border-dashed border-border">
                  <p className="text-xs text-muted-foreground">No hay tomadores de decisión vinculados.</p>
                </div>
              )}
            </div>
          </div>

          {/* Strategic Opportunity Engine */}
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Zap className="h-24 w-24 text-primary" />
            </div>
            
            <div className="relative">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-display font-black text-foreground flex items-center gap-3">
                    <Zap className="h-6 w-6 text-primary animate-pulse" />
                    Motor de Oportunidades
                  </h3>
                  <p className="text-sm text-muted-foreground">Análisis de crecimiento sugerido por IA</p>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                  Ready to Grow
                </Badge>
              </div>

              <div className="space-y-4">
                {/* Simulated Opportunity Logic for UI display */}
                {intelligence?.volume_band === 'high' && intelligence?.penetration_band === 'low' && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex gap-4 hover:scale-[1.02] transition-transform cursor-pointer group">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Prioridad Alta: Conversión Premium</p>
                      <p className="text-sm font-bold text-foreground mb-2">Potencial de Migración a ATIOL</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Este cliente tiene un volumen total de <strong>{intelligence?.total_monthly_volume} cir/mes</strong> pero su mix Premium es inferior al 15%. Existe una oportunidad crítica de conversión a <strong>Vivity</strong>.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button className="text-[10px] font-black bg-amber-500 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-amber-500/20">ACCIONAR PLAN</button>
                      </div>
                    </div>
                  </div>
                )}

                {equipment.some(e => !e.is_alcon && (e.equipment_type === 'faco' || e.equipment_type === 'vitreofago')) && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 flex gap-4 hover:scale-[1.02] transition-transform cursor-pointer group">
                    <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Prioridad Crítica: Defensa Competitiva</p>
                      <p className="text-sm font-bold text-foreground mb-2">Ataque en Base Instalada</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Se detectó equipo de la competencia ({equipment.find(e => !e.is_alcon)?.brand}) en su institución principal. Alto riesgo de pérdida de fidelidad en descartables.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button className="text-[10px] font-black bg-rose-500 text-white px-3 py-1.5 rounded-lg shadow-lg shadow-rose-500/20">PLAN TRADE-IN</button>
                      </div>
                    </div>
                  </div>
                )}

                {!intelligence && (
                  <div className="py-12 text-center border-2 border-dashed border-border rounded-2xl">
                    <p className="text-xs text-muted-foreground italic px-8">
                      Cargue más datos de volumen y equipos para que el motor de IA pueda generar recomendaciones estratégicas.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

import { Users } from "lucide-react";
