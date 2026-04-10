import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, Droplets } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export function JourneyConsumptionPanel({ products, journeyId, journeys, onSubmit }: any) {
  const [jId, setJId] = useState(journeyId);
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([
    { product_id: "", quantity: 1 }
  ]);
  const { toast } = useToast();

  const journeyData = journeys.find((j: any) => j.id === jId);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-blue-500/5 border border-emerald-500/20 shadow-inner">
        <p className="text-[10px] font-black uppercase text-emerald-400 mb-2 tracking-[0.2em]">Jornada Seleccionada</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <Droplets className="h-5 w-5 text-emerald-400" />
            </div>
            <h4 className="font-black text-lg text-foreground uppercase">{journeyData?.name || "No seleccionada"}</h4>
          </div>
          {journeyData && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Fecha Evento</p>
              <p className="text-sm font-black text-foreground">{format(parseISO(journeyData.date), "dd MMMM, yyyy")}</p>
            </div>
          )}
        </div>
        {!jId && (
          <select value={jId} onChange={e => setJId(e.target.value)}
            className="mt-6 w-full h-12 px-4 rounded-xl border border-white/10 bg-black/40 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50">
            <option value="">Seleccione una jornada activa...</option>
            {journeys.map((j: any) => <option key={j.id} value={j.id}>{j.name} ({format(parseISO(j.date), "dd/MM/yy")})</option>)}
          </select>
        )}
      </div>

      <div className="space-y-4">
        <label className="text-xs font-black text-muted-foreground uppercase block tracking-widest ml-1">Insumos y Materiales Utilizados</label>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_100px_32px] gap-3 items-center p-3 rounded-2xl bg-card border border-border/50 group hover:border-emerald-500/30 transition-all">
              <select value={item.product_id}
                onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, product_id: e.target.value } : it))}
                className="h-10 px-3 rounded-xl border border-transparent bg-muted/40 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                <option value="">Seleccione insumo...</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                ))}
              </select>
              <div className="relative">
                <input type="number" min={0.5} step={0.5} value={item.quantity}
                  onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) } : it))}
                  className="w-full h-10 px-3 rounded-xl border border-transparent bg-muted/40 text-sm font-black text-center outline-none focus:ring-2 focus:ring-emerald-500/20" />
              </div>
              <button 
                onClick={() => setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                disabled={items.length === 1}
                className="text-rose-500 hover:bg-rose-500/10 rounded-xl p-2 transition-colors disabled:opacity-10 group-hover:scale-110">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setItems(prev => [...prev, { product_id: "", quantity: 1 }])}
          className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-black transition-all ml-1 mt-2">
          <Plus className="h-4 w-4" /> Agregar más ítems
        </button>
      </div>

      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
        <p className="text-[11px] text-amber-500 leading-relaxed font-medium">
          <strong>Importante:</strong> Al confirmar, estos insumos se descontarán automáticamente del inventario de la sede y se registrarán como costo operativo de la jornada.
        </p>
      </div>

      <Button 
        className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-3xl shadow-[0_15px_30px_rgba(16,185,129,0.2)] transition-all"
        onClick={() => {
          const valid = items.filter(i => i.product_id && i.quantity > 0);
          if (valid.length === 0) return toast({ title: "Agregue insumos válidos", variant: "destructive" });
          if (!jId) return toast({ title: "Seleccione una jornada", variant: "destructive" });
          onSubmit(jId, valid);
        }}
      >
        Confirmar y Aplicar Stock
      </Button>
    </div>
  );
}
