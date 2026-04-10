import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardFilters {
  year: string;
  months: string[];
  lines: string[];
  vendedor: string;
}

interface SalesRow {
  fecha: string;
  cliente: string;
  cod_cliente: string;
  ciudad: string;
  linea_de_producto: string;
  codigo_producto: string;
  producto: string;
  costo: number;
  total: number;
  monto_usd: number;
  vendedor: string;
  mercado?: string;
}

interface TargetRow {
  visitador: string;
  linea_de_producto: string;
  anio: number;
  enero: number; febrero: number; marzo: number; abril: number;
  mayo: number; junio: number; julio: number; agosto: number;
  septiembre: number; octubre: number; noviembre: number; diciembre: number;
  total: number;
}

const MONTH_ABBR_TO_NUM: Record<string, number> = {
  Ene: 1, Feb: 2, Mar: 3, Abr: 4, May: 5, Jun: 6,
  Jul: 7, Ago: 8, Sep: 9, Oct: 10, Nov: 11, Dic: 12,
};
const MONTH_NUM_TO_KEY: Record<number, string> = {
  1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
  5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
  9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre',
};
const MONTH_NUM_TO_ABBR: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic',
};

function normalizeLine(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}

/** Returns a displayable name: uses name if it exists and is not purely numeric; otherwise falls back to cod_cliente */
function clienteDisplay(cliente: string, cod_cliente: string): string {
  const name = (cliente || '').trim();
  if (name && !/^\d+$/.test(name)) return name;
  return (cod_cliente || '').trim() || name || 'Sin nombre';
}

