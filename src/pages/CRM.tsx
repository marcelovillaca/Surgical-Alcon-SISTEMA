import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, Plus, Building, Link2, X, Upload, FileSpreadsheet, Loader2, ShoppingCart, Activity, Trash2 } from "lucide-react";
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
  institutions: { id: string; name: string; city: string | null }[];
};

type Institution = { id: string; name: string; type: string | null; city: string | null };

const segmentos = [
  { label: "Check-in", color: "bg-chart-3" },
  { label: "Grow", color: "bg-primary" },
  { label: "Partner", color: "bg-secondary" },
  { label: "Protect", color: "bg-chart-5" },
];

const nivelColors: Record<string, string> = {
  A: "gradient-gold",
  B: "gradient-emerald",
  C: "bg-chart-3",
  D: "bg-muted",
};

const freqLabels: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  trimestral: "Trimestral",
};

export default function CRM() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isGerente } = useUserRole();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewInst, setShowNewInst] = useState(false);
  const [linkClientId, setLinkClientId] = useState<string | null>(null);
  const [linkInstId, setLinkInstId] = useState("");
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
        .select("id, name, first_name, last_name, cod_cliente, contact_name, city, segment, pricing_level, visit_frequency, email, phone, address")
        .eq("active", true) as any),
      supabase.from("institutions").select("id, name, type, city"),
    ]);

    if (clientsData) {
      // Fetch institution links
      const { data: links } = await supabase.from("client_institutions").select("client_id, institution_id");
      const enriched = clientsData.map((c) => {
        const instIds = links?.filter((l) => l.client_id === c.id).map((l) => l.institution_id) || [];
        const insts = instsData?.filter((i) => instIds.includes(i.id)) || [];
        return { ...c, institutions: insts.map(i => ({ id: i.id, name: i.name, city: i.city })) } as Client;
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
      created_by: user.id,
      assigned_to: user.id,
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
    toast({ title: "✅ Cliente actualizado" });
    setEditingClient(null);
    resetForm();
    fetchData();
  };

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm("¿Está seguro de eliminar este cliente? Se mantendrá en el historial pero no aparecerá en las listas activas.")) return;
    
    const { error } = await supabase
      .from("clients")
      .update({ active: false } as any)
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
  };

  const resetForm = () => {
    setNewFirstName(""); setNewLastName(""); setNewCod("");
    setNewContact(""); setNewCity(""); setNewAddress("");
    setNewEmail(""); setNewPhone("");
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
          created_by: user.id,
          assigned_to: user.id,
          active: true
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

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Código, nombre, ciudad..."
            className="w-full rounded-xl border border-border bg-card h-12 pl-10 pr-4 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <div className="flex rounded-lg border border-border p-1 bg-card">
            {["A", "B", "C", "D"].map(p => (
              <button
                key={p}
                onClick={() => setActivePricing(activePricing === p ? null : p)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                  activePricing === p ? nivelColors[p] + " text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {segmentos.map(s => {
              const segKey = s.label.toLowerCase().replace("-", "_");
              const active = activeSegment === segKey;
              return (
                <button
                  key={s.label}
                  onClick={() => setActiveSegment(active ? null : segKey)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                    active ? "bg-primary/20 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {(activeSegment || activePricing || search) && (
            <button onClick={() => { setActiveSegment(null); setActivePricing(null); setSearch(""); }} className="text-xs text-primary font-bold hover:underline px-2">Limpiar</button>
          )}
        </div>
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

      {/* DESKTOP: Table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Cód. Cliente</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Cliente</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Instituciones</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Segmento</th>
              <th className="px-4 py-3 font-medium text-muted-foreground text-center">Nivel</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Freq. Visita</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Contacto</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Ciudad</th>
              <th className="px-4 py-3 font-medium text-muted-foreground text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sin resultados</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded border font-bold",
                        c.cod_cliente ? "text-primary border-primary/30 bg-primary/5" : "text-muted-foreground border-border bg-muted/20"
                      )}>
                        {c.cod_cliente || "S/C"}
                      </span>
                      {c.cod_cliente && <ShoppingCart className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{c.name}</span>
                      {c.first_name && <span className="text-[10px] text-muted-foreground opacity-70">{c.first_name} {c.last_name}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.institutions.map((inst) => (
                        <span key={inst.id} className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary">
                          <Building className="h-2.5 w-2.5" />
                          {inst.name}
                          <button onClick={() => handleUnlink(c.id, inst.id)} className="ml-0.5 hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                        </span>
                      ))}
                      {c.institutions.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{c.segment.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", nivelColors[c.pricing_level], c.pricing_level === "D" ? "text-muted-foreground" : "text-primary-foreground")}>
                      {c.pricing_level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.visit_frequency ? freqLabels[c.visit_frequency] || c.visit_frequency : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.contact_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.city || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                       <button onClick={() => navigate(`/crm/intelligence/${c.id}`)} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 transition-colors">
                         <Activity className="h-3 w-3" /> Inteligencia
                       </button>
                       <button onClick={() => startEdit(c)} className="inline-flex items-center gap-1 rounded-lg bg-secondary/10 px-2 py-1 text-xs text-secondary hover:bg-secondary/20 transition-colors">
                         Editar
                       </button>
                       <button onClick={() => setLinkClientId(c.id)} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                         <Link2 className="h-3 w-3" /> Vincular
                       </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE: Client Cards */}
      <div className="lg:hidden space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 rounded-lg bg-primary/20 animate-pulse" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Sin resultados</div>
        )}
        {!loading && filtered.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden ring-1 ring-white/5">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center font-black text-sm border-2 shrink-0",
                  c.pricing_level === "A" ? "border-amber-400 bg-amber-400/10 text-amber-400" :
                  c.pricing_level === "B" ? "border-emerald-400 bg-emerald-400/10 text-emerald-400" :
                  c.pricing_level === "C" ? "border-blue-400 bg-blue-400/10 text-blue-400" :
                  "border-border bg-muted/20 text-muted-foreground"
                )}>{c.pricing_level}</div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.city || "—"} · <span className="capitalize">{c.segment.replace("_", " ")}</span></p>
                </div>
              </div>
              {c.cod_cliente && (
                <span className="text-[10px] font-mono font-bold text-primary/70 border border-primary/20 bg-primary/5 px-2 py-1 rounded-lg shrink-0 ml-2">
                  {c.cod_cliente}
                </span>
              )}
            </div>
            <div className="px-4 py-3 space-y-2 text-[11px]">
              {c.visit_frequency && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Frec.:</span>
                  <span className="font-semibold">{freqLabels[c.visit_frequency] || c.visit_frequency}</span>
                </div>
              )}
              {c.contact_name && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Contacto:</span>
                  <span className="truncate">{c.contact_name}</span>
                </div>
              )}
              {c.institutions.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <Building className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {c.institutions.map((inst) => (
                      <span key={inst.id} className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary">
                        {inst.name}
                        <button onClick={() => handleUnlink(c.id, inst.id)} className="ml-0.5 hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex border-t border-white/5">
              <button
                onClick={() => startEdit(c)}
                className="flex-1 h-11 flex items-center justify-center gap-2 text-xs font-bold text-secondary hover:bg-secondary/10 transition-colors border-r border-white/5"
              >
                Editar
              </button>
               <button
                onClick={() => setLinkClientId(c.id)}
                className="flex-1 h-11 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" /> Vincular Inst.
              </button>
            </div>
          </div>
        ))}
      </div>

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
