import { useState, useEffect, useMemo } from "react";
import { 
  MapPin, Users, Calendar, Activity, Navigation, 
  Search, Filter, ArrowUpRight, Clock, ShieldCheck, 
  Map as MapIcon, Layers, Target, AlertTriangle, ChevronRight, Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type VisitorStat = {
  id: string;
  full_name: string;
  visits_today: number;
  visits_month: number;
  status: 'online' | 'offline' | 'visiting';
  last_location?: { lat: number; lng: number; time: string };
};

type LiveVisit = {
  id: string;
  visitor_name: string;
  client_name: string;
  check_in_at: string;
  location: string;
  visit_type: string;
};

export default function SfaAdmin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<VisitorStat[]>([]);
  const [liveVisits, setLiveVisits] = useState<LiveVisit[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<"today" | "week" | "month">("today");

  useEffect(() => {
    fetchData();
  }, [selectedTimeframe]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch profiles to get visitors
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      
      // Fetch visits for today
      const today = new Date().toISOString().split("T")[0];
      const { data: visitsToday } = await supabase.from("visits")
        .select("id, created_by, check_in_at, check_out_at, client_id, visit_type")
        .gte("visit_date", today);

      // Fetch live visits (checked in but not checked out)
      const live = await supabase.from("visits")
        .select("id, check_in_at, visit_type, created_by, client:clients(name, city)")
        .not("check_in_at", "is", null)
        .is("check_out_at", null);

      if (profiles && visitsToday) {
        const statsData = profiles.map(p => {
          const userVisits = visitsToday.filter(v => v.created_by === p.id);
          const isVisiting = live.data?.some(v => v.created_by === p.id);
          return {
            id: p.id,
            full_name: p.full_name || "Usuario",
            visits_today: userVisits.length,
            visits_month: 25, // Mocked for now
            status: isVisiting ? 'visiting' : 'online'
          } as VisitorStat;
        });
        setStats(statsData);
      }

      if (live.data) {
        const enrichedLive = live.data.map(v => ({
          id: v.id,
          visitor_name: profiles?.find(p => p.id === v.created_by)?.full_name || "Visitador",
          client_name: (v.client as any)?.name || "Cliente",
          check_in_at: v.check_in_at,
          location: (v.client as any)?.city || "Ubicación desconocida",
          visit_type: v.visit_type
        }));
        setLiveVisits(enrichedLive);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalVisitsToday = stats.reduce((acc, curr) => acc + curr.visits_today, 0);

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Panel Administrativo SFA
          </h1>
          <p className="text-sm text-muted-foreground">Monitor de fuerza de ventas y ejecución en campo</p>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex rounded-lg border border-border overflow-hidden p-1 bg-muted/30">
              <button 
                onClick={() => setSelectedTimeframe("today")}
                className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", selectedTimeframe === "today" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >HOY</button>
              <button 
                onClick={() => setSelectedTimeframe("month")}
                className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", selectedTimeframe === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >MES</button>
           </div>
           <button onClick={fetchData} className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-all">
             <Activity className={cn("h-4 w-4 text-primary", loading && "animate-spin")} />
           </button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Visitas Hoy", value: totalVisitsToday, sub: "+12% vs ayer", icon: Navigation, color: "text-emerald-400" },
          { label: "Visitadores Activos", value: stats.filter(s => s.status !== 'offline').length, sub: "De 5 totales", icon: Users, color: "text-primary" },
          { label: "En Visita Ahora", value: liveVisits.length, sub: "Check-in activo", icon: MapPin, color: "text-secondary" },
          { label: "Cumplimiento Meta", value: "78%", sub: "Objetivo mensual", icon: ShieldCheck, color: "text-blue-400" },
        ].map((kpi, i) => (
          <div key={i} className="rounded-2xl border-2 border-border bg-card p-5 hover:border-primary/20 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{kpi.label}</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-display font-bold text-foreground">{kpi.value}</h2>
              <span className="text-[10px] text-emerald-400 font-bold">{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Map & Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map Simulation */}
          <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-primary" /> Mapa de Cobertura en Vivo
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
                <span className="text-[10px] font-bold text-muted-foreground">TRANSFECO LIVE FEED</span>
              </div>
            </div>
            <div className="aspect-[21/9] w-full bg-[#1a1a1a] relative group">
              {/* Mock Map Background (Grid) */}
              <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
              
              {/* Animated Map Pins */}
              {liveVisits.map((v, i) => (
                <div key={v.id} 
                  className="absolute animate-bounce-subtle cursor-pointer group/pin"
                  style={{ top: `${20 + (i * 15)}%`, left: `${30 + (i * 20)}%` }}
                >
                   <div className="relative">
                      <div className="absolute -inset-2 bg-secondary/20 rounded-full animate-ping" />
                      <div className="h-4 w-4 rounded-full bg-secondary border-2 border-white shadow-lg flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border shadow-2xl rounded-lg p-2 min-w-[120px] hidden group-hover/pin:block animate-in fade-in slide-in-from-bottom-2 z-10">
                         <p className="text-[9px] font-bold text-primary truncate">{v.visitor_name}</p>
                         <p className="text-[10px] font-bold text-foreground truncate">{v.client_name}</p>
                         <p className="text-[8px] text-muted-foreground">{v.location}</p>
                      </div>
                   </div>
                </div>
              ))}

              <div className="absolute bottom-4 right-4 flex gap-2">
                <button className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted"><Layers className="h-4 w-4" /></button>
                <button className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted"><Maximize2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {/* Detailed Activity Table */}
          <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/10">
              <h3 className="text-sm font-bold">Registro de Ejecución</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/5">
                    <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase">Visitador</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase">Cliente</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase">Tipo</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase">Estado</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {liveVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{v.visitor_name[0]}</div>
                          <span className="text-sm font-medium text-foreground">{v.visitor_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold text-foreground">{v.client_name}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {v.location}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{v.visit_type?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
                          <span className="text-xs font-bold text-secondary">EN VISITA</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {liveVisits.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground italic">No hay visitas activas en este momento.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Performance & Alerts */}
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-bold">Ranking de Productividade</h3>
            <div className="space-y-4">
              {stats.sort((a,b) => b.visits_today - a.visits_today).map((s, i) => (
                <div key={s.id} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">{i+1}. {s.full_name}</span>
                    <span className="text-muted-foreground">{s.visits_today} visitas</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(s.visits_today / 8) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-destructive/20 bg-destructive/5 p-5 space-y-4">
             <div className="flex items-center gap-2 text-destructive">
               <AlertTriangle className="h-4 w-4" />
               <h3 className="text-sm font-bold uppercase tracking-widest">Alertas críticas</h3>
             </div>
             <div className="space-y-3">
                <div className="p-3 rounded-xl bg-card border border-destructive/20 space-y-1">
                   <p className="text-[10px] font-bold text-destructive">GPS MISMATCH</p>
                   <p className="text-xs text-foreground">Juan Perez fez check-in a 500m do cliente.</p>
                   <p className="text-[9px] text-muted-foreground">Hace 15 minutos · Clinica Alpha</p>
                </div>
                <div className="p-3 rounded-xl bg-card border border-destructive/10 space-y-1 opacity-70 text-grayscale">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">Sin actividad hoy</p>
                   <p className="text-xs text-foreground">Maria Lopez no ha registrado su primera visita.</p>
                </div>
             </div>
          </div>

          <div className="rounded-2xl border-2 border-border bg-primary/5 p-5">
             <div className="flex items-center gap-3 mb-4">
               <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                 <Clock className="h-5 w-5 text-primary" />
               </div>
               <div>
                  <h4 className="text-sm font-bold">Tiempo en Campo</h4>
                  <p className="text-[10px] text-muted-foreground">Promedio operacional hoy</p>
               </div>
             </div>
             <div className="text-2xl font-display font-bold text-foreground">5h 42m</div>
             <p className="text-[10px] text-emerald-400 font-bold mt-1">▲ 15% vs promedio semana</p>
          </div>
        </div>
      </div>
    </div>
  );
}
