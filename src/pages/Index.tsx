import { useState } from "react";
import KpiCard from "@/components/dashboard/KpiCard";
import { SalesBarChart, ProductMixChart, TopProductMarginList } from "@/components/dashboard/DashboardCharts";
import { RankingCard } from "@/components/dashboard/TopRankings";
import MetaAccelerator from "@/components/dashboard/MetaAccelerator";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import { useUserRole } from "@/hooks/useUserRole";
import { useDashboardData, DashboardFilters as Filters } from "@/hooks/useDashboardData";
import {
  DollarSign, TrendingUp, ShoppingCart, Users, AlertTriangle, ClipboardList, MapPin, CalendarCheck, Package, Globe,
} from "lucide-react";

import { formatUSD, formatPct } from "@/lib/formatters";

const Dashboard = () => {
  const { isGerente } = useUserRole();
  const [filters, setFilters] = useState<Filters>({
    year: new Date().getFullYear().toString(),
    months: ["Todos"],
    lines: ["Todas"],
    vendedor: "Todos",
  });
  const [includePublic, setIncludePublic] = useState(false);
  const { data, loading } = useDashboardData(filters, includePublic);

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <DashboardFilters isGerente={isGerente} onFiltersChange={setFilters} />
        {isGerente && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer shrink-0">
            <div onClick={() => setIncludePublic(!includePublic)}
              className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${includePublic ? "bg-primary" : "bg-muted"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${includePublic ? "translate-x-4" : ""}`} />
            </div>
            <Globe className="h-3.5 w-3.5" /> Incluir Mercado Público
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-lg gradient-emerald animate-pulse" />
        </div>
      ) : (
        <>
          {/* KPI Row */}
          {isGerente ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              <KpiCard title="Revenue USD" value={formatUSD(data.kpis.totalVentas)} changeType="positive" icon={DollarSign} variant="gold" />
              <KpiCard title="Net Profit" value={formatUSD(data.kpis.totalProfit)} changeType="positive" icon={TrendingUp} variant="emerald" />
              <KpiCard title="Gross Margin" value={formatPct(data.kpis.grossMargin)} changeType="positive" icon={TrendingUp} />
              <KpiCard title="Cumplimiento" value={formatPct(data.overallCumplimiento)} change={`Meta: ${formatUSD(data.totalTarget)}`} changeType={data.overallCumplimiento >= 100 ? "positive" : data.overallCumplimiento >= 80 ? "neutral" : "negative"} icon={ClipboardList} />
              <KpiCard title="Unidades" value={data.kpis.totalUnits.toLocaleString()} change="Volumen total" changeType="neutral" icon={Package} />
              <KpiCard title="Productos" value={data.kpis.uniqueProducts.toString()} change={`${data.productMix.length} líneas`} changeType="neutral" icon={ShoppingCart} />
              <KpiCard title="Clientes" value={data.kpis.uniqueClients.toString()} changeType="positive" icon={Users} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <KpiCard title="Mis Ventas" value={formatUSD(data.kpis.totalVentas)} changeType="positive" icon={DollarSign} variant="gold" />
              <KpiCard title="Clientes Activos" value={String(data.kpis.uniqueClients)} changeType="positive" icon={Users} />
              <KpiCard title="Productos" value={String(data.kpis.uniqueProducts)} changeType="neutral" icon={ShoppingCart} />
              <KpiCard title="Cumplimiento" value={`${data.overallCumplimiento}%`} changeType={data.overallCumplimiento >= 100 ? "positive" : "neutral"} icon={CalendarCheck} variant="emerald" />
            </div>
          )}

          {/* Charts Row */}
          {isGerente ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-2">
                  <SalesBarChart showCost={true} data={data.monthlySales} />
                </div>
                <MetaAccelerator
                  label="Meta Global (USD)"
                  cumplimiento={data.overallCumplimiento}
                  metaTotal={formatUSD(data.totalTarget)}
                  ventaActual={formatUSD(data.kpis.totalVentas)}
                  unitsFaltantes={data.overallUnitsFaltantes}
                />
                <MetaAccelerator
                  label="Meta Equipment"
                  cumplimiento={data.equipmentData?.cumplimiento || 0}
                  metaTotal={formatUSD(data.equipmentData?.meta || 0)}
                  ventaActual={formatUSD(data.equipmentData?.actual || 0)}
                  unitsFaltantes={data.equipmentData?.unitsFaltantes}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ProductMixChart data={data.productMix} />
                <RankingCard title="Top 5 Clientes" items={data.topClients} variant="gold" />
                <RankingCard title="Top 5 Productos" items={data.topProducts} variant="emerald" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SalesBarChart showCost={false} data={data.monthlySales} />
              <ProductMixChart data={data.productMix} />
              <RankingCard title="Mis Clientes" items={data.topClients} variant="gold" />
              <RankingCard title="Mis Productos" items={data.topProducts} variant="emerald" />
            </div>
          )}

          {/* Line Accelerometers */}
          {isGerente && (
            <div className="space-y-4">
              <h3 className="text-lg font-display font-bold text-foreground">Cumplimiento por Línea</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {data.accelerometers.map((acc, i) => (
                  <MetaAccelerator
                    key={i}
                    compact
                    label={acc.name}
                    cumplimiento={acc.cumplimiento}
                    metaTotal={formatUSD(acc.meta)}
                    ventaActual={formatUSD(acc.actual)}
                    unitsFaltantes={acc.unitsFaltantes}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Margin Trend - only gerente */}
          {isGerente && <TopProductMarginList data={data.topProductsByMargin} />}


        </>
      )}
    </div>
  );
};

export default Dashboard;
