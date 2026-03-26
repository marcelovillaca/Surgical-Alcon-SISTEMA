import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { UserPlus, Copy, Check, Clock, Users, ShieldX, UserMinus, Shield, Lock, Unlock } from "lucide-react";
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
  { value: "gerente", label: "Gerente" },
  { value: "visitador", label: "Visitador" },
  { value: "bodega", label: "Bodega" },
  { value: "expedicion", label: "Expedición" },
  { value: "admin_conofta", label: "Admin Central CONOFTA" },
  { value: "coordinador_local", label: "Coordinador Local" },
] as const;

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function InviteUsers() {
  const { user } = useAuth();
  const { isGerente, loading: roleLoading } = useUserRole();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("visitador");
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"invitations" | "active">("invitations");
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchUsers = async () => {
    const { data: rolesData } = await (supabase
      .from("user_roles")
      .select("*") as any);
    
    if (rolesData) {
      setActiveUsers(rolesData);
    }

    const { data: instData } = await supabase.from("institutions").select("id, name");
    if (instData) setInstitutions(instData);
  };

  const [institutions, setInstitutions] = useState<any[]>([]);

  const fetchInvitations = async () => {
    const { data } = await supabase
      .from("user_invitations")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setInvitations(data as Invitation[]);
  };

  useEffect(() => {
    fetchInvitations();
    fetchUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72 hours (3 days)

    const { error: insertError } = await supabase.from("user_invitations").insert({
      email: email.toLowerCase().trim(),
      role: role as any,
      invite_code: code,
      expires_at: expiresAt,
      created_by: user?.id,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess(`Invitación creada. Código: ${code}`);
      setEmail("");
      fetchInvitations();
    }
    setLoading(false);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  const regenerateCode = async (id: string, email: string, invRole: string) => {
    const newCode = generateCode();
    const newExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72h
    await supabase.from("user_invitations").update({ used: true }).eq("id", id);
    await supabase.from("user_invitations").insert({
      email,
      role: invRole as any,
      invite_code: newCode,
      expires_at: newExpiry,
      created_by: user?.id,
    });
    fetchInvitations();
  };

  const handleRemoveRole = async (userId: string) => {
    if (!confirm("¿Está seguro de revocar el acceso a este usuario? Esto eliminará su rol asignado.")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (!error) {
      toast({ title: "Acceso revocado", description: "El usuario ya no tiene permisos en el sistema." });
      fetchUsers();
    }
  };

  const handleToggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    const action = currentlyBlocked ? "desbloquear" : "bloquear";
    if (!confirm(`¿Está seguro de ${action} este usuario?`)) return;
    const { error } = await (supabase.from("user_roles") as any)
      .update({ is_blocked: !currentlyBlocked })
      .eq("user_id", userId);
    if (!error) {
      toast({
        title: currentlyBlocked ? "✅ Usuario desbloqueado" : "🔒 Usuario bloqueado",
        description: currentlyBlocked
          ? "El usuario puede volver a iniciar sesión."
          : "El usuario no podrá ingresar al sistema hasta ser desbloqueado.",
      });
      fetchUsers();
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", userId);
    if (!error) {
      toast({ title: "Rol atualizado", description: `Usuario movido a ${newRole}.` });
      fetchUsers();
    }
  };

  const handleChangeInstitution = async (userId: string, instId: string) => {
    const { error } = await supabase.from("user_roles").update({ institution_id: instId === "none" ? null : instId } as any).eq("user_id", userId);
    if (!error) {
      toast({ title: "Sede atualizada", description: "Se ha vinculado/desvinculado la sede correctamente." });
      fetchUsers();
    }
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-lg gradient-emerald animate-pulse" />
      </div>
    );
  }

  if (!isGerente) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-lg font-display font-bold text-foreground">Acceso Denegado</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Solo los usuarios con rol de <span className="font-semibold text-primary">Gerente</span> pueden acceder a la gestión de usuarios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 p-6 rounded-3xl bg-card/30 border border-white/5 glass-surface shadow-xl">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground tracking-tighter flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Gestión de Accesos
          </h2>
          <p className="text-sm text-muted-foreground ml-8">Controle quién entra al sistema y con qué nivel de permisos.</p>
        </div>
        <div className="flex rounded-xl bg-background/50 border border-border p-1 shadow-inner ring-1 ring-white/5">
          <button
            onClick={() => setActiveTab("invitations")}
            className={cn(
              "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
              activeTab === "invitations" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
            )}
          >
            Invitaciones
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={cn(
              "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
              activeTab === "active" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
            )}
          >
            Usuarios Activos
          </button>
        </div>
      </div>

      {activeTab === "invitations" ? (
        <div className="space-y-6">
          {/* Invite Form */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-card to-emerald-500/5 p-6 shadow-2xl glass-surface relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
              <UserPlus className="h-20 w-20 text-emerald-500" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-6 flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Nueva Invitación
            </h3>
            <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div className="min-w-[150px]">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Rol</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg gradient-emerald px-6 py-2.5 text-sm font-semibold text-secondary-foreground transition-all hover:shadow-lg disabled:opacity-50"
              >
                {loading ? "Generando..." : "Enviar Invitación"}
              </button>
            </form>
            {error && <p className="text-xs text-destructive mt-2 font-medium">{error}</p>}
            {success && <p className="text-xs text-emerald-500 font-bold mt-2">{success}</p>}
          </div>

          {/* Invitations List */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Historial de Códigos ({invitations.length})
              </h3>
            </div>
            <div className="divide-y divide-border">
              {invitations.length === 0 && (
                <p className="p-12 text-sm text-muted-foreground text-center italic">No hay invitaciones activas.</p>
              )}
              {invitations.map((inv) => {
                const expired = isExpired(inv.expires_at);
                return (
                  <div key={inv.id} className="p-4 flex items-center justify-between gap-4 group transition-colors hover:bg-muted/10">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{inv.email}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-primary/20 text-primary">
                          {inv.role}
                        </span>
                        {inv.used ? (
                          <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Canjeado
                          </span>
                        ) : expired ? (
                          <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Expirado
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1 animate-pulse">
                            <Clock className="h-3 w-3" /> Pendiente
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {!inv.used && !expired && (
                        <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border">
                          <code className="text-xs font-mono font-black text-foreground px-3 tracking-[0.2em]">
                            {inv.invite_code}
                          </code>
                          <button
                            onClick={() => copyCode(inv.invite_code, inv.id)}
                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-all"
                            title="Copiar código"
                          >
                            {copiedId === inv.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      )}
                      {!inv.used && expired && (
                        <button
                          onClick={() => regenerateCode(inv.id, inv.email, inv.role)}
                          className="text-[10px] font-black uppercase text-primary hover:underline px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5"
                        >
                          Regenerar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Roles Asignados ({activeUsers.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {activeUsers.length === 0 && (
              <p className="p-12 text-sm text-muted-foreground text-center italic">Cargando usuarios...</p>
            )}
            {activeUsers.map((u) => (
              <div key={u.user_id} className="p-4 flex items-center justify-between gap-4 transition-colors hover:bg-muted/10">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center font-bold text-secondary-foreground shrink-0 uppercase",
                    u.is_blocked ? "bg-rose-500/20 text-rose-400" : "gradient-emerald"
                  )}>
                    {u.is_blocked
                      ? <Lock className="h-4 w-4" />
                      : (u.profiles?.[0]?.full_name || "U")[0]
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{u.profiles?.[0]?.full_name || "Usuario sin nombre"}</p>
                      {u.is_blocked && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                          🔒 Bloqueado
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Registrado el: {u.profiles?.[0]?.created_at ? new Date(u.profiles?.[0]?.created_at).toLocaleDateString() : '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-2">
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u.user_id, e.target.value)}
                      className="h-9 px-3 rounded-lg border border-border bg-background text-[11px] font-bold text-foreground focus:ring-1 focus:ring-primary shadow-sm hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value} className="bg-background text-foreground">
                          {r.label}
                        </option>
                      ))}
                    </select>
                    
                    {u.role === "coordinador_local" && (
                      <div className="relative group/sede">
                        <select
                          value={u.institution_id || "none"}
                          onChange={(e) => handleChangeInstitution(u.user_id, e.target.value)}
                          className="w-full h-8 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-[10px] font-bold text-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer hover:bg-emerald-500/10"
                        >
                          <option value="none" className="bg-background text-muted-foreground">📍 Seleccionar Sede...</option>
                          {institutions.map(inst => (
                            <option key={inst.id} value={inst.id} className="bg-background text-foreground">
                              {inst.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {u.user_id !== user?.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleBlock(u.user_id, u.is_blocked)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          u.is_blocked
                            ? "text-amber-400 hover:bg-amber-500/10"
                            : "text-muted-foreground hover:bg-white/5"
                        )}
                        title={u.is_blocked ? "Desbloquear usuario" : "Bloquear acceso"}
                      >
                        {u.is_blocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleRemoveRole(u.user_id)}
                        className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Quitar Rol permanentemente"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
