import { useInventory } from "./InventoryProvider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES: Record<string, { label: string; color: string }> = {
  lente: { label: "Lente", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  insumo: { label: "Insumo", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  equipamento: { label: "Equipamento", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  outro: { label: "Outro", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

export function StockTable() {
  const { inventory, institutions, isAdmin, isGerente, institutionId } = useInventory();
  const [search, setSearch] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<string>(institutionId || "");

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesInst = !selectedInstitution || item.institution_id === selectedInstitution;
      const matchesSearch = !search ||
        item.product?.name.toLowerCase().includes(search.toLowerCase()) ||
        item.product?.sku.toLowerCase().includes(search.toLowerCase());
      return matchesInst && matchesSearch;
    });
  }, [inventory, selectedInstitution, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o categoría..."
            className="w-full pl-12 pr-4 h-12 rounded-2xl border border-border bg-card/40 backdrop-blur-sm text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
        {isAdmin && (
          <select
            value={selectedInstitution}
            onChange={e => setSelectedInstitution(e.target.value)}
            className="h-12 px-4 rounded-2xl border border-border bg-card/40 backdrop-blur-sm text-sm outline-none min-w-[240px] focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
          >
            <option value="">Todas las Sedes</option>
            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card/30 backdrop-blur-md overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border/50">
                <th className="p-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Producto</th>
                <th className="p-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Categoría</th>
                {isAdmin && <th className="p-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sede</th>}
                <th className="p-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">En Stock</th>
                <th className="p-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Estado</th>
                {isGerente && <th className="p-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Inversión</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              <AnimatePresence mode="popLayout">
                {filteredInventory.length === 0 ? (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={7} className="p-20 text-center text-muted-foreground italic bg-muted/5">
                      No se encontraron resultados para tu búsqueda.
                    </td>
                  </motion.tr>
                ) : filteredInventory.map((item, idx) => {
                  const isLow = item.quantity <= (item.product?.min_stock || 5);
                  const catCfg = CATEGORIES[item.product?.category || "outro"];
                  const instName = institutions.find(i => i.id === item.institution_id)?.name || "-";
                  const totalValue = (item.product?.base_cost || 0) * item.quantity;
                  
                  return (
                    <motion.tr
                      key={item.id || item.product_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={cn(
                        "group hover:bg-blue-500/5 transition-all duration-300",
                        isLow && "bg-rose-500/5"
                      )}
                    >
                      <td className="p-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-base group-hover:text-blue-400 transition-colors">
                            {item.product?.name}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground tracking-wider uppercase">
                            {item.product?.sku}
                          </span>
                        </div>
                      </td>
                      <td className="p-5">
                        <Badge variant="outline" className={cn("rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", catCfg?.color)}>
                          {catCfg?.label}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="p-5">
                          <span className="text-xs font-semibold text-muted-foreground">{instName}</span>
                        </td>
                      )}
                      <td className="p-5 text-center">
                        <div className="flex flex-col items-center">
                          <span className={cn(
                            "text-2xl font-black font-display",
                            isLow ? "text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.3)]" : "text-foreground"
                          )}>
                            {item.quantity}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.product?.unit}</span>
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        {isLow ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-tighter">Stock Crítico</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Normal</span>
                          </div>
                        )}
                      </td>
                      {isGerente && (
                        <td className="p-5 text-right">
                          <span className="font-display font-black text-blue-400">
                            {totalValue ? `$${totalValue.toLocaleString()}` : "—"}
                          </span>
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
