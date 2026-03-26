import { formatUSD } from "@/lib/formatters";

interface RankItem {
  name: string;
  value: number;
  pct: number;
}

export function TopRankings({ topClients, topProducts }: { topClients: RankItem[]; topProducts: RankItem[] }) {
  if (!topClients.length && !topProducts.length) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <RankingCard title="Top 5 Clientes" items={topClients} variant="gold" />
      <RankingCard title="Top 5 Productos" items={topProducts} variant="emerald" />
    </div>
  );
}

export function RankingCard({ title, items, variant }: { title: string; items: RankItem[]; variant: "gold" | "emerald" }) {
  const accentClass = variant === "gold" ? "gradient-gold" : "gradient-emerald";
  if (!items.length) return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-display font-semibold text-foreground mb-4">{title}</h3>
      <p className="text-sm text-muted-foreground">Sin datos</p>
    </div>
  );
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-display font-semibold text-foreground mb-4">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                <p className="text-sm font-semibold text-foreground ml-2 shrink-0">{formatUSD(item.value)}</p>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${accentClass} transition-all duration-500`} style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
