import { useState } from "react";
import { useInventory } from "./InventoryProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Plus, ChevronDown, ChevronRight, Send, CheckCircle2, 
  Clock, AlertTriangle, X 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; step: number }> = {
  pendente: { label: "Pendente", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Clock, step: 1 },
  enviado: { label: "Enviado", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Send, step: 2 },
  recebido: { label: "Recebido ✓", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2, step: 3 },
  divergente: { label: "Divergência ⚠", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", icon: AlertTriangle, step: 3 },
  cancelado: { label: "Cancelado", color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20", icon: X, step: 0 },
};

export function ReplenishmentTabs({
  onShowNewRequest,
  onShowDispatch,
  onShowReceive
}: {
  onShowNewRequest: () => void;
  onShowDispatch: (req: any) => void;
  onShowReceive: (req: any) => void;
}) {
  const { requests, isAdmin, isCoordinador } = useInventory();
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black tracking-tight text-foreground uppercase">
            Flujo de Reposición
          </h3>
          <p className="text-xs text-muted-foreground font-medium">Gestión del ciclo de vida de pedidos de insumos</p>
        </div>
        {isCoordinador && (
          <Button onClick={onShowNewRequest} className="bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 font-bold">
            <Plus className="h-4 w-4 mr-2" /> Nuevo Pedido
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {requests.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="p-16 text-center text-muted-foreground italic bg-card/20 rounded-3xl border border-dashed border-border"
            >
              No hay pedidos registrados en este momento.
            </motion.div>
          ) : requests.map((req, idx) => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pendente;
            const Icon = cfg.icon;
            const isExpanded = expandedRequest === req.id;
            
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  "group rounded-3xl border border-border bg-card/40 backdrop-blur-sm transition-all duration-300 overflow-hidden",
                  isExpanded ? "ring-2 ring-blue-500/20 shadow-2xl" : "hover:bg-card/60"
                )}
              >
                <div
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center border transition-colors",
                      isExpanded ? "bg-blue-500/20 border-blue-500/30 text-blue-400" : "bg-muted/50 border-border text-muted-foreground"
                    )}>
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-black text-lg tracking-tight group-hover:text-blue-400 transition-colors uppercase">{req.request_number}</p>
                        <Badge className={cn("text-[10px] font-black uppercase tracking-wider py-0.5 px-2", cfg.color)}>
                          <Icon className="h-3 w-3 mr-1" />{cfg.label}
                        </Badge>
                      </div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">
                        {req.institution?.name} · {new Date(req.requested_at).toLocaleDateString("es-PY")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-auto">
                    {/* Simplified Timeline Preview */}
                    <div className="hidden lg:flex items-center gap-1 mr-4">
                      {[1, 2, 3].map(step => (
                        <div 
                          key={step}
                          className={cn(
                            "h-1.5 w-6 rounded-full transition-all duration-500",
                            cfg.step >= step ? "bg-blue-400" : "bg-muted-foreground/20"
                          )} 
                        />
                      ))}
                    </div>

                    {isAdmin && req.status === "pendente" && (
                      <Button 
                        size="sm" 
                        onClick={e => { e.stopPropagation(); onShowDispatch(req); }}
                        className="bg-blue-600 hover:bg-blue-500 h-9 rounded-xl px-4 font-bold"
                      >
                        <Send className="h-4 w-4 mr-2" /> Despachar
                      </Button>
                    )}
                    {req.status === "enviado" && (
                      <Button 
                        size="sm" 
                        onClick={e => { e.stopPropagation(); onShowReceive(req); }}
                        className="bg-emerald-600 hover:bg-emerald-500 h-9 rounded-xl px-4 font-bold"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar
                      </Button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border bg-black/10"
                    >
                      <div className="p-8">
                        {req.notes_request && (
                          <div className="mb-6 p-4 rounded-2xl bg-muted/30 border border-border/50 text-xs italic text-muted-foreground">
                            "{req.notes_request}"
                          </div>
                        )}
                        
                        <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/30">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/30 text-[9px] uppercase font-black text-muted-foreground tracking-widest">
                                <th className="p-4 text-left">Producto</th>
                                <th className="p-4 text-center">Pedido</th>
                                <th className="p-4 text-center">Enviado</th>
                                <th className="p-4 text-center">Recibido</th>
                                <th className="p-4 text-right">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                              {req.items?.map(item => {
                                const sentDiff = item.qty_sent != null && item.qty_sent < item.qty_requested;
                                const recvDiff = item.qty_received != null && item.qty_sent != null && item.qty_received !== item.qty_sent;
                                return (
                                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-4">
                                      <p className="font-bold text-sm">{item.product?.name}</p>
                                      <p className="text-[10px] text-muted-foreground font-mono">{item.product?.sku}</p>
                                    </td>
                                    <td className="p-4 text-center font-black text-amber-500/80">{item.qty_requested}</td>
                                    <td className="p-4 text-center">
                                      {item.qty_sent != null ? (
                                        <span className={cn("font-black text-blue-400", sentDiff && "text-rose-400")}>
                                          {item.qty_sent}
                                        </span>
                                      ) : <span className="text-muted-foreground">···</span>}
                                    </td>
                                    <td className="p-4 text-center">
                                      {item.qty_received != null ? (
                                        <span className={cn("font-black text-emerald-400", recvDiff && "text-rose-400")}>
                                          {item.qty_received}
                                        </span>
                                      ) : <span className="text-muted-foreground">···</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                      <Badge variant="outline" className={cn(
                                        "text-[8px] font-black uppercase tracking-tighter",
                                        recvDiff || sentDiff ? "border-rose-500/30 text-rose-400" : "border-emerald-500/30 text-emerald-400"
                                      )}>
                                        {recvDiff || sentDiff ? "Incidencia" : item.qty_received != null ? "Completado" : "En proceso"}
                                      </Badge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        
                        {(req.notes_dispatch || req.notes_received) && (
                          <div className="mt-6 flex flex-col gap-2">
                             {req.notes_dispatch && (
                               <div className="flex gap-2 items-start">
                                 <Send className="h-3 w-3 mt-1 text-blue-400" />
                                 <p className="text-[11px] text-blue-400/80 italic font-medium"><span className="font-bold uppercase tracking-tighter not-italic mr-1">Logística:</span> "{req.notes_dispatch}"</p>
                               </div>
                             )}
                             {req.notes_received && (
                               <div className="flex gap-2 items-start">
                                 <CheckCircle2 className="h-3 w-3 mt-1 text-emerald-400" />
                                 <p className="text-[11px] text-emerald-400/80 italic font-medium"><span className="font-bold uppercase tracking-tighter not-italic mr-1">Sede:</span> "{req.notes_received}"</p>
                               </div>
                             )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
