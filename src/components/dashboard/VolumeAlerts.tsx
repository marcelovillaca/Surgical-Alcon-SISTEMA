import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronRight, TrendingDown, Clock, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function VolumeAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('client_volume_alerts')
      .select(`
        *,
        client:clients(name, segment),
        institution:institutions(name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error) setAlerts(data || []);
    setLoading(false);
  };

  const handleResolve = async (id: string) => {
    await supabase
      .from('client_volume_alerts')
      .update({ status: 'reviewed' })
      .eq('id', id);
    fetchAlerts();
  };

  if (loading || alerts.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="h-5 w-5 text-destructive animate-pulse" />
        <h2 className="text-lg font-display font-black text-foreground uppercase tracking-tight">Alertas Críticas de Volumen</h2>
        <Badge variant="destructive" className="ml-2 h-5 min-w-5 flex items-center justify-center rounded-full p-0 px-1.5 text-[10px]">
          {alerts.length}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alerts.map((alert) => (
          <div 
            key={alert.id} 
            className="group relative rounded-2xl border border-destructive/20 bg-destructive/5 p-4 hover:bg-destructive/10 transition-all border-l-4 border-l-destructive shadow-lg shadow-destructive/5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground leading-tight">{alert.client?.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{alert.institution?.name}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-black text-destructive border-destructive/30">
                -{Math.round(alert.drop_pct)}%
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {new Date(alert.created_at).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-foreground">{alert.old_volume}</span> → <span className="font-bold text-destructive">{alert.new_volume}</span> cir/mes
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => navigate(`/crm/intelligence/${alert.client_id}`)}
                className="flex-1 bg-destructive text-white text-[10px] font-black py-2 rounded-lg hover:bg-destructive/90 transition-colors flex items-center justify-center gap-1"
              >
                ACCIONAR DEFENSA <ChevronRight className="h-3 w-3" />
              </button>
              <button 
                onClick={() => handleResolve(alert.id)}
                className="px-3 py-2 rounded-lg border border-destructive/20 text-[10px] font-black text-muted-foreground hover:bg-background transition-colors"
              >
                VISTO
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
