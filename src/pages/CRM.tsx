import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Users, Search, Plus, Building, Link2, X, Upload, FileSpreadsheet, 
  Loader2, ShoppingCart, Activity, Trash2, LayoutGrid, List, 
  ChevronRight, MapPin, Stethoscope, Briefcase, Globe
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { parseClientsSheet, downloadTemplate } from "@/lib/excel-parsers";

type Client = {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  cod_cliente: string | null;
  contact_name: string | null;
  city: string | null;
  segment: string;
  pricing_level: string;
  visit_frequency: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  subspecialties: string[];
  client_type: string;
  primary_institution_id: string | null;
  monthly_surgery_volume: number;
  institutions: { id: string; name: string; city: string | null; is_primary?: boolean; monthly_surgery_volume?: number }[];
};

type Institution = { id: string; name: string; type: string | null; city: string | null };

const segmentStyles: Record<string, { label: string, color: string, badge: string }> = {
  check_in: { label: "Check-in", color: "bg-slate-500", badge: "border-slate-400/30 bg-slate-400/10 text-slate-500" },
  grow: { label: "Grow", color: "bg-emerald-500", badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-500" },
  partner: { label: "Partner", color: "bg-cyan-500", badge: "border-cyan-400/30 bg-cyan-400/10 text-cyan-500" },
  protect: { label: "Protect", color: "bg-amber-500", badge: "border-amber-400/30 bg-amber-400/10 text-amber-500" },
};

const freqLabels: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  trimestral: "Trimestral",
};

