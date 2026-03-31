import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { UserPlus, Copy, Check, Clock, Users, ShieldX, UserMinus, Shield, Lock, Unlock, Trash2, RefreshCw, MailCheck } from "lucide-react";
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
  const [institutions, setInstitutions] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      const { data: rolesData } = await supabase.from("user_roles").select("*, profiles:user_id(full_name, created_at)");
      if (rolesData) setActiveUsers(rolesData);
      const { data: instData } = await supabase.from("institutions").select("id, name");
      if (instData) setInstitutions(instData);
    } catch (e) { console.error(e); }
  };

  const fetchInvitations = async () => {
    try {
      const { data } = await supabase
        .from("user_invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setInvitations(data as Invitation[]);
    } catch (e) { console.error(e); }
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

    if (!email || !email.includes("@")) {
      setError("Por favor ingrese un email válido.");
      setLoading(false);
      return;
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const inviteData = {
      email: email.toLowerCase().trim(),
      role: role,
      invite_code: code,
      expires_at: expiresAt,
      created_by: user?.id || null, // Allow null for emergency recovery
    };

    console.log("Submitting invite:", inviteData);

    const { error: insertError } = await (supabase.from("user_invitations") as any).insert([inviteData]);

    if (insertError) {
      console.error("Invite Error:", insertError);
      setError(`Error: ${insertError.message || 'Error de conexión'}`);
    } else {
      setSuccess(`✅ ¡Invitación creada! Código: ${code}`);
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
    const newExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    await supabase.from("user_invitations").update({ used: true }).eq("id", id);
    await supabase.from("user_invitations").insert({
      email,
      role: invRole as any,
      invite_code: newCode,
      expires_at: newExpiry,
      created_by: user?.id || null,
    });
    fetchInvitations();
  };

  const handleRemoveRole = async (userId: string) => {
    if (!confirm("¿Está seguro de revocar el acceso?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (!error) { fetchUsers(); }
  };

  const handleToggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    if (!confirm(`¿Desea ${currentlyBlocked ? 'desbloquear' : 'bloquear'} este usuario?`)) return;
    const { error } = await (supabase.from("user_roles") as any).update({ is_blocked: !currentlyBlocked }).eq("user_id", userId);
    if (!error) fetchUsers();
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", userId);
    fetchUsers();
  };

  const cancelInvitation = async (id: string, email: string) => {
    if (!confirm(`¿Cancelar la invitación para ${email}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("user_invitations").delete().eq("id", id);
    if (!error) {
      toast({ title: "Invitación cancelada", description: `La invitación para ${email} fue eliminada.` });
      fetchInvitations();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (roleLoading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 bg-blue-500 animate-pulse rounded-full" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Users className="h-6 w-6 text-blue-500" /> Gestión de Accesos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Administra invitaciones y privilegios del sistema.</p>
        </div>
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
          <button onClick={() => setActiveTab("invitations")} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", activeTab === "invitations" ? "bg-blue-600 text-white shadow-md" : "text-muted-foreground")}>Invitaciones</button>
          <button onClick={() => setActiveTab("active")} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", activeTab === "active" ? "bg-blue-600 text-white shadow-md" : "text-muted-foreground")}>Usuarios Activos</button>
        </div>
      </div>

      {activeTab === "invitations" ? (
        <div className="grid gap-6">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-xl relative overflow-hidden">
             <div className="absolute -top-4 -right-4 opacity-5"><UserPlus className="h-32 w-32" /></div>
             <h3 className="text-sm font-black uppercase text-blue-500 mb-6 flex items-center gap-2">NUEVA INVITACIÓN</h3>
             <form onSubmit={handleInvite} className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[240px]">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">EMAIL</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-2 rounded-xl border border-border bg-background px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div className="min-w-[180px]">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">ROL</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full mt-2 rounded-xl border border-border bg-background px-4 py-3 text-sm cursor-pointer">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={loading} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50">
                  {loading ? "..." : "Enviar Invitación"}
                </button>
             </form>
             {error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold">{error}</div>}
             {success && <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-500 text-xs font-bold">{success}</div>}
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 bg-muted/30 border-b border-border font-bold text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" /> Historial de Códigos
            </div>
            <div className="divide-y divide-border">
              {invitations.length === 0 && <div className="p-12 text-center text-muted-foreground italic text-sm">No hay invitaciones registradas.</div>}
              {invitations.map(inv => {
                const used    = inv.used;
                const expired = isExpired(inv.expires_at);
                const pending = !used && !expired;
                return (
                  <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/5 transition-colors">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-bold text-sm truncate">{inv.email}</span>
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="text-[9px] uppercase font-black px-2 py-0.5 border border-blue-500/30 text-blue-500 rounded">{inv.role}</span>
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded",
                          used    ? "bg-emerald-500/10 text-emerald-500" :
                          expired ? "bg-rose-500/10 text-rose-500" :
                                    "bg-blue-500/10 text-blue-500"
                        )}>
                          {used ? "✓ Canjeado" : expired ? "⏱ Expirado" : "⏳ Pendiente"}
                        </span>
                        <span className="text-[9px] text-muted-foreground/60">
                          {pending ? `Expira: ${new Date(inv.expires_at).toLocaleDateString()}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {pending && (
                        <div className="flex items-center gap-1 bg-muted/30 p-1.5 rounded-lg border border-border">
                          <code className="text-xs font-black tracking-widest px-2">{inv.invite_code}</code>
                          <button onClick={() => copyCode(inv.invite_code, inv.id)} className="p-1 hover:text-primary transition-colors" title="Copiar código">
                            {copiedId === inv.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      )}
                      {expired && !used && (
                        <button
                          onClick={() => regenerateCode(inv.id, inv.email, inv.role)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors text-[10px] font-bold"
                          title="Regenerar código"
                        >
                          <RefreshCw className="h-3 w-3" /> Regenerar
                        </button>
                      )}
                      {(pending || expired) && !used && (
                        <button
                          onClick={() => cancelInvitation(inv.id, inv.email)}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Cancelar invitación"
                        >
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
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
           <div className="px-6 py-4 bg-muted/30 border-b border-border font-bold text-sm flex items-center gap-2">
             <Shield className="h-4 w-4 text-blue-500" /> Usuarios del Sistema
           </div>
           <div className="divide-y divide-border">
             {activeUsers.length === 0 && <div className="p-12 text-center text-muted-foreground italic">Cargando...</div>}
             {activeUsers.map(u => (
               <div key={u.user_id} className="p-4 flex items-center justify-between hover:bg-muted/5">
                 <div className="flex items-center gap-3">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white", u.is_blocked ? "bg-red-500" : "bg-blue-600 shadow-md")}>{(u.profiles?.[0]?.full_name || "U")[0].toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-bold">{u.profiles?.[0]?.full_name || "Sin nombre"}</p>
                      <p className="text-[10px] text-muted-foreground">{u.role} · {u.user_id === user?.id ? '(Tu)' : ''}</p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                   <select value={u.role} onChange={(e) => handleChangeRole(u.user_id, e.target.value)} className="text-[10px] font-bold bg-background border border-border rounded-lg px-2 py-1.5">
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                   </select>
                   {u.user_id !== user?.id && (
                     <button onClick={() => handleToggleBlock(u.user_id, u.is_blocked)} className={cn("p-2 rounded-lg", u.is_blocked ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:bg-muted")}>
                        {u.is_blocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                     </button>
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
