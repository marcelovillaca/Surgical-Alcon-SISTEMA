import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { UserPlus, Copy, Check, Clock, Users, Shield, Lock, Unlock, Trash2, RefreshCw, Loader2, UserCheck, ShieldAlert, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Invitation = {
  id: string;
  email: string;
  role: string;
  invite_code: string;
  expires_at: string;
  used: boolean;
  created_at: string;
};

const ROLES = [
  { value: "gerente",           label: "Gerente General" },
  { value: "visitador",         label: "Visitador" },
  { value: "bodega",            label: "Bodega" },
  { value: "expedicion",        label: "Expedición" },
  { value: "admin_conofta",     label: "Admin CONOFTA" },
  { value: "coordinador_local", label: "Coordinador Local" },
] as const;

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function InviteUsers() {
  const { user }                          = useAuth();
  const { isGerente, loading: roleLoading } = useUserRole();
  const { toast }                         = useToast();

  // ── Form state ───────────────────────────────────────────────────────────────
  const [email, setEmail]               = useState("");
  const [role, setRole]                 = useState<string>("visitador");
  const [selectedInstitution, setSelectedInstitution] = useState<string>("");
  const [isManual, setIsManual]         = useState(false);
  const [manualData, setManualData]     = useState({ firstname: "", lastname: "", city: "", phone: "", birth_date: "" });
  const [loading, setLoading]           = useState(false);
  const [formError, setFormError]       = useState("");
  const [formSuccess, setFormSuccess]   = useState("");

  // ── Data state ────────────────────────────────────────────────────────────────
  const [invitations, setInvitations]   = useState<Invitation[]>([]);
  const [activeUsers, setActiveUsers]   = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<"invitations" | "active" | "pending">("invitations");

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    try {
      // Buscar roles com perfil completo
      // 1. Buscar roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");
      if (rolesError) throw rolesError;

      // 2. Buscar TODOS os perfis
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (profilesError) throw profilesError;

      // 3. Buscar instituições
      const { data: instData } = await supabase.from("institutions").select("id, name");
      const instMap = new Map((instData ?? []).map(i => [i.id, i.name]));
      setInstitutions(instData ?? []);

      // 4. Criar mapa de perfis
      // SCHEMA PRODUÇÃO: profiles.id = auth.users.id (sem coluna user_id separada)
      // user_roles.user_id = auth.users.id
      // Portanto: profileMap usa profiles.id como chave
      const profileMap = new Map<string, any>();
      (profilesData ?? []).forEach(p => {
        const key = p.id; // profiles.id = auth UUID neste schema
        if (key) profileMap.set(key, p);
      });

      // 5. Merge roles + profiles + institution name
      const merged = (rolesData ?? []).map(r => ({
        ...r,
        profile:          profileMap.get(r.user_id) ?? null,
        institution_name: r.institution_id ? (instMap.get(r.institution_id) ?? "—") : null,
      }));
      setActiveUsers(merged);

      // 6. Pendentes = perfis sem role
      const activeIds = new Set((rolesData ?? []).map(r => r.user_id));
      const pending = (profilesData ?? []).filter(p => {
        return p.id && !activeIds.has(p.id);
      });
      setPendingUsers(pending);
    } catch (e: any) {
      toast({ title: "Error cargando usuarios", description: e.message, variant: "destructive" });
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data } = await supabase
        .from("user_invitations")
        .select("*")
        .order("created_at", { ascending: false });
      setInvitations((data ?? []) as Invitation[]);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchInvitations(); fetchUsers(); }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    setFormSuccess("");

    if (!email || !email.includes("@")) {
      setFormError("Por favor ingrese un email válido.");
      setLoading(false);
      return;
    }
    if (role === "coordinador_local" && !selectedInstitution) {
      setFormError("Debe seleccionar una Sede para el Coordinador Local.");
      setLoading(false);
      return;
    }

    // ✅ Verificar se o email já existe como usuário ativo ou convite pendente
    const emailLower = email.toLowerCase().trim();
    const alreadyActive = activeUsers.some(u => u.profile?.email?.toLowerCase() === emailLower);
    if (alreadyActive) {
      setFormError("Este email ya tiene acceso activo en el sistema.");
      setLoading(false);
      return;
    }
    const alreadyInvited = invitations.some(
      inv => inv.email.toLowerCase() === emailLower && !inv.used && !isExpired(inv.expires_at)
    );
    if (alreadyInvited) {
      setFormError("Ya existe una invitación pendiente para este email. Puede regenerar el código si expiró.");
      setLoading(false);
      return;
    }

    const code      = generateCode();
    const hours     = isManual ? 48 : 72;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const inviteData: any = {
      email:          email.toLowerCase().trim(),
      role:           role,
      invite_code:    code,
      expires_at:     expiresAt,
      created_by:     user?.id ?? null,
      institution_id: role === "coordinador_local" ? selectedInstitution : null,
      metadata:       isManual ? manualData : {},
    };

    // Cast as any para evitar erro de tipos do schema cache desatualizado
    const { error: insertError } = await (supabase.from("user_invitations") as any).insert([inviteData]);

    if (insertError) {
      setFormError(`Error: ${insertError.message}`);
    } else {
      setFormSuccess(`✅ ${isManual ? "Registro Manual" : "Invitación"} creada! Código: ${code} (válido por ${hours}h)`);
      setEmail("");
      setSelectedInstitution("");
      setManualData({ firstname: "", lastname: "", city: "", phone: "", birth_date: "" });
      fetchInvitations();
    }
    setLoading(false);
  };

  // SCHEMA PRODUÇÃO: profiles.id = auth UUID (não existe coluna user_id em profiles)
  const handleUpdateProfile = async (authUserId: string, firstName: string, lastName: string) => {
    if (!authUserId) return;
    const fullName = `${firstName} ${lastName}`.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ firstname: firstName, lastname: lastName, full_name: fullName })
      .eq("id", authUserId); // ✅ profiles.id = auth UUID neste schema

    if (!error) {
      toast({ title: "Perfil actualizado", description: "Los cambios han sido guardados." });
      fetchUsers();
    } else {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleAssignRole = async (userId: string, targetRole: string, institutionId?: string) => {
    if (!targetRole) return;
    const { error } = await (supabase.from("user_roles") as any).insert({
      user_id:        userId,
      role:           targetRole,
      is_blocked:     false,
      institution_id: targetRole === "coordinador_local" ? institutionId : null,
    });
    if (!error) {
      toast({ title: "Acceso Concedido", description: "El usuario ya puede ingresar al sistema." });
      fetchUsers();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleChangeRole = async (userId: string, newRole: string, institutionId?: string) => {
    const updateData: any = { role: newRole };
    updateData.institution_id = newRole === "coordinador_local" ? (institutionId ?? null) : null;
    const { error } = await (supabase.from("user_roles") as any).update(updateData).eq("user_id", userId);
    if (!error) {
      toast({ title: "Rol actualizado" });
      fetchUsers();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleChangeInstitution = async (userId: string, instId: string) => {
    const { error } = await supabase.from("user_roles").update({ institution_id: instId } as any).eq("user_id", userId);
    if (!error) { toast({ title: "Sede actualizada" }); fetchUsers(); }
    else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const handleToggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    if (!confirm(`¿Desea ${currentlyBlocked ? "desbloquear" : "bloquear"} este usuario?`)) return;
    const { error } = await (supabase.from("user_roles") as any).update({ is_blocked: !currentlyBlocked }).eq("user_id", userId);
    if (!error) {
      toast({ title: currentlyBlocked ? "Usuario desbloqueado ✅" : "Usuario bloqueado 🔒" });
      fetchUsers();
    } else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const handleRemoveRole = async (userId: string) => {
    if (!confirm("¿Está seguro de revocar el acceso? El usuario no podrá ingresar al sistema.")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (!error) {
      toast({ title: "Acceso revocado", description: "El usuario fue movido a Pendientes." });
      fetchUsers();
    } else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const handleManualReset = async (email: string, userId: string) => {
    if (!confirm(`¿Enviar link de recuperación a ${email}?`)) return;
    await supabase.from("profiles").update({ must_change_password: true } as any).eq("user_id", userId);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/auth?type=recovery`,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Reset enviado ✅", description: "El usuario recibirá un correo para cambiar su contraseña." });
  };

  const cancelInvitation = async (id: string, email: string) => {
    if (!confirm(`¿Cancelar la invitación para ${email}?`)) return;
    const { error } = await supabase.from("user_invitations").delete().eq("id", id);
    if (!error) {
      toast({ title: "Invitación eliminada" });
      fetchInvitations();
    } else toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const regenerateCode = async (id: string, email: string, invRole: string) => {
    const newCode   = generateCode();
    const newExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    await supabase.from("user_invitations").update({ used: true }).eq("id", id);
    await (supabase.from("user_invitations") as any).insert({
      email, role: invRole, invite_code: newCode, expires_at: newExpiry, created_by: user?.id ?? null,
    });
    fetchInvitations();
    toast({ title: "Código regenerado", description: `Nuevo código: ${newCode}` });
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  // ── Name helper ───────────────────────────────────────────────────────────────
  const displayName = (p: any) => {
    const fn = p?.firstname || "";
    const ln = p?.lastname  || "";
    return (fn + " " + ln).trim() || p?.full_name || "—";
  };
  const initials = (p: any) => (displayName(p)[0] || "U").toUpperCase();

  // ── Loading gate ──────────────────────────────────────────────────────────────
  if (roleLoading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground animate-pulse">Verificando credenciales...</p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in px-2 sm:px-4 lg:px-8 max-w-5xl mx-auto">

      {/* ─── Header + Tabs ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-500" /> Gestión de Usuarios
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Invitaciones, activación y privilegios del sistema.</p>
        </div>
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border gap-1">
          {(["invitations", "pending", "active"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-lg transition-all relative",
                activeTab === tab
                  ? tab === "pending" ? "bg-amber-600 text-white shadow-md" : "bg-blue-600 text-white shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "invitations" ? "Invitaciones" : tab === "pending" ? "Pendientes" : "Activos"}
              {tab === "pending" && pendingUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 text-[10px] flex items-center justify-center rounded-full border-2 border-background text-white">
                  {pendingUsers.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ TAB: INVITACIONES ═══════════════ */}
      {activeTab === "invitations" && (
        <div className="grid gap-6">
          {/* Form card */}
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
            {/* Mode toggle */}
            <div className="flex bg-muted/30 p-1.5 rounded-xl border border-border/50 mb-6">
              <button type="button" onClick={() => setIsManual(false)}
                className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all",
                  !isManual ? "bg-blue-600 text-white shadow-lg" : "text-muted-foreground")}>
                Solo Invitación (72h)
              </button>
              <button type="button" onClick={() => setIsManual(true)}
                className={cn("flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all",
                  isManual ? "bg-amber-600 text-white shadow-lg" : "text-muted-foreground")}>
                Registro Manual (48h)
              </button>
            </div>

            <form onSubmit={handleInvite} className="flex flex-col gap-5">
              {/* Email + Ciudad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full mt-2 rounded-xl border border-border bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="usuario@ejemplo.com" />
                </div>
                {isManual && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Ciudad</label>
                    <input value={manualData.city} onChange={e => setManualData({ ...manualData, city: e.target.value })}
                      className="w-full mt-2 rounded-xl border border-border bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Ej: Asunción" />
                  </div>
                )}
              </div>

              {/* Manual extra fields */}
              {isManual && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
                  {[
                    { label: "Nombre *",   key: "firstname",  required: true },
                    { label: "Apellido *",  key: "lastname",   required: true },
                    { label: "Teléfono",   key: "phone",      required: false },
                  ].map(({ label, key, required }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">{label}</label>
                      <input value={(manualData as any)[key]}
                        onChange={e => setManualData({ ...manualData, [key]: e.target.value })}
                        required={required}
                        className="w-full mt-2 rounded-xl border border-border bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Fecha Nac.</label>
                    <input type="date" value={manualData.birth_date}
                      onChange={e => setManualData({ ...manualData, birth_date: e.target.value })}
                      className="w-full mt-2 rounded-xl border border-border bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              )}

              {/* Role selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Rol del Usuario</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {ROLES.map(r => (
                    <button key={r.value} type="button" onClick={() => setRole(r.value)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 active:scale-95",
                        role === r.value
                          ? "border-primary bg-primary/10 ring-4 ring-primary/10"
                          : "border-border bg-card/40 hover:border-primary/50"
                      )}>
                      <Shield className={cn("h-4 w-4", role === r.value ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-[9px] font-black uppercase text-center leading-tight",
                        role === r.value ? "text-foreground" : "text-muted-foreground")}>{r.label}</span>
                    </button>
                  ))}
                </div>
                {role === "coordinador_local" && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Sede Asignada *</label>
                    <select required value={selectedInstitution} onChange={e => setSelectedInstitution(e.target.value)}
                      className="w-full mt-2 h-12 bg-background border-2 border-border rounded-xl px-4 text-sm font-bold focus:border-primary outline-none">
                      <option value="">Seleccione una sede...</option>
                      {institutions.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {formError   && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">{formError}</div>}
              {formSuccess && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs font-bold">{formSuccess}</div>}

              <button type="submit" disabled={loading}
                className={cn("h-14 text-white rounded-xl font-bold text-sm shadow-xl disabled:opacity-50 transition-all",
                  isManual ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500")}>
                {loading
                  ? <Loader2 className="animate-spin mx-auto h-5 w-5" />
                  : isManual ? "💾 Guardar Registro Manual" : "📨 Enviar Invitación"}
              </button>
            </form>
          </div>

          {/* Historial */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 bg-muted/30 border-b border-border font-bold text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" /> Historial de Códigos ({invitations.length})
            </div>
            <div className="divide-y divide-border">
              {invitations.length === 0 && (
                <div className="p-12 text-center text-muted-foreground italic text-sm">No hay invitaciones registradas.</div>
              )}
              {invitations.map(inv => {
                const used    = inv.used;
                const expired = isExpired(inv.expires_at);
                const pending = !used && !expired;
                return (
                  <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/5 transition-colors">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-bold text-sm truncate">{inv.email}</span>
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="text-[9px] uppercase font-black px-2 py-0.5 border border-blue-500/30 text-blue-400 rounded">{inv.role}</span>
                        <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded",
                          used    ? "bg-emerald-500/10 text-emerald-400" :
                          expired ? "bg-rose-500/10 text-rose-400" :
                                    "bg-blue-500/10 text-blue-400")}>
                          {used ? "✓ Canjeado" : expired ? "⏱ Expirado" : "⏳ Pendiente"}
                        </span>
                        {pending && (
                          <span className="text-[9px] text-muted-foreground/60">
                            Expira: {new Date(inv.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {pending && (
                        <div className="flex items-center gap-1 bg-muted/30 p-1.5 rounded-lg border border-border">
                          <code className="text-xs font-black tracking-widest px-2">{inv.invite_code}</code>
                          <button onClick={() => copyCode(inv.invite_code, inv.id)} className="p-1 hover:text-primary transition-colors">
                            {copiedId === inv.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      )}
                      {expired && !used && (
                        <button onClick={() => regenerateCode(inv.id, inv.email, inv.role)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors text-[10px] font-bold">
                          <RefreshCw className="h-3 w-3" /> Regenerar
                        </button>
                      )}
                      {/* ✅ Botão de excluir sempre visível para pendente ou expirado */}
                      {!used && (
                        <button onClick={() => cancelInvitation(inv.id, inv.email)}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors" title="Eliminar invitación">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: PENDIENTES ═══════════════ */}
      {activeTab === "pending" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg animate-in slide-in-from-bottom-2">
          <div className="px-6 py-4 bg-amber-500/10 border-b border-amber-500/20 font-bold text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-500">
              <ShieldAlert className="h-4 w-4" /> Pendientes de Activación
            </div>
            <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{pendingUsers.length} usuarios</span>
          </div>
          <div className="divide-y divide-border">
            {pendingUsers.length === 0 && (
              <div className="p-12 text-center text-muted-foreground italic flex flex-col items-center gap-3">
                <UserCheck className="h-10 w-10 opacity-20" />
                <p className="text-sm">No hay usuarios pendientes de activación.</p>
              </div>
            )}
            {pendingUsers.map(u => (
              <div key={u.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center font-bold text-amber-500">
                    {initials(u)}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 group">
                      {/* profiles.id = auth UUID neste schema de produção */}
                      <input type="text" defaultValue={u.firstname || ""} placeholder="Nombre"
                        onBlur={e => handleUpdateProfile(u.id, e.target.value, u.lastname || "")}
                        className="text-sm font-bold bg-transparent border-b border-border/20 hover:border-emerald-500/50 focus:border-emerald-500 outline-none transition-all px-1 max-w-[110px]" />
                      <input type="text" defaultValue={u.lastname || ""} placeholder="Apellido"
                        onBlur={e => handleUpdateProfile(u.id, u.firstname || "", e.target.value)}
                        className="text-sm font-bold bg-transparent border-b border-border/20 hover:border-emerald-500/50 focus:border-emerald-500 outline-none transition-all px-1 max-w-[110px]" />
                      <Edit className="h-3 w-3 text-muted-foreground/30 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase italic">Asignar Rol:</span>
                  <select defaultValue=""
                    onChange={e => {
                      const tr = e.target.value;
                      if (tr === "coordinador_local" && !selectedInstitution) {
                        toast({ title: "Sede requerida", description: "Seleccione una sede en Invitaciones antes de asignar coordinador.", variant: "destructive" });
                        return;
                      }
                      handleAssignRole(u.id, tr, selectedInstitution || undefined); // u.id = auth UUID

                    }}
                    className="bg-background border border-border rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="" disabled>Seleccionar rol...</option>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: ACTIVOS ═══════════════ */}
      {activeTab === "active" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg animate-in slide-in-from-bottom-2">
          <div className="px-6 py-4 bg-muted/30 border-b border-border font-bold text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-500" /> Usuarios con Acceso Activo ({activeUsers.length})
          </div>
          <div className="divide-y divide-border">
            {activeUsers.length === 0 && (
              <div className="p-12 text-center text-muted-foreground italic">No hay usuarios activos registrados.</div>
            )}
            {activeUsers.map(u => {
              const profile = u.profile; // ✅ from merged fetch (not profiles?.[0])
              return (
                <div key={u.user_id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/5 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0 text-base",
                      u.is_blocked ? "bg-rose-500" : "bg-emerald-600")}>
                      {initials(profile)}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      {/* Nome editável */}
                      <div className="flex items-center gap-2 group flex-wrap">
                        <input type="text" defaultValue={profile?.firstname || ""} placeholder="Nombre"
                          onBlur={e => handleUpdateProfile(u.user_id, e.target.value, profile?.lastname || "")}
                          className="text-sm font-bold bg-transparent border-b border-border/20 hover:border-emerald-500/50 focus:border-emerald-500 outline-none transition-all px-1 max-w-[110px]" />
                        <input type="text" defaultValue={profile?.lastname || ""} placeholder="Apellido"
                          onBlur={e => handleUpdateProfile(u.user_id, profile?.firstname || "", e.target.value)}
                          className="text-sm font-bold bg-transparent border-b border-border/20 hover:border-emerald-500/50 focus:border-emerald-500 outline-none transition-all px-1 max-w-[110px]" />
                        <Edit className="h-3 w-3 text-muted-foreground/30 group-hover:text-emerald-500 transition-colors shrink-0" />
                        {u.is_blocked && <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full uppercase font-black">Bloqueado</span>}
                      </div>
                      {/* Email · Rol · Sede */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground truncate">{profile?.email}</span>
                        <span className="text-muted-foreground/30 text-[10px]">·</span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">{u.role}</span>
                        {u.institution_name && (
                          <>
                            <span className="text-muted-foreground/30 text-[10px]">·</span>
                            <span className="text-[9px] font-bold text-emerald-400">🏥 {u.institution_name}</span>
                          </>
                        )}
                        {u.user_id === user?.id && <span className="text-[9px] text-blue-400 font-bold">(Tú)</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Role selector */}
                    <select value={u.role} disabled={u.user_id === user?.id}
                      onChange={e => handleChangeRole(u.user_id, e.target.value, selectedInstitution || undefined)}
                      className="text-[10px] font-bold bg-background border border-border rounded-lg px-2 py-1.5 outline-none disabled:opacity-50">
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>

                    {/* Institution selector (só para coordinador) */}
                    {u.role === "coordinador_local" && (
                      <select value={u.institution_id || ""} onChange={e => handleChangeInstitution(u.user_id, e.target.value)}
                        className="text-[10px] font-bold bg-background border border-emerald-500/30 text-emerald-400 rounded-lg px-2 py-1 outline-none">
                        <option value="" disabled>Sede...</option>
                        {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                      </select>
                    )}

                    {/* Actions */}
                    {u.user_id !== user?.id && (
                      <div className="flex gap-1">
                        <button onClick={() => handleManualReset(profile?.email, u.user_id)}
                          className="p-2 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors" title="Reset de contraseña">
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleToggleBlock(u.user_id, u.is_blocked)}
                          className={cn("p-2 rounded-lg transition-colors",
                            u.is_blocked ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10")}
                          title={u.is_blocked ? "Desbloquear" : "Bloquear"}>
                          {u.is_blocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        </button>
                        <button onClick={() => handleRemoveRole(u.user_id)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors" title="Revocar acceso">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