export function useDashboardData(filters: DashboardFilters, includePublic = false) {
  const [salesRaw, setSalesRaw] = useState<SalesRow[]>([]);
  const [targetsRaw, setTargetsRaw] = useState<TargetRow[]>([]);
  const [productCostsRaw, setProductCostsRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      let allSales: SalesRow[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.from('sales_details')
          .select('fecha,cliente,cod_cliente,ciudad,linea_de_producto,codigo_producto,producto,costo,total,monto_usd,vendedor,mercado')
          .range(from, from + pageSize - 1);
        if (error) { console.error('Error fetching sales:', error); break; }
        if (!data || data.length === 0) break;
        allSales = allSales.concat(data as unknown as SalesRow[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const { data: tData } = await supabase.from('sales_targets').select('*');
      const { data: pcData } = await supabase.from('conofta_product_costs' as any).select('*');
      setSalesRaw(allSales);
      setTargetsRaw((tData as TargetRow[]) || []);
      setProductCostsRaw((pcData as any[]) || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const year = parseInt(filters.year);
    const monthNums = filters.months.includes('Todos') ? null : filters.months.map(m => MONTH_ABBR_TO_NUM[m]).filter(Boolean);
    const normStr = (v: string) => (v || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const costsForYear = productCostsRaw.filter(r => !r.anio || r.anio === year);
    const effectiveCosts = costsForYear.length > 0 ? costsForYear : productCostsRaw;
    const costRefMap: Record<string, number> = {};
    effectiveCosts.forEach(r => {
      const key = normStr(r.item_name || '');
      if (key) {
        // Priority: costo_alcon (for dashboard margins)
        // Fallback: costo_unitario
        costRefMap[key] = Number(r.costo_alcon || r.costo_unitario || 0);
      }
    });
    const normalizedFilterLines = filters.lines.map(l => normalizeLine(l));
    const allLines = filters.lines.includes('Todas');
    const filterVendedor = filters.vendedor.trim().toLowerCase();

    const sales = salesRaw.filter(s => {
      const d = new Date(s.fecha);
      if (d.getFullYear() !== year) return false;
      if (monthNums && !monthNums.includes(d.getMonth() + 1)) return false;
      if (!allLines && !normalizedFilterLines.includes(normalizeLine(s.linea_de_producto))) return false;
      if (filterVendedor !== 'todos' && s.vendedor.trim().toLowerCase() !== filterVendedor) return false;
      if (!includePublic) {
        const mStr = (s.mercado || '').toString().toLowerCase();
        if (mStr.includes('p\u00fablico') || mStr.includes('publico')) return false;
        if ((s.cliente || '').toUpperCase().includes('CONOFTA')) return false;
      }
      return true;
    });

    const targets = targetsRaw.filter(t => {
      if (t.anio !== year) return false;
      if (!allLines && !normalizedFilterLines.some(fl => normalizeLine(t.linea_de_producto) === fl)) return false;
      if (filterVendedor !== 'todos' && t.visitador.trim().toLowerCase() !== filterVendedor) return false;
      return true;
    });

    const totalVentas = sales.reduce((s, r) => s + Number(r.monto_usd), 0);
    // COSTO (col K) = unit cost per item. CANT (col L) = qty stored in r.total.
    // Total row cost = unit_cost × qty — ALWAYS multiply (user confirmed costo = unit cost).
    const rowCost = (r: SalesRow): number => {
      const qty = Math.max(Number(r.total) || 1, 1);  // qty from CANT column
      const refCost = costRefMap[normStr(r.codigo_producto)] ?? costRefMap[normStr(r.producto)];
      return (refCost != null && refCost > 0)
        ? refCost * qty           // centralized reference cost × qty (most accurate)
        : Number(r.costo) * qty;  // unit cost from file (COSTO col K) × qty (CANT col L)
    };

    const totalCosto = sales.reduce((s, r) => s + rowCost(r), 0);
    const totalUnits = sales.reduce((s, r) => s + Number(r.total), 0);
    const totalProfit = totalVentas - totalCosto;
    const grossMargin = totalVentas > 0 ? (totalProfit / totalVentas) * 100 : 0;
    const uniqueProducts = new Set(sales.map(s => s.producto)).size;
    const uniqueClients = new Set(sales.map(s => clienteDisplay(s.cliente, s.cod_cliente))).size;

    const monthlyMap = new Map<number, { ventas: number; costo: number }>();
    sales.forEach(s => {
      const m = new Date(s.fecha).getMonth() + 1;
      const cur = monthlyMap.get(m) || { ventas: 0, costo: 0 };
      cur.ventas += Number(s.monto_usd);
      cur.costo += rowCost(s);
      monthlyMap.set(m, cur);
    });
    const monthlySales = Array.from(monthlyMap.entries()).sort(([a], [b]) => a - b)
      .map(([m, v]) => ({ mes: MONTH_NUM_TO_ABBR[m], ventas: Math.round(v.ventas), costo: Math.round(v.costo) }));

    const lineMap = new Map<string, number>();
    const unitMap = new Map<string, number>();
    const lineNames = new Map<string, string>();
    sales.forEach(s => {
      const norm = normalizeLine(s.linea_de_producto);
      lineMap.set(norm, (lineMap.get(norm) || 0) + Number(s.monto_usd));
      unitMap.set(norm, (unitMap.get(norm) || 0) + Number(s.total));
      if (!lineNames.has(norm)) lineNames.set(norm, s.linea_de_producto);
    });
    const totalForMix = Array.from(lineMap.values()).reduce((a, b) => a + b, 0);
    const LINE_COLORS: Record<string, string> = {
      'Total Monofocals': 'hsl(45,90%,55%)', 'Vit Ret Paks': 'hsl(197,100%,44%)',
      'Phaco Paks': 'hsl(200,70%,50%)', 'Equipment': 'hsl(280,60%,55%)',
      'ATIOLs': 'hsl(20,80%,55%)', 'OVDS and Solutions': 'hsl(160,60%,45%)',
      'OVDs & Solutions': 'hsl(160,60%,45%)', 'Rest of Portfolio': 'hsl(0,0%,45%)',
    };
    const productMix = Array.from(lineMap.entries())
      .map(([norm, val]) => { const n = lineNames.get(norm) || norm; return { name: n, value: totalForMix > 0 ? Math.round((val / totalForMix) * 100) : 0, color: LINE_COLORS[n] || 'hsl(0,0%,40%)' }; })
      .sort((a, b) => b.value - a.value);

    const marginTrend = Array.from(monthlyMap.entries()).sort(([a], [b]) => a - b)
      .map(([m, v]) => ({ mes: MONTH_NUM_TO_ABBR[m], margen: v.ventas > 0 ? Math.round(((v.ventas - v.costo) / v.ventas) * 100) : 0 }));

    // Top 5 products by gross margin %
    const prodMarginMap = new Map<string, { ventas: number; costo: number; units: number }>();
    sales.forEach(s => {
      const key = (s.producto || '').trim();
      if (!key) return;
      const cur = prodMarginMap.get(key) || { ventas: 0, costo: 0, units: 0 };
      cur.ventas += Number(s.monto_usd);
      cur.costo += rowCost(s);
      cur.units += Number(s.total);
      prodMarginMap.set(key, cur);
    });
    const topProductsByMargin = Array.from(prodMarginMap.entries())
      .filter(([, v]) => v.ventas > 0)
      .map(([name, v]) => ({
        name,
        ventas: Math.round(v.ventas),
        costo: Math.round(v.costo),
        margin: Math.round(((v.ventas - v.costo) / v.ventas) * 100),
        units: v.units,
      }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);

    const uniqueNL = Array.from(new Set([...Array.from(lineNames.keys()), ...targetsRaw.filter(t => t.anio === year).map(t => normalizeLine(t.linea_de_producto))]));
    const filteredNL = allLines ? uniqueNL : uniqueNL.filter(n => normalizedFilterLines.includes(n));
    const activeMonths = monthNums || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const accelerometers = filteredNL.map(norm => {
      const originalName = lineNames.get(norm) || norm;
      const actualVentas = lineMap.get(norm) || 0;
      const actualUnits = unitMap.get(norm) || 0;
      const lineTargets = targets.filter(t => normalizeLine(t.linea_de_producto) === norm);
      let lineMeta = 0;
      lineTargets.forEach(t => { activeMonths.forEach(m => { const key = MONTH_NUM_TO_KEY[m]; if (key) lineMeta += Number((t as any)[key] || 0); }); });
      const cumplimiento = lineMeta > 0 ? Math.round((actualVentas / lineMeta) * 100) : 0;
      const revFaltante = Math.max(0, lineMeta - actualVentas);
      const avgPrice = actualUnits > 0 ? actualVentas / actualUnits : 0;
      const unitsFaltantes = (avgPrice > 0 && revFaltante > 0) ? Math.ceil(revFaltante / avgPrice) : 0;
      return { name: originalName, cumplimiento, meta: Math.round(lineMeta), actual: Math.round(actualVentas), unitsFaltantes };
    }).sort((a, b) => b.actual - a.actual);

    const equipmentData = accelerometers.find(a => normalizeLine(a.name) === 'equipment');
    const otherAccelerometers = accelerometers.filter(a => normalizeLine(a.name) !== 'equipment');
    const totalTarget = Math.round(accelerometers.reduce((s, a) => s + a.meta, 0));
    const overallCumplimiento = totalTarget > 0 ? Math.round((totalVentas / totalTarget) * 100) : 0;
    const overallRevFaltante = Math.max(0, totalTarget - totalVentas);
    const overallAvgPrice = totalUnits > 0 ? totalVentas / totalUnits : 0;
    const overallUnitsFaltantes = (overallAvgPrice > 0 && overallRevFaltante > 0) ? Math.ceil(overallRevFaltante / overallAvgPrice) : 0;

    const clientMap = new Map<string, number>();
    sales.forEach(s => { const key = clienteDisplay(s.cliente, s.cod_cliente); clientMap.set(key, (clientMap.get(key) || 0) + Number(s.monto_usd)); });
    const topClients = Array.from(clientMap.entries()).sort(([, a], [, b]) => b - a).slice(0, 5);
    const maxClient = topClients[0]?.[1] || 1;

    const prodMap = new Map<string, number>();
    sales.forEach(s => { prodMap.set(s.producto.trim(), (prodMap.get(s.producto.trim()) || 0) + Number(s.monto_usd)); });
    const topProducts = Array.from(prodMap.entries()).sort(([, a], [, b]) => b - a).slice(0, 5);
    const maxProd = topProducts[0]?.[1] || 1;

    return {
      kpis: { totalVentas, totalCosto, totalProfit, grossMargin, uniqueProducts, uniqueClients, totalUnits },
      monthlySales, productMix, marginTrend, topProductsByMargin,
      accelerometers: otherAccelerometers, equipmentData,
      overallCumplimiento, totalTarget, overallUnitsFaltantes,
      topClients: topClients.map(([name, val]) => ({ name, value: Math.round(val), pct: Math.round((val / maxClient) * 100) })),
      topProducts: topProducts.map(([name, val]) => ({ name, value: Math.round(val), pct: Math.round((val / maxProd) * 100) })),
    };
  }, [salesRaw, targetsRaw, productCostsRaw, filters, includePublic]);

  return { data: filtered, loading };
}