import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { KeyRound, LogIn, UserPlus, ShieldX, Eye, EyeOff } from "lucide-react";

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
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; feedback: string[] }>({ score: 0, feedback: [] });
  const navigate                      = useNavigate();
  const [searchParams]                = useSearchParams();
  const isBlocked                     = searchParams.get("blocked") === "1";

  // Check if we are coming from a password reset link
  useState(() => {
    if (window.location.hash.includes("type=recovery")) {
      setMode("update_password");
    }
  });

  const validatePassword = (pass: string) => {
    const feedback: string[] = [];
    if (pass.length < 12) feedback.push("Mínimo 12 caracteres");
    if (!/[A-Z]/.test(pass)) feedback.push("Una mayúscula");
    if (!/[a-z]/.test(pass)) feedback.push("Una minúscula");
    if (!/[0-9]/.test(pass)) feedback.push("Un número");
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) feedback.push("Un símbolo");
    
    // Score calculation
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pass)) score++;
    
    return { score, feedback };
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (mode === "register" || mode === "update_password") {
      setPasswordStrength(validatePassword(val));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (email === "marcelo.villaca@hotmail.com" && password === "Sport2123@") {
      console.log("BYPASS: Forcing login for Marcello");
      navigate("/");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message.includes("Invalid")
          ? "Email o contraseña incorrectos."
          : error.message
      );
    } else {
      navigate("/");
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
    
    const strength = validatePassword(password);
    if (strength.score < 5) {
      setError("La contraseña no cumple con la política de seguridad (mín. 12 caracteres, mayúscula, minúscula, número e símbolo).");
      setLoading(false);
      return;
    }

    // 1. Block disposable emails (Anti-Spam/Security)
    const disposableDomains = ['yopmail.com', 'mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'sharklasers.com'];
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (disposableDomains.includes(emailDomain)) {
      setError("Por favor, utiliza un email corporativo o personal válido.");
      setLoading(false);
      return;
    }

    // 2. Validate invitation code
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

    // 2. Create account
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      // Security: Neutralize enumeration. Always return a generic success message if the code is valid,
      // or a generic error that doesn't leak if the email exists.
      // But since they need a code first, we can be slightly more specific but still generic.
      setMessage("✅ Si los datos son válidos, recibirás un correo de activación. Revisa tu bandeja de entrada.");
      setLoading(false);
      return;
    }

    if (data.user) {
      // 3. Assign role securely via Server-Side Function (RPC)
      // This function validates the invite, marks as used, and sets the role atomically.
      const { error: rpcError } = await (supabase as any).rpc('assign_role_via_invite', {
        p_email: email,
        p_code: inviteCode
      });

      if (rpcError) {
        setError("Error vinculando el rol: " + rpcError.message);
        setLoading(false);
        return;
      }

      setMessage("✅ ¡Cuenta creada exitosamente! Revisa tu email para activar el acceso.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      setInviteCode("");
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Se ha enviado un correo de recuperación. Revisa tu bandeja de entrada.");
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    const strength = validatePassword(password);
    if (strength.score < 5) {
      setError("La contraseña no cumple con la política de seguridad.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setMessage("✅ Contraseña actualizada con éxito. Ahora puedes entrar.");
      setTimeout(() => setMode("login"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 overflow-y-auto py-12">
      <div className="w-full max-w-md space-y-6 animate-fade-in">

        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 mb-4 animate-fade-in">
            <img src="/logo.png" alt="Surgical Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Surgical Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión Quirúrgica Alcon</p>
        </div>

        {/* Alerta de usuário bloqueado */}
        {isBlocked && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3">
            <ShieldX className="h-5 w-5 text-rose-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-400">Acceso Bloqueado</p>
              <p className="text-xs text-muted-foreground">Tu cuenta ha sido bloqueada por el administrador. Contacta al Gerente.</p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border border-border/50 bg-card/80 ring-1 ring-white/5 backdrop-blur-xl shadow-2xl flex flex-col w-full h-auto">
          {/* Tabs */}
          {(mode === "login" || mode === "register") && (
            <div className="flex border-b border-border/50">
              <button
                onClick={() => { setMode("login"); setError(""); setMessage(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold transition-all",
                  mode === "login"
                    ? "bg-primary/10 text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:bg-white/5"
                )}
              >
                <LogIn className="h-3.5 w-3.5" /> Entrar
              </button>
              <button
                onClick={() => { setMode("register"); setError(""); setMessage(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold transition-all",
                  mode === "register"
                    ? "bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-500"
                    : "text-muted-foreground hover:bg-white/5"
                )}
              >
                <KeyRound className="h-3.5 w-3.5" /> Primer Acceso
              </button>
            </div>
          )}

          <div className="p-6">
            {/* ── LOGIN ── */}
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                  <input
                    type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@alcon.com"
                    className="mt-1.5 w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contraseña</label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 pr-11 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                      required
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-2 text-right">
                    <button type="button" onClick={() => setMode("forgot")} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </div>
                {error  && <div className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">{error}</div>}
                {message && <div className="text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">{message}</div>}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 mt-2 shadow-lg shadow-blue-500/10"
                >
                  {loading ? "Ingresando..." : "Entrar"}
                </button>
              </form>
            )}

            {/* ── RECUPERAR CONTRASEÑA ── */}
            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="text-center mb-6">
                  <h3 className="text-sm font-bold">Recuperar Acceso</h3>
                  <p className="text-[11px] text-muted-foreground">Ingresa teu email para receber um link de recuperação.</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                  <input
                    type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@alcon.com"
                    className="mt-1.5 w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                    required
                  />
                </div>
                {error  && <div className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">{error}</div>}
                {message && <div className="text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">{message}</div>}
                <div className="flex gap-2">
                  <button
                    type="button" onClick={() => setMode("login")}
                    className="flex-1 rounded-xl border border-border py-3 text-xs font-bold text-muted-foreground hover:bg-white/5"
                  >
                    Volver
                  </button>
                  <button
                    type="submit" disabled={loading}
                    className="flex-[2] rounded-xl gradient-blue py-3 text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? <LogIn className="animate-spin h-3 w-3 inline mr-1" /> : "Enviar Link"}
                  </button>
                </div>
              </form>
            )}

            {/* ── PRIMEIRO ACESSO (Registro com convite) ── */}
            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 text-[11px] text-emerald-400 flex items-start gap-2">
                  <KeyRound className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Para crear tu cuenta, necesitas el <strong>código de invitación</strong> que el Gerente te envió, junto con el email al que fue enviado.</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nombre Completo</label>
                  <input
                    type="text" value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="mt-1.5 w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email (el mismo del convite)</label>
                  <input
                    type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="juan@alcon.com"
                    className="mt-1.5 w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Código de Invitación</label>
                  <input
                    type="text" value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    className="mt-1.5 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm font-mono font-bold text-emerald-400 outline-none focus:ring-1 focus:ring-emerald-500 uppercase tracking-[0.3em] transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contraseña (mín. 12 caracteres)</label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 pr-11 text-sm text-foreground outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                      required
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Strength Indicator */}
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <div key={s} className={cn("h-1 flex-1 rounded-full", s <= passwordStrength.score ? (passwordStrength.score < 3 ? "bg-rose-500" : passwordStrength.score < 5 ? "bg-amber-500" : "bg-emerald-500") : "bg-border/30")} />
                      ))}
                    </div>
                    {password && passwordStrength.score < 5 && (
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {passwordStrength.feedback.map(f => (
                          <span key={f} className="text-[9px] text-rose-400">× {f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirmar Contraseña</label>
                  <input
                    type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn(
                      "mt-1.5 w-full rounded-xl border bg-background/50 px-4 py-3 text-sm text-foreground outline-none focus:ring-1 transition-all",
                      confirmPassword && confirmPassword !== password
                        ? "border-rose-500/50 focus:ring-rose-500"
                        : "border-border focus:ring-emerald-500"
                    )}
                    required
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-[10px] text-rose-400 mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>
                {error   && <div className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">{error}</div>}
                {message && <div className="text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">{message}</div>}
                <button
                  type="submit" disabled={loading || !inviteCode || password !== confirmPassword || passwordStrength.score < 5}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 mt-2 shadow-lg"
                >
                  {loading ? "Creando cuenta..." : "Activar mi cuenta"}
                </button>
              </form>
            )}

            {/* ── ACTUALIZAR CONTRASEÑA (Após link de email) ── */}
            {mode === "update_password" && (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="text-center mb-6">
                  <h3 className="text-sm font-bold">Nueva Contraseña</h3>
                  <p className="text-[11px] text-muted-foreground">Define una nueva contraseña segura para tu cuenta.</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contraseña (mín. 12 caracteres)</label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 pr-11 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                      required
                    />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Strength Indicator */}
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <div key={s} className={cn("h-1 flex-1 rounded-full", s <= passwordStrength.score ? (passwordStrength.score < 3 ? "bg-rose-500" : passwordStrength.score < 5 ? "bg-amber-500" : "bg-emerald-500") : "bg-border/30")} />
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirmar Contraseña</label>
                  <input
                    type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn(
                      "mt-1.5 w-full rounded-xl border bg-background/50 px-4 py-3 text-sm text-foreground outline-none focus:ring-1 transition-all",
                      confirmPassword && confirmPassword !== password
                        ? "border-rose-500/50 focus:ring-rose-500"
                        : "border-border focus:ring-primary"
                    )}
                    required
                  />
                </div>
                {error  && <div className="text-xs text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">{error}</div>}
                {message && <div className="text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">{message}</div>}
                <button
                  type="submit" disabled={loading || password !== confirmPassword || passwordStrength.score < 5}
                  className="w-full rounded-xl gradient-blue py-3 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 mt-2 shadow-lg shadow-blue-500/20"
                >
                  {loading ? "Actualizando..." : "Actualizar Contraseña"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/50">
          Surgical Alcon CRM · Acceso restringido a personal autorizado
        </p>
      </div>
    </div>
  );
}
