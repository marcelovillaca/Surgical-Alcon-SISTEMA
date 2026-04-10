import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

export function DispatchPanel({ request, onSubmit }: any) {
  const [notes, setNotes] = useState("");
  const [sentItems, setSentItems] = useState(
    request.items.map((i: any) => ({ id: i.id, product_name: i.product?.name, qty_requested: i.qty_requested, qty_sent: i.qty_requested }))
  );

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
        <p className="text-[10px] font-black uppercase text-blue-400 mb-1 tracking-widest">Resumen del Pedido</p>
        <h4 className="font-bold text-lg text-foreground uppercase">{request.request_number}</h4>
        <p className="text-[11px] text-muted-foreground font-medium">{request.institution?.name}</p>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-bold text-muted-foreground uppercase block">Validar cantidades a enviar</label>
        <div className="space-y-3">
          {sentItems.map((item: any, idx: number) => (
            <div key={item.id} className="p-4 rounded-xl border border-border bg-background/30 flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-sm tracking-tight">{item.product_name}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Solicitado: <span className="text-amber-400 font-black">{item.qty_requested}</span></p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <label className="text-[9px] font-black text-muted-foreground uppercase mr-1">Enviado</label>
                <input type="number" value={item.qty_sent}
                  onChange={e => setSentItems((prev: any) => prev.map((it: any, i: number) => i === idx ? { ...it, qty_sent: Number(e.target.value) } : it))}
                  className="w-20 h-10 px-3 rounded-lg border border-border bg-background text-sm text-center font-black outline-none focus:border-blue-500/50" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Notas de Logística</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Ej: Se enviaron sustitutos por quiebre de stock..."
          className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-sm outline-none resize-none focus:ring-2 focus:ring-blue-500/20" />
      </div>

      <Button 
        className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-black text-base rounded-2xl transition-all"
        onClick={() => onSubmit(request.id, sentItems, notes)}>
        <Send className="h-4 w-4 mr-2" /> Confirmar Despacho
      </Button>
    </div>
  );
}
