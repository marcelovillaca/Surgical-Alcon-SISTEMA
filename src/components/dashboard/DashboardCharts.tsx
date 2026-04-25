import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

import { formatUSD } from "@/lib/formatters";

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    fontSize: "12px",
    color: "hsl(var(--card-foreground))",
    boxShadow: "var(--shadow-lg)",
  },
};

interface MonthlySalesData {
  mes: string;
  ventas: number;
  costo: number;
}

interface ProductMixData {
  name: string;
  value: number;
  color: string;
}

interface MarginTrendData { mes: string; margen: number; }
export interface TopProductMarginData { name: string; ventas: number; costo: number; margin: number; units: number; }

export function SalesBarChart({ showCost = true, data }: { showCost?: boolean; data: MonthlySalesData[] }) {
  if (!data.length) return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center h-[340px]">
      <p className="text-sm text-muted-foreground">Sin datos de ventas para el período seleccionado</p>
    </div>
  );
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-display font-semibold text-foreground mb-4">
        {showCost ? "Ventas vs Costo Mensual" : "Mis Ventas por Mes"}
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatUSD} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => formatUSD(v)} {...tooltipStyle} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
          <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          {showCost && <Bar dataKey="costo" name="Costo" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProductMixChart({ data }: { data: ProductMixData[] }) {
  const renderLabel = ({ value }: { value: number }) => `${value}%`;
  if (!data.length) return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center h-[340px]">
      <p className="text-sm text-muted-foreground">Sin datos de mix</p>
    </div>
  );
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-display font-semibold text-foreground mb-4">Mix por Línea</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" label={renderLabel}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v: number) => `${v}%`} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {data.map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto font-medium text-foreground">{p.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Keep for TS compatibility but no longer rendered
export function MarginTrendChart({ data: _data }: { data: MarginTrendData[] }) { return null; }

export function TopProductMarginList({ data }: { data: TopProductMarginData[] }) {
  if (!data || data.length === 0) return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-center h-[260px]">
      <p className="text-sm text-muted-foreground">Sin datos de productos</p>
    </div>
  );
  const maxMargin = Math.max(...data.map(d => d.margin), 1);
  const MEDAL = ['🥇', '🥈', '🥉', '4', '5'];
  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-display font-semibold text-foreground mb-4">
        🏆 Top 5 Produtos — Gross Margin %
      </h3>
      <div className="space-y-3">
        {data.map((p, i) => {
          const barW = maxMargin > 0 ? Math.max(4, Math.round((p.margin / maxMargin) * 100)) : 0;
          const isNeg = p.margin < 0;
          return (
            <div key={p.name} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base w-6 shrink-0 text-center">{MEDAL[i]}</span>
                <span className="flex-1 text-xs font-medium text-foreground truncate" title={p.name}>{p.name}</span>
                <span
                  className={`text-sm font-black tabular-nums shrink-0 ${isNeg ? 'text-rose-400' : p.margin >= 40 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                >
                  {isNeg ? '' : '+'}{p.margin}%
                </span>
              </div>
              <div className="flex items-center gap-2 pl-8">
                {/* Progress bar */}
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barW}%`, background: isNeg ? 'hsl(0,70%,55%)' : COLORS[i] }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatUSD(p.ventas)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
