import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReceivePanel({ request, onSubmit }: any) {
  const [notes, setNotes] = useState("");
  const [receivedItems, setReceivedItems] = useState(
    request.items.map((i: any) => ({ 
      id: i.id, 
      product_id: i.product_id,
      product_name: i.product?.name, 
      sku: i.product?.sku,
      qty_sent: i.qty_sent || i.qty_requested, 
      qty_received: i.qty_sent || i.qty_requested, 
      divergence_reason: "" 
    }))
  );

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
        <p className="text-[10px] font-black uppercase text-emerald-400 mb-1 tracking-widest">Confirmación de Ingreso</p>
        <h4 className="font-bold text-lg text-foreground uppercase">{request.request_number}</h4>
        <p className="text-[11px] text-muted-foreground font-medium">Origen: Central Logística</p>
      </div>

      <div className="space-y-4">
        <label className="text-xs font-bold text-muted-foreground uppercase block">Verificar Items Recibidos</label>
        <div className="space-y-3">
          {receivedItems.map((item: any, idx: number) => {
            const hasDiff = item.qty_received !== item.qty_sent;
            return (
              <div key={item.id} className={cn(
                "p-4 rounded-2xl border transition-all duration-300",
                hasDiff ? "border-rose-500/30 bg-rose-500/5" : "border-border bg-background/30"
              )}>
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div>
                    <p className="font-black text-sm tracking-tight">{item.product_name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono">{item.sku}</p>
                  </div>
                  <div className="flex items-center gap-4 bg-black/20 p-2 rounded-xl border border-white/5">
                    <div className="text-center px-2">
                       <p className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Enviado</p>
                       <p className="text-sm font-black text-foreground">{item.qty_sent}</p>
                    </div>
                    <div className="h-4 w-[1px] bg-white/10" />
                    <div className="text-center px-1">
                       <p className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Recibido</p>
                       <input type="number" value={item.qty_received}
                         onChange={e => setReceivedItems((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, qty_received: Number(e.target.value) } : it))}
                         className="w-12 bg-transparent text-center text-sm font-black outline-none" />
                    </div>
                  </div>
                </div>
                
                {hasDiff && (
                  <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <AlertTriangle className="h-3 w-3 text-rose-400" />
                    <input 
                      placeholder="Indique motivo de la discrepancia..."
                      value={item.divergence_reason}
                      onChange={e => setReceivedItems((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, divergence_reason: e.target.value } : it))}
                      className="flex-1 bg-transparent text-[11px] text-rose-400 outline-none border-b border-rose-500/20 pb-1"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Observaciones Generales</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Notas adicionales sobre la recepción..."
          className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-sm outline-none resize-none focus:ring-2 focus:ring-blue-500/20" />
      </div>

      <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base rounded-2xl transition-all"
        onClick={() => onSubmit(request.id, request.institution_id, receivedItems, notes)}>
        <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar Recepción
      </Button>
    </div>
  );
}
