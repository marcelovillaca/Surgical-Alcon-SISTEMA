import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

export function NewRequestPanel({ products, institutions, defaultInstitution, isCoordinador, onSubmit }: any) {
  const [instId, setInstId] = useState(defaultInstitution);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; qty_requested: number }[]>([
    { product_id: "", qty_requested: 1 }
  ]);

  return (
    <div className="space-y-6">
      {!isCoordinador && (
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Sede Solicitante</label>
          <select value={instId} onChange={e => setInstId(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">Seleccione sede...</option>
            {institutions.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      )}

      <div className="space-y-3">
        <label className="text-xs font-bold text-muted-foreground uppercase block">Insumos Solicitados</label>
        <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_100px_32px] gap-2 items-center group">
              <select value={item.product_id}
                onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, product_id: e.target.value } : it))}
                className="h-11 px-4 rounded-xl border border-border bg-background/50 text-sm outline-none transition-all focus:border-blue-500/50">
                <option value="">Seleccione producto...</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                ))}
              </select>
              <input type="number" min={1} value={item.qty_requested}
                onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, qty_requested: Number(e.target.value) } : it))}
                className="h-11 px-4 rounded-xl border border-border bg-background/50 text-sm text-center outline-none"
                placeholder="Cant." />
              <button 
                onClick={() => setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                disabled={items.length === 1}
                className="text-rose-500 hover:bg-rose-500/10 rounded-lg p-1 transition-colors disabled:opacity-10">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setItems(prev => [...prev, { product_id: "", qty_requested: 1 }])}
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-bold transition-all mt-2 ml-1">
          <Plus className="h-4 w-4" /> Agregar más productos
        </button>
      </div>

      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Observaciones / Notas</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Escriba aquí alguna instrucción especial..."
          className="w-full px-4 py-3 rounded-2xl border border-border bg-background/50 text-sm outline-none resize-none focus:ring-2 focus:ring-blue-500/20" />
      </div>

      <Button 
        className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-black text-base rounded-2xl shadow-[0_10px_20px_rgba(37,99,235,0.2)] transition-all hover:scale-[1.01]"
        onClick={() => onSubmit(items.filter(i => i.product_id), notes)}>
        Crear Solicitud de Insumos
      </Button>
    </div>
  );
}
