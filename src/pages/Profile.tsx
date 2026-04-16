import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Mail, MapPin, Phone, Calendar, Save, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstname: "",
    lastname: "",
    full_name: "",
    email: "",
    phone: "",
    city: "",
    birth_date: "",
  });

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  async function fetchProfile() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          firstname: data.firstname || "",
          lastname: data.lastname || "",
          full_name: data.full_name || "",
          email: data.email || user?.email || "",
          phone: data.phone || "",
          city: data.city || "",
          birth_date: data.birth_date || "",
        });
      }
    } catch (error: any) {
      toast.error("Error al cargar perfil");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const fullName = `${profile.firstname} ${profile.lastname}`.trim();
      
      const { error } = await supabase
        .from("profiles")
        .update({
          firstname: profile.firstname,
          lastname: profile.lastname,
          full_name: fullName || profile.full_name,
          phone: profile.phone,
          city: profile.city,
          birth_date: profile.birth_date || null,
        })
        .eq("user_id", user?.id);

      if (error) throw error;
      
      // Update auth metadata too
      await supabase.auth.updateUser({
        data: { full_name: fullName, firstname: profile.firstname, lastname: profile.lastname }
      });

      toast.success("Perfil actualizado correctamente");
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
          <p className="text-sm text-muted-foreground">Gestiona tu información personal y de contacto.</p>
        </div>
      </div>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50">
          <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
             Datos Personales
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstname" className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nombre</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="firstname"
                  value={profile.firstname}
                  onChange={(e) => setProfile({...profile, firstname: e.target.value})}
                  className="pl-10 h-12 bg-background/50 border-white/5"
                  placeholder="Tu nombre"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastname" className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Apellido</Label>
              <Input 
                id="lastname"
                value={profile.lastname}
                onChange={(e) => setProfile({...profile, lastname: e.target.value})}
                className="h-12 bg-background/50 border-white/5"
                placeholder="Tu apellido"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Correo Electrónico (No editable)</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={profile.email} 
                disabled 
                className="pl-10 h-12 bg-muted/50 border-white/5 cursor-not-allowed opacity-70"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={profile.phone}
                  onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  className="pl-10 h-12 bg-background/50 border-white/5"
                  placeholder="+595 ..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Ciudad</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={profile.city}
                  onChange={(e) => setProfile({...profile, city: e.target.value})}
                  className="pl-10 h-12 bg-background/50 border-white/5"
                  placeholder="Ej: Asunción"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Fecha de Nacimiento</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="date"
                value={profile.birth_date}
                onChange={(e) => setProfile({...profile, birth_date: e.target.value})}
                className="pl-10 h-12 bg-background/50 border-white/5"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 p-6 border-t border-border/50 flex justify-between items-center">
          <p className="text-[10px] text-muted-foreground italic">
            Última actualización: {new Date().toLocaleDateString()}
          </p>
          <Button onClick={handleSave} disabled={saving} className="gradient-emerald px-8 h-11 rounded-xl shadow-lg">
            {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Cambios
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" />
            Seguridad
          </CardTitle>
          <CardDescription>Gestiona el acceso a tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => toast.info("Funcionalidad de cambio de contraseña en desarrollo")} className="rounded-xl">
            Cambiar Contraseña
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