export default function CRM() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isGerente } = useUserRole();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewClient, setShowNewClient] = useState(false);
  const [activeTab, setActiveTab] = useState<"medicos" | "instituciones">("medicos");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isSaving, setIsSaving] = useState(false);

  // New client form
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newCod, setNewCod] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newSegment, setNewSegment] = useState("check_in");
  const [newPricing, setNewPricing] = useState("D");
  const [newFreq, setNewFreq] = useState("mensual");
  const [newAddress, setNewAddress] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Bulk Import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // New institution form
  const [instName, setInstName] = useState("");
  const [instType, setInstType] = useState("clinica");
  const [instCity, setInstCity] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [{ data: clientsData }, { data: instsData }] = await Promise.all([
      (supabase.from("clients")
        .select("id, name, first_name, last_name, cod_cliente, contact_name, city, segment, pricing_level, visit_frequency, email, phone, address, subspecialties, client_type, primary_institution_id") as any),
      supabase.from("institutions").select("id, name, type, city"),
    ]);

    if (clientsData) {
      // Fetch institution links including volume and primary status
      const { data: links } = await supabase.from("client_institutions").select("client_id, institution_id, is_primary, monthly_surgery_volume");
      
      const enriched = clientsData.map((c) => {
        const cLinks = links?.filter((l) => l.client_id === c.id) || [];
        const insts = instsData?.filter((i) => cLinks.some(l => l.institution_id === i.id)) || [];
        const primaryLink = cLinks.find(l => l.is_primary) || cLinks[0]; // fallback to first if none primary
        
        return { 
          ...c, 
          subspecialties: c.subspecialties || [],
          client_type: c.client_type || 'doctor',
          monthly_surgery_volume: primaryLink?.monthly_surgery_volume || 0,
          institutions: insts.map(i => {
            const link = cLinks.find(l => l.institution_id === i.id);
            return { 
              id: i.id, 
              name: i.name, 
              city: i.city, 
              is_primary: link?.is_primary, 
              monthly_surgery_volume: link?.monthly_surgery_volume 
            };
          }) 
        } as Client;
      });
      setClients(enriched);
    }
    if (instsData) setInstitutions(instsData);
    setLoading(false);
  };

  const handleCreateClient = async () => {
    if (!newFirstName || !user || !linkInstId) {
      toast({ title: "Datos incompletos", description: "El nombre y la institución son obligatorios.", variant: "destructive" });
      return;
    }
    const fullName = `${newFirstName} ${newLastName}`.trim();
    const { data: newClient, error } = await (supabase.from("clients").insert({
      name: fullName,
      first_name: newFirstName,
      last_name: newLastName,
      cod_cliente: newCod || null,
      contact_name: newContact || null,
      city: newCity || null,
      segment: newSegment as any,
      pricing_level: newPricing as any,
      visit_frequency: newFreq as any,
      address: newAddress || null,
      email: newEmail || null,
      phone: newPhone || null,
    } as any).select().single() as any);

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    // Link mandatory institution
    if (newClient) {
      const { error: linkError } = await supabase
        .from("client_institutions")
        .insert({ client_id: newClient.id, institution_id: linkInstId, is_primary: true });

      if (linkError) {
        toast({ title: "⚠️ Parcial", description: "Cliente creado pero falló la vinculación a la institución." });
      }
    }

    toast({ title: "✅ Cliente creado", description: `${fullName} guardado y vinculado exitosamente.` });
    setShowNewClient(false);
    resetForm();
    fetchData();
  };

   const handleUpdateClient = async () => {
    if (!editingClient || !newFirstName || !user) return;
    const fullName = `${newFirstName} ${newLastName}`.trim();
    
    // 1. Update basic client data
    const { error } = await supabase.from("clients").update({
      name: fullName,
      first_name: newFirstName,
      last_name: newLastName,
      cod_cliente: newCod || null,
      contact_name: newContact || null,
      city: newCity || null,
      segment: newSegment as any,
      pricing_level: newPricing as any,
      visit_frequency: newFreq as any,
      address: newAddress || null,
      email: newEmail || null,
      phone: newPhone || null,
    } as any).eq("id", editingClient.id);
    
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    // 2. Handle institution link update
    if (linkInstId) {
      // Check if this institution is already linked
      const alreadyLinked = editingClient.institutions.find(i => i.id === linkInstId);
      
      if (!alreadyLinked) {
        // Remove primary flag from others for this client
        await supabase.from("client_institutions").update({ is_primary: false }).eq("client_id", editingClient.id);
        
        // Insert new link as primary
        await supabase.from("client_institutions").insert({
          client_id: editingClient.id,
          institution_id: linkInstId,
          is_primary: true
        });
      } else if (!alreadyLinked.is_primary) {
        // Set existing link as primary
        await supabase.from("client_institutions").update({ is_primary: false }).eq("client_id", editingClient.id);
        await supabase.from("client_institutions").update({ is_primary: true }).eq("client_id", editingClient.id).eq("institution_id", linkInstId);
      }
    }

    toast({ title: "✅ Cliente actualizado" });
    setEditingClient(null);
    resetForm();
    fetchData();
  };

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm("¿Está seguro de eliminar este cliente?")) return;
    
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cliente eliminado", description: "El cliente ha sido desactivado exitosamente." });
      fetchData();
    }
  };

   const startEdit = (c: Client) => {
    setEditingClient(c);
    setNewFirstName(c.first_name || "");
    setNewLastName(c.last_name || "");
    setNewCod(c.cod_cliente || "");
    setNewContact(c.contact_name || "");
    setNewCity(c.city || "");
    setNewAddress(c.address || "");
    setNewSegment(c.segment);
    setNewPricing(c.pricing_level);
    setNewFreq(c.visit_frequency || "mensual");
    setNewEmail(c.email || "");
    setNewPhone(c.phone || "");
    
    // Set current primary institution
    const primary = c.institutions.find(i => i.is_primary);
    if (primary) setLinkInstId(primary.id);
    else setLinkInstId("");
  };

  const resetForm = () => {
    setNewFirstName(""); setNewLastName(""); setNewCod("");
    setNewContact(""); setNewCity(""); setNewAddress("");
    setNewEmail(""); setNewPhone("");
    setLinkInstId("");
    setNewSegment("check_in"); setNewPricing("D"); setNewFreq("mensual");
  };

  const handleCreateInstitution = async () => {
    if (!instName || !user) return;
    setIsSaving(true);
    
    // Clean insert to bypass schema cache issues with new columns
    const { error } = await supabase.from("institutions").insert({
      name: instName,
      type: instType,
      city: instCity || null
    });
    
    if (error) { 
      toast({ title: "Error", description: error.message, variant: "destructive" }); 
    } else {
      toast({ title: "✅ Institución creada" });
      setShowNewInst(false);
      setInstName(""); setInstCity("");
      fetchData();
    }
    
    setIsSaving(false);
  };

  const handleLinkInstitution = async () => {
    if (!linkClientId || !linkInstId) return;
    const { error } = await supabase.from("client_institutions").insert({
      client_id: linkClientId,
      institution_id: linkInstId,
    });
    if (error) {
      toast({ title: "Error", description: error.message === '23505' ? "Ya vinculado" : error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vinculado" });
    setLinkClientId(null);
    fetchData();
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImportLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const { rows, errors } = parseClientsSheet(ws);
      
      if (errors.length > 0) throw new Error(errors.join(", "));
      
      // Fetch institutions to map names
      const { data: allInsts } = await supabase.from("institutions").select("id, name");

      for (const r of rows) {
        const { data: newClient, error } = await supabase.from("clients").insert({
          name: r.name,
          first_name: r.first_name,
          last_name: r.last_name,
          cod_cliente: r.cod_cliente || null,
          contact_name: r.contact_name,
          city: r.city,
          address: r.address,
          email: r.email,
          phone: r.phone,
          segment: r.segment as any,
          pricing_level: r.pricing_level as any,
          assigned_to: user.id,
        } as any).select().single();

        if (error) {
          console.error("Error creating client", r.name, error);
          continue;
        }

        // Link institution if provided
        if (newClient && r.institution) {
          const instMatch = allInsts?.find(i => i.name.toLowerCase().trim() === r.institution?.toLowerCase().trim());
          if (instMatch) {
            await supabase.from("client_institutions").insert({
              client_id: newClient.id,
              institution_id: instMatch.id,
              is_primary: true
            });
          }
        }
      }

      toast({ title: "Importación Exitosa", description: `${rows.length} clientes procesados con sus vínculos.` });
      setShowBulkImport(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error en Importación", description: err.message, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  const handleUnlink = async (clientId: string, institutionId: string) => {
    await supabase.from("client_institutions").delete().eq("client_id", clientId).eq("institution_id", institutionId);
    toast({ title: "Desvinculado" });
    fetchData();
  };

  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [activePricing, setActivePricing] = useState<string | null>(null);

  const filtered = clients.filter((c) => {
    const s = search.toLowerCase();
    const matchesSearch = !s || (
      c.name.toLowerCase().includes(s) ||
      (c.cod_cliente?.toLowerCase().includes(s)) ||
      c.contact_name?.toLowerCase().includes(s) ||
      c.city?.toLowerCase().includes(s) ||
      c.segment.toLowerCase().includes(s)
    );
    const matchesSegment = !activeSegment || c.segment === activeSegment;
    const matchesPricing = !activePricing || c.pricing_level === activePricing;
    return matchesSearch && matchesSegment && matchesPricing;
  }).sort((a, b) => {
    const s = search.toLowerCase();
    if (!s) return a.name.localeCompare(b.name);
    // Code exact match gets top priority
    if (a.cod_cliente?.toLowerCase() === s) return -1;
    if (b.cod_cliente?.toLowerCase() === s) return 1;
    // Name exact match next
    if (a.name.toLowerCase() === s) return -1;
    if (b.name.toLowerCase() === s) return 1;
    return a.name.localeCompare(b.name);
  });

  const segmentCounts = segmentos.map((s) => ({
    ...s,
    count: clients.filter((c) => c.segment === s.label.toLowerCase().replace("-", "_")).length,
  }));

  return (
    <div className="space-y-5 animate-slide-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">CRM & Clientes</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Segmentación, Pricing y relación Cliente-Institución</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isGerente && (
            <button onClick={() => setShowBulkImport(true)} className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Carga Masiva</span>
            </button>
          )}
          <button onClick={() => setShowNewInst(true)} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva Institución</span>
          </button>
          <button onClick={() => setShowNewClient(true)} className="flex items-center gap-2 rounded-xl gradient-gold px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* New Institution Form */}
      {showNewInst && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-slide-in">
          <h3 className="text-sm font-display font-semibold text-foreground">Nueva Institución</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Nombre</label>
              <input value={instName} onChange={(e) => setInstName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" placeholder="Hospital Nacional..." />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Tipo</label>
              <select value={instType} onChange={(e) => setInstType(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="clinica">Clínica</option>
                <option value="hospital">Hospital</option>
                <option value="optica">Óptica</option>
                <option value="consultorio">Consultorio</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Ciudad</label>
              <input value={instCity} onChange={(e) => setInstCity(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNewInst(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={handleCreateInstitution} disabled={!instName} className="px-4 py-2 rounded-lg gradient-emerald text-sm font-semibold text-secondary-foreground hover:opacity-90 disabled:opacity-50">Crear</button>
          </div>
        </div>
      )}

      {/* New/Edit Client Form */}
      {(showNewClient || editingClient) && (
        <div className={cn(
          "rounded-xl border p-5 space-y-4 animate-slide-in",
          editingClient ? "border-secondary/30 bg-secondary/5" : "border-primary/30 bg-card gold-glow"
        )}>
          <h3 className="text-sm font-display font-semibold text-foreground">
            {editingClient ? `Editar Cliente: ${editingClient.name}` : "Nuevo Cliente"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Código Cliente</label>
              <input 
                value={newCod} 
                onChange={(e) => setNewCod(e.target.value)} 
                disabled={!isGerente}
                className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" 
                placeholder="Autogenerado..." 
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Nombre</label>
              <input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" placeholder="Juan..." />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Apellido</label>
              <input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" placeholder="Pérez..." />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Contacto (Secretaría/Otro)</label>
              <input value={newContact} onChange={(e) => setNewContact(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Ciudad</label>
              <input value={newCity} onChange={(e) => setNewCity(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Dirección</label>
              <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Teléfono</label>
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Segmento</label>
              <select value={newSegment} onChange={(e) => setNewSegment(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="check_in">Check-in</option>
                <option value="grow">Grow</option>
                <option value="partner">Partner</option>
                <option value="protect">Protect</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Nivel Precio</label>
              <select value={newPricing} onChange={(e) => setNewPricing(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Frecuencia Visita</label>
              <select 
                value={newFreq} 
                onChange={(e) => setNewFreq(e.target.value)} 
                disabled={!isGerente}
                className={cn(
                  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary",
                  !isGerente && "bg-muted cursor-not-allowed"
                )}
              >
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
              </select>
              {!isGerente && <p className="text-[9px] text-muted-foreground mt-1">Solo el gerente puede editar la frecuencia.</p>}
            </div>
            
            <div className="lg:col-span-3 border-t border-border pt-4 mt-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 block">Vinculación Institucional Obligatoria</label>
              <div className="flex flex-col md:flex-row gap-4 bg-muted/20 p-4 rounded-xl border border-dashed border-border">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por nombre o ciudad..." 
                    className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase();
                      const filtered = institutions.filter(i => i.name.toLowerCase().includes(val) || i.city?.toLowerCase().includes(val));
                      // The select below already lists all, but this allows future expansion to a real dropdown
                    }}
                  />
                </div>
                <select 
                  value={linkInstId} 
                  onChange={(e) => setLinkInstId(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Seleccione Institución Principal...</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name} ({inst.city || '—'})</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 italic">
                * Todo cliente debe estar vinculado al menos a una institución para ser creado.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <button onClick={() => { setShowNewClient(false); setEditingClient(null); resetForm(); }} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button 
              onClick={editingClient ? handleUpdateClient : handleCreateClient} 
              disabled={!newFirstName || (!editingClient && !linkInstId)} 
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100", 
                editingClient ? "bg-secondary text-secondary-foreground" : "gradient-gold text-primary-foreground shadow-lg shadow-primary/20"
              )}
            >
              {editingClient ? "Actualizar Cliente" : "Crear y Vincular"}
            </button>
          </div>
        </div>
      )}

      {/* Segmentation Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {segmentCounts.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 card-hover">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("h-3 w-3 rounded-full", s.color)} />
              <p className="text-sm font-medium text-foreground">{s.label}</p>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{s.count}</p>
            <p className="text-xs text-muted-foreground">clientes</p>
          </div>
        ))}
      </div>

      {/* Tab Switcher & Segment Filters */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex p-1 bg-muted/40 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab("medicos")}
              className={cn(
                "px-6 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
                activeTab === "medicos" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Stethoscope className="h-4 w-4" /> MÉDICOS
              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]", activeTab === "medicos" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {clients.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("instituciones")}
              className={cn(
                "px-6 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2",
                activeTab === "instituciones" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building className="h-4 w-4" /> INSTITUCIONES
              <span className={cn("px-1.5 py-0.5 rounded-full text-[10px]", activeTab === "instituciones" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {institutions.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-muted/40 rounded-xl">
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-2 rounded-lg transition-all", viewMode === "grid" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn("p-2 rounded-lg transition-all", viewMode === "table" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {activeTab === "medicos" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none no-scrollbar">
              <button
                onClick={() => setActiveSegment(null)}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-xl border transition-all whitespace-nowrap",
                  !activeSegment ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-card border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                Todos
              </button>
              {Object.entries(segmentStyles).map(([key, style]) => {
                const active = activeSegment === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveSegment(active ? null : key)}
                    className={cn(
                      "px-4 py-2 text-xs font-bold rounded-xl border transition-all whitespace-nowrap flex items-center gap-2",
                      active ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-card border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", style.color)} />
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === "medicos" ? "Buscar por nombre, código, ciudad..." : "Buscar instituciones..."}
            className="w-full rounded-xl border border-border bg-card h-12 pl-10 pr-4 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
        {(activeSegment || activePricing || search) && (
          <button onClick={() => { setActiveSegment(null); setActivePricing(null); setSearch(""); }} className="text-xs text-primary font-bold hover:underline px-2">Limpiar filtros</button>
        )}
      </div>

      {/* Link Institution Dialog */}
      {linkClientId && (
        <div className="rounded-xl border border-secondary/30 bg-card p-5 space-y-3 animate-slide-in emerald-glow">
          <h3 className="text-sm font-display font-semibold text-foreground">
            Vincular Institución a: {clients.find(c => c.id === linkClientId)?.name}
          </h3>
          <div className="flex gap-3">
            <select value={linkInstId} onChange={(e) => setLinkInstId(e.target.value)} className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
              <option value="">Seleccionar institución...</option>
              {institutions.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type}) - {i.city}</option>)}
            </select>
            <button onClick={handleLinkInstitution} disabled={!linkInstId} className="px-4 py-2 rounded-lg gradient-emerald text-sm font-semibold text-secondary-foreground hover:opacity-90 disabled:opacity-50">Vincular</button>
            <button onClick={() => setLinkClientId(null)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Cargando Inteligencia CRM...</p>
        </div>
      ) : activeTab === "medicos" ? (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((c) => (
                <div 
                  key={c.id} 
                  className="group relative rounded-2xl border border-border bg-card hover:bg-primary/5 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 overflow-hidden"
                >
                  {/* Card Header: Segment & Action */}
                  <div className="flex items-center justify-between p-5 pb-3">
                    <div className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-black shadow-inner border uppercase tracking-widest",
                      segmentStyles[c.segment]?.badge || "border-border bg-muted/20 text-muted-foreground"
                    )}>
                      {segmentStyles[c.segment]?.label || c.segment}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => startEdit(c)}
                        className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-secondary/10 hover:text-secondary transition-all"
                        title="Editar"
                      >
                        <UserCog className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => navigate(`/crm/intelligence/${c.id}`)}
                        className="h-9 w-9 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                        title="Inteligencia"
                      >
                        <Activity className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Doctor Info */}
                  <div className="px-5 pb-5 space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-foreground text-lg group-hover:text-primary transition-colors truncate">
                        {c.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                        <MapPin className="h-3 w-3" /> {c.city || "Ciudad no definida"}
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <span className="opacity-80">NIVEL {c.pricing_level}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <Building className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">
                            {c.institutions.find(i => i.is_primary)?.name || c.institutions[0]?.name || "Sin institución"}
                          </p>
                          <p className="text-[10px] flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {c.city || "Ciudad no definida"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <Stethoscope className="h-4 w-4 mt-0.5 shrink-0 text-secondary/60" />
                        <div className="flex flex-wrap gap-1">
                          {c.subspecialties.length > 0 ? (
                            c.subspecialties.map(s => (
                              <span key={s} className="bg-secondary/10 text-secondary px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                {s.replace("_", " ")}
                              </span>
                            ))
                          ) : (
                            <span className="italic text-[10px] opacity-60">Especialidad no mapeada</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Volume & Arrow */}
                  <div className="bg-muted/30 px-5 py-4 flex items-center justify-between border-t border-border/40">
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Volume Mensal</p>
                      <p className="text-sm font-display font-black text-foreground">
                        {c.monthly_surgery_volume} <span className="text-[10px] font-bold text-muted-foreground">cir.</span>
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                  </div>
                  
                  {/* Subtle hover gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          ) : (
            /* DESKTOP: Table */
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Cód. Cliente</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Instituciones</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Segmento</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-center">Nivel</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Volume</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin resultados</td></tr>
                  ) : (
                    filtered.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3 font-mono text-[11px]">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded border font-bold",
                            c.cod_cliente ? "text-primary border-primary/30 bg-primary/5" : "text-muted-foreground border-border bg-muted/20"
                          )}>
                            {c.cod_cliente || "S/C"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground opacity-70 truncate max-w-[150px]">
                              {c.subspecialties.join(", ").replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.institutions.map((inst) => (
                              <span key={inst.id} className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                inst.is_primary ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary/10 text-secondary"
                              )}>
                                {inst.name}
                                <button onClick={() => handleUnlink(c.id, inst.id)} className="ml-0.5 hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">{c.segment.replace("_", " ")}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", nivelColors[c.pricing_level], c.pricing_level === "D" ? "text-muted-foreground" : "text-primary-foreground")}>
                            {c.pricing_level}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold">{c.monthly_surgery_volume}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                             <button onClick={() => navigate(`/crm/intelligence/${c.id}`)} className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                               <Activity className="h-4 w-4" />
                             </button>
                             <button onClick={() => startEdit(c)} className="p-2 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors">
                               Editar
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* INSTITUTIONS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {institutions.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.city?.toLowerCase().includes(search.toLowerCase())).map((inst) => (
            <div key={inst.id} className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 hover:shadow-xl transition-all">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-2xl bg-secondary/10 flex items-center justify-center">
                  <Building className="h-6 w-6 text-secondary" />
                </div>
                <span className="bg-muted px-2 py-1 rounded text-[10px] font-bold uppercase text-muted-foreground">{inst.type}</span>
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">{inst.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {inst.city || "Ciudad no definida"}
                </p>
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                   <Users className="h-3 w-3" /> 
                   <span>{clients.filter(c => c.institutions.some(li => li.id === inst.id)).length} Médicos</span>
                </div>
                <button className="text-primary font-bold hover:underline">Ver detalle</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-card p-8 shadow-2xl animate-scale-in relative overflow-hidden">
            <div className="absolute -top-24 -right-24 h-48 w-48 bg-primary/10 rounded-full blur-3xl" />
            
            <div className="flex flex-col items-center text-center space-y-6 relative z-10">
              <div className="h-16 w-16 rounded-2xl gradient-gold flex items-center justify-center shadow-xl shadow-primary/20 rotate-3">
                <FileSpreadsheet className="h-8 w-8 text-primary-foreground" />
              </div>
              
              <div>
                <h3 className="text-2xl font-display font-bold text-foreground tracking-tight">Carga Masiva de Clientes</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  Sube tu archivo Excel para importar múltiples clientes y vincularlos automáticamente a sus instituciones.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-4">
                <button 
                  onClick={() => downloadTemplate('clientes')}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border border-border bg-muted/30 hover:bg-muted/50 transition-all hover:scale-[1.02] group"
                >
                  <FileSpreadsheet className="h-6 w-6 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <span className="block text-sm font-bold">1. Descargar Formato</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black">Excel .xlsx</span>
                  </div>
                </button>

                <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:border-primary/50 transition-all hover:scale-[1.02] cursor-pointer group relative">
                  {importLoading ? (
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6 text-primary group-hover:-translate-y-1 transition-transform" />
                  )}
                  <div className="text-center">
                    <span className="block text-sm font-bold">2. Subir Archivo</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-black">Click para buscar</span>
                  </div>
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleBulkImport} disabled={importLoading} />
                </label>
              </div>

              <div className="w-full pt-4">
                <button 
                  onClick={() => setShowBulkImport(false)} 
                  className="w-full py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cerrar Ventana
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
