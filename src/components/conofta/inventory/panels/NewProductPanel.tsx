import { useState } from "react";
import { Button } from "@/components/ui/button";

export function NewProductPanel({ onSubmit }: any) {
  const [form, setForm] = useState({ sku: "", name: "", category: "insumo", unit: "unid", base_cost: 0, min_stock: 5 });
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs font-black text-muted-foreground uppercase mb-2 block tracking-widest">Nombre del Producto</label>
          <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="Ej: Lente AcrySof IQ"
            className="w-full h-12 px-4 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
        
        <div>
          <label className="text-xs font-black text-muted-foreground uppercase mb-2 block tracking-widest">SKU / Código</label>
          <input type="text" value={form.sku} onChange={e => set("sku", e.target.value)}
            placeholder="SN60WF"
            className="w-full h-12 px-4 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>

        <div>
           <label className="text-xs font-black text-muted-foreground uppercase mb-2 block tracking-widest">Categoría</label>
           <select value={form.category} onChange={e => set("category", e.target.value)}
             className="w-full h-12 px-4 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
             <option value="lente">Lente</option>
             <option value="insumo">Insumo</option>
             <option value="equipamento">Equipamiento</option>
             <option value="outro">Otro</option>
           </select>
        </div>

        <div>
          <label className="text-xs font-black text-muted-foreground uppercase mb-2 block tracking-widest">Unidad</label>
          <select value={form.unit} onChange={e => set("unit", e.target.value)}
            className="w-full h-12 px-4 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="unid">Unidad</option>
            <option value="caja">Caja</option>
            <option value="ml">Mililitros</option>
            <option value="pares">Pares</option>
            <option value="kit">Kit completo</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-black text-muted-foreground uppercase mb-2 block tracking-widest">Stock Crítico</label>
          <input type="number" min={0} value={form.min_stock} onChange={e => set("min_stock", Number(e.target.value))}
            className="w-full h-12 px-4 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-black text-muted-foreground uppercase mb-2 block tracking-widest">Costo Base ($)</label>
          <input type="number" min={0} step={0.01} value={form.base_cost} onChange={e => set("base_cost", Number(e.target.value))}
            className="w-full h-12 px-4 rounded-2xl border border-border bg-background/50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
        </div>
      </div>

      <Button 
        className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg rounded-3xl shadow-[0_15px_30px_rgba(37,99,235,0.2)] transition-all" 
        onClick={() => onSubmit(form)}>
        Registrar Nuevo Producto
      </Button>
    </div>
  );
}
