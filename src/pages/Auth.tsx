import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { KeyRound, LogIn, ShieldX, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";

export default function Auth() {
  const [mode, setMode]               = useState<"login" | "register" | "forgot" | "update_password">("login");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName]       = useState("");
  const [inviteCode, setInviteCode]   = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [message, setMessage]         = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const navigate                      = useNavigate();
  const [searchParams]                = useSearchParams();
  const isBlocked                     = searchParams.get("blocked") === "1";

  // ── Detect recovery tokens from URL ────────────────────────────────────────
  useEffect(() => {
    const type        = searchParams.get("type");
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token") || "";

    if (type === "recovery" && accessToken) {
      setMode("update_password");
      setSessionReady(false);
      // Exchange the tokens for an active Supabase session
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error: sessErr }) => {
          if (sessErr) {
            console.error("setSession error:", sessErr);
            setError("Link de recuperación inválido o expirado. Solicita uno nuevo.");
          } else {
            console.log("Session active for:", data.session?.user?.email);
            setSessionReady(true);
          }
        });
    }
  }, [searchParams]);
  // ───────────────────────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message.includes("Invalid") || error.message.includes("invalid")
          ? "Email o contraseña incorrectos. Verifique sus datos."
          : error.message.includes("Email not confirmed")
          ? "Confirme su email antes de ingresar. Revise su bandeja de entrada."
          : error.message
      );
    } else {
      // Check if user needs to change password
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profile?.must_change_password) {
        setMode("update_password");
        setSessionReady(true);
        setError("Debes cambiar tu contraseña inicial antes de continuar.");
      } else {
        navigate("/");
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    // Hash-based URL so HashRouter routes correctly after redirect
    const redirectTo = `${window.location.origin}${window.location.pathname}#/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) setError(error.message);
    else setMessage("✅ Link de recuperación enviado. Revisa tu bandeja de entrada y haz clic en el enlace.");
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres.");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden. Verifica e intenta de nuevo.");
      setLoading(false);
      return;
    }

    // Verify we have an active session (may have been set by setSession() earlier)
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError("La sesión expiró. Haz clic en '¿Olvidaste tu contraseña?' para obtener un nuevo link.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("updateUser error:", error);
      setError(
        error.message.includes("session") || error.message.includes("Session")
          ? "Sesión expirada. Solicita un nuevo link de recuperación."
          : error.message
      );
    } else {
      // Clear must_change_password flag
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", (await supabase.auth.getUser()).data.user?.id);
      
      setMessage("✅ ¡Contraseña actualizada con éxito! Serás redirigido al login...");
      await supabase.auth.signOut();
      setTimeout(() => {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setSessionReady(false);
      }, 2500);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres.");
      setLoading(false);
      return;
    }

    // Validate invitation code
    const { data: inviteData, error: inviteError } = await supabase
      .from("user_invitations")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("invite_code", inviteCode.toUpperCase().trim())
      .eq("used", false)
      .single();

    if (inviteError || !inviteData) {
      setError("Código de invitación inválido o ya utilizado para este email.");
      setLoading(false);
      return;
    }

    if (new Date(inviteData.expires_at) < new Date()) {
      setError("El código expiró. Solicita al Gerente que genere uno nuevo.");
      setLoading(false);
      return;
    }

    const { data: signUpData, error: signUpError } = await (supabase as any).auth.signUp({
      email,
      password,
      options: { 
        data: { 
          full_name: fullName,
          firstname: inviteData.metadata?.firstname || "",
          lastname: inviteData.metadata?.lastname || "",
          phone: inviteData.metadata?.phone || "",
          city: inviteData.metadata?.city || "",
          birth_date: inviteData.metadata?.birth_date || null
        } 
      },
    });

    if (signUpError) {
      console.error("SignUp Error:", signUpError);
      setError(
        signUpError.message.includes("Rate limit") 
          ? "Límite de correos excedido. Intenta de nuevo en 1 hora o contacta al administrador."
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    if (signUpData.user) {
      const { error: rpcError } = await (supabase as any).rpc("assign_role_via_invite", {
        p_email: email,
        p_code: inviteCode,
      });
      if (rpcError) { setError("Error vinculando el rol: " + rpcError.message); setLoading(false); return; }
      setMessage("✅ ¡Cuenta creada! Revisa tu email para activar el acceso.");
      setMode("login");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-4 py-safe overflow-y-auto">
      <div className="w-full max-w-md space-y-6 animate-fade-in py-10">

        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto h-24 w-24 mb-5 drop-shadow-lg">
            <img src="/logo.png" alt="Surgical Alcon" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-display font-black text-foreground tracking-tight">Surgical Portal</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Gestión Quirúrgica Alcon</p>
        </div>

        {/* Blocked alert */}
        {isBlocked && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3">
            <ShieldX className="h-5 w-5 text-rose-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-400">Acceso Bloqueado</p>
              <p className="text-xs text-muted-foreground">Tu cuenta ha sido bloqueada. Contacta al Gerente.</p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border border-border/50 bg-card/80 ring-1 ring-white/5 backdrop-blur-xl shadow-2xl">
          {/* Tabs — only for login/register */}
          {(mode === "login" || mode === "register") && (
            <div className="flex border-b border-border/50">
              <button
                onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all",
                  mode === "login"
                    ? "bg-primary/10 text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:bg-white/5"
                )}
              >
                <LogIn className="h-4 w-4" /> Entrar
              </button>
              <button
                onClick={() => { setMode("register"); setError(""); setMessage(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all",
                  mode === "register"
                    ? "bg-blue-500/10 text-blue-400 border-b-2 border-blue-500"
                    : "text-muted-foreground hover:bg-white/5"
                )}
              >
                <KeyRound className="h-4 w-4" /> Primer Acceso
              </button>
            </div>
          )}

          <div className="p-5 sm:p-6">

            {/* ── LOGIN ── */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@alcon.com"
                    className="mt-2 w-full rounded-xl border border-border bg-background/50 px-4 h-14 text-base text-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contraseña</label>
                  <div className="relative mt-2">
                    <input
                      type={showPass ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-border bg-background/50 px-4 h-14 pr-14 text-base focus:ring-2 focus:ring-primary outline-none transition-all"
                      required
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute right-0 top-0 h-14 w-14 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="mt-2.5 text-right">
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-muted-foreground hover:text-primary transition-colors py-1">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </div>
                {error   && <div className="text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5">{error}</div>}
                {message && <div className="text-sm text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5">{message}</div>}
                <button type="submit" disabled={loading}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] h-14 text-base font-bold text-white transition-all disabled:opacity-50 mt-1 shadow-lg shadow-blue-500/20">
                  {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Ingresando...</span> : "Entrar"}
                </button>
              </form>
            )}

            {/* ── RECUPERAR CONTRASEÑA ── */}
            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-base font-bold">Recuperar Acceso</h3>
                  <p className="text-sm text-muted-foreground mt-1">Te enviaremos un link para crear una nueva contraseña</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@alcon.com"
                    className="mt-2 w-full rounded-xl border border-border bg-background/50 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-primary transition-all"
                    required
                  />
                </div>
                {error   && <div className="text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5">{error}</div>}
                {message && <div className="text-sm text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5">{message}</div>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setMode("login")} className="flex-1 rounded-xl border border-border h-14 text-sm font-bold text-muted-foreground hover:bg-white/5 active:scale-[0.98] transition-all">Volver</button>
                  <button type="submit" disabled={loading} className="flex-[2] rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] h-14 text-sm font-bold text-white shadow-lg disabled:opacity-50 transition-all">
                    {loading ? "Enviando..." : "Enviar Link"}
                  </button>
                </div>
              </form>
            )}

            {/* ── PRIMER ACCESO (Registro con invitación) ── */}
            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3.5 text-sm text-blue-400 flex items-start gap-2.5">
                  <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Ingresa tu código de invitación para activar tu cuenta.</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nombre Completo</label>
                  <input type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background/50 px-4 h-14 text-base" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                  <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background/50 px-4 h-14 text-base" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Código de Invitación</label>
                  <input type="text" autoComplete="off" autoCapitalize="characters" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} className="mt-2 w-full rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 h-14 text-base font-mono font-bold text-blue-400 uppercase tracking-widest" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contraseña (mín. 8 caracteres)</label>
                  <div className="relative mt-2">
                    <input type={showPass ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-border bg-background/50 px-4 h-14 pr-14 text-base" required minLength={8} />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-0 top-0 h-14 w-14 flex items-center justify-center text-muted-foreground">
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirmar Contraseña</label>
                  <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background/50 px-4 h-14 text-base" required />
                </div>
                {error   && <div className="text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5">{error}</div>}
                {message && <div className="text-sm text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5">{message}</div>}
                <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] h-14 text-base font-bold text-white shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all">
                  {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Activando...</span> : "Activar mi cuenta"}
                </button>
              </form>
            )}

            {/* ── ACTUALIZAR CONTRASEÑA (desde link de recuperación) ── */}
            {mode === "update_password" && (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="text-center mb-2">
                  <h3 className="text-base font-bold text-foreground">Crear Nueva Contraseña</h3>
                  <p className="text-xs text-muted-foreground mt-1">Elige una contraseña segura (mínimo 8 caracteres)</p>
                </div>

                {/* Session verification status */}
                {!sessionReady && !error && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
                    <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
                    <p className="text-xs text-amber-400">Verificando enlace de recuperación...</p>
                  </div>
                )}
                {sessionReady && !error && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <p className="text-xs text-emerald-400">Enlace verificado ✓ Ingresa tu nueva contraseña.</p>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nueva Contraseña</label>
                  <div className="relative mt-2">
                    <input
                      type={showPass ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background/50 px-4 h-14 pr-14 text-base outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50"
                      required
                      minLength={8}
                      disabled={!sessionReady || !!message}
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-0 top-0 h-14 w-14 flex items-center justify-center text-muted-foreground">
                      {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirmar Contraseña</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-border bg-background/50 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-primary transition-all disabled:opacity-50"
                    required
                    disabled={!sessionReady || !!message}
                    placeholder="Repite la contraseña"
                  />
                </div>

                {error   && <div className="text-sm text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5">{error}</div>}
                {message && <div className="text-sm text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5">{message}</div>}

                <button
                  type="submit"
                  disabled={loading || !sessionReady || !!message}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] h-14 text-base font-bold text-white transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Actualizando...
                    </span>
                  ) : !sessionReady ? "Verificando enlace..." : "✓ Actualizar Contraseña"}
                </button>

                {error && (
                  <button type="button" onClick={() => { setMode("forgot"); setError(""); }}
                    className="w-full text-sm text-primary hover:underline underline-offset-2 transition-colors py-2">
                    → Solicitar nuevo link de recuperación
                  </button>
                )}
              </form>
            )}

          </div>
        </div>
        <p className="text-center text-[10px] text-muted-foreground/40">Surgical CRM · Acceso restringido</p>
      </div>
    </div>
  );
}
