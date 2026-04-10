import { motion } from "framer-motion";
import { Package, AlertTriangle, Clock, ClipboardList, TrendingUp } from "lucide-react";
import { useInventory } from "./InventoryProvider";
import { cn } from "@/lib/utils";

export function InventoryStats() {
  const { products, inventory, requests, tasks } = useInventory();

  const lowStockCount = inventory.filter(
    item => item.quantity <= (item.product?.min_stock || 5)
  ).length;

  const stats = [
    {
      label: "Productos Activos",
      value: products.filter(p => p.is_active).length,
      icon: Package,
      color: "text-blue-400",
      bg: "from-blue-500/20 to-blue-600/5",
      border: "border-blue-500/20"
    },
    {
      label: "Stock Bajo",
      value: lowStockCount,
      icon: AlertTriangle,
      color: lowStockCount > 0 ? "text-rose-400" : "text-emerald-400",
      bg: lowStockCount > 0 ? "from-rose-500/20 to-rose-600/5" : "from-emerald-500/20 to-emerald-600/5",
      border: lowStockCount > 0 ? "border-rose-500/20" : "border-emerald-500/20",
      pulse: lowStockCount > 0
    },
    {
      label: "Pedidos Pendientes",
      value: requests.filter(r => r.status === "pendente").length,
      icon: Clock,
      color: "text-amber-400",
      bg: "from-amber-500/20 to-amber-600/5",
      border: "border-amber-500/20"
    },
    {
      label: "Tareas del Mes",
      value: tasks.filter(t => t.status === "pendente").length,
      icon: ClipboardList,
      color: "text-purple-400",
      bg: "from-purple-500/20 to-purple-600/5",
      border: "border-purple-500/20"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={cn(
            "relative group overflow-hidden rounded-3xl border p-6 bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl",
            stat.bg,
            stat.border
          )}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <stat.icon className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {stat.label}
              </p>
              {stat.pulse && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className={cn("text-4xl font-black font-display", stat.color)}>
                {stat.value}
              </h3>
              {stat.label === "Stock Bajo" && stat.value > 0 && (
                <p className="text-[10px] font-medium text-rose-400/70">Requires Action</p>
              )}
            </div>
          </div>
          
          {/* Subtle micro-chart representation (placeholder bars) */}
          <div className="mt-4 flex gap-1 h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-1000 delay-300", 
                stat.color.replace('text-', 'bg-'))}
              style={{ width: `${Math.min((stat.value / 20) * 100, 100)}%` }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
