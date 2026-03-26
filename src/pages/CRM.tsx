import { useState, useEffect } from "react";
import { Users, Search, Plus, Building, Link2, X, Upload, FileSpreadsheet, Loader2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { parseClientsSheet } from "@/lib/excel-parsers";

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
      (supabase.from("clients").select("id, name, first_name, last_name, cod_cliente, contact_name, city, segment, pricing_level, visit_frequency, email, phone, address") as any),
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
    if (!newFirstName || !user) return;
    const fullName = `${newFirstName} ${newLastName}`.trim();
    const { error } = await supabase.from("clients").insert({
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
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Cliente creado", description: `${fullName} guardado exitosamente.` });
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
    const { error } = await supabase.from("institutions").insert({
      name: instName,
      type: instType,
      city: instCity || null,
      created_by: user.id,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Institución creada" });
    setShowNewInst(false);
    setInstName(""); setInstCity("");
    fetchData();
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
      
      const insertRows = rows.map(r => ({
        ...r,
        created_by: user.id,
        assigned_to: user.id
      }));

      const { error } = await supabase.from("clients").insert(insertRows as any);
      if (error) throw error;

      toast({ title: "Importación Exitosa", description: `${rows.length} clientes han sido cargados.` });
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
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">CRM & Clientes</h1>
          <p className="text-sm text-muted-foreground">Segmentación, Pricing y relación Médico-Institución</p>
        </div>
        <div className="flex gap-2">
          {isGerente && (
            <button onClick={() => setShowBulkImport(true)} className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
              <Plus className="h-4 w-4" />
              Carga Masiva (Excel)
            </button>
          )}
          <button onClick={() => setShowNewInst(true)} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Building className="h-4 w-4" />
            Nueva Institución
          </button>
          <button onClick={() => setShowNewClient(true)} className="flex items-center gap-2 rounded-lg gradient-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
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
            {editingClient ? `Editar Cliente: ${editingClient.name}` : "Nuevo Cliente / Médico"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Código Cliente</label>
              <input value={newCod} onChange={(e) => setNewCod(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" placeholder="C001..." />
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
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 block">Frecuencia de Visita</label>
              <select value={newFreq} onChange={(e) => setNewFreq(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowNewClient(false); setEditingClient(null); resetForm(); }} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button onClick={editingClient ? handleUpdateClient : handleCreateClient} disabled={!newFirstName} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50", editingClient ? "bg-secondary text-secondary-foreground" : "gradient-gold text-primary-foreground")}>
              {editingClient ? "Actualizar Cliente" : "Crear Cliente"}
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busque por código, nombre, segmento o ciudad..."
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all"
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

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Cód. Cliente</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Cliente / Médico</th>
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

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-2 border-primary/20 bg-card p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl gradient-emerald flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-foreground">Importación Masiva</h3>
                <p className="text-xs text-muted-foreground">Cargue su base de clientes desde un Excel.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition-colors relative cursor-pointer group">
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleBulkImport}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={importLoading}
                />
                <div className="space-y-2">
                  <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    {importLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary" />}
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {importLoading ? "Procesando..." : "Haga clic o arrastre su archivo .xlsx"}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Tamaño máximo: 10MB</p>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-4 border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Columnas requeridas</p>
                <div className="flex flex-wrap gap-1">
                  {["NOMBRE", "CONTACTO", "CIUDAD", "DIRECCION", "SEGMENTO", "NIVEL PRECIO"].map(c => (
                    <span key={c} className="px-1.5 py-0.5 rounded bg-background border border-border text-[9px] font-mono">{c}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button 
                onClick={() => setShowBulkImport(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                disabled={importLoading}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
