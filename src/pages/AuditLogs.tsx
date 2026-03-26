import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { ShieldX, Search, Clock, MapPin } from "lucide-react";

type AuditLog = {
    id: string;
    user_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details: any;
    gps_lat: number | null;
    gps_lon: number | null;
    created_at: string;
    profiles: { full_name: string; email: string } | null;
};

export default function AuditLogs() {
    const { user } = useAuth();
    const { isGerente, loading: roleLoading } = useUserRole();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (isGerente) fetchLogs();
    }, [isGerente]);

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("audit_log")
            .select(`
        *,
        profiles:user_id ( full_name )
      `)
            .order("created_at", { ascending: false })
            .limit(100);

        if (error) console.error("Error fetching logs:", error);
        else setLogs(data as any || []);
        setLoading(false);
    };

    if (roleLoading) {
        return <div className="flex justify-center p-10"><div className="h-8 w-8 animate-pulse rounded-full bg-primary" /></div>;
    }

    if (!isGerente) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <ShieldX className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Acceso Restringido</h2>
                <p className="text-sm text-muted-foreground p-3">Esta sección es exclusiva para auditoría gerencial.</p>
            </div>
        );
    }

    const filtered = logs.filter(l =>
        l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(l.details).toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Registro de Auditoría</h2>
                    <p className="text-muted-foreground">Rastreo de actividades críticas y movimientos.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        placeholder="Buscar evento..."
                        className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-medium">Fecha / Hora</th>
                                <th className="px-4 py-3 font-medium">Usuario</th>
                                <th className="px-4 py-3 font-medium">Acción</th>
                                <th className="px-4 py-3 font-medium">Detalles</th>
                                <th className="px-4 py-3 font-medium w-32">Ubicación</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Cargando eventos...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No se encontraron registros.</td></tr>
                            ) : (
                                filtered.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap flex items-center gap-2">
                                            <Clock className="h-3 w-3" />
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            {log.profiles?.full_name || "Desconocido"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${log.action === "IMPORT_DATA" ? "bg-blue-50 text-blue-700 ring-blue-600/20" :
                                                    log.action === "DELETE_DATA" ? "bg-red-50 text-red-700 ring-red-600/20" :
                                                        "bg-gray-50 text-gray-600 ring-gray-500/10"
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                                            {log.details ? JSON.stringify(log.details) : "-"}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {log.gps_lat && log.gps_lon ? (
                                                <a
                                                    href={`https://www.google.com/maps?q=${log.gps_lat},${log.gps_lon}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 hover:text-primary underline decoration-dotted"
                                                >
                                                    <MapPin className="h-3 w-3" /> Ver Mapa
                                                </a>
                                            ) : (
                                                <span className="text-xs opacity-50">N/A</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
