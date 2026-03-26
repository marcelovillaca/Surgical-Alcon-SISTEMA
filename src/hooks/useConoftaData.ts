import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConoftaFilters {
    year: string; months: string[]; sucursal?: string; medico?: string;
}

const M_ABBR_TO_NUM: Record<string, number> = { Ene: 1, Feb: 2, Mar: 3, Abr: 4, May: 5, Jun: 6, Jul: 7, Ago: 8, Sep: 9, Oct: 10, Nov: 11, Dic: 12 };
const M_NUM_TO_ABBR: Record<number, string> = { 1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun", 7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic" };
const M_LABEL_TO_COL: Record<string, string> = { Ene: "enero", Feb: "febrero", Mar: "marzo", Abr: "abril", May: "mayo", Jun: "junio", Jul: "julio", Ago: "agosto", Sep: "septiembre", Oct: "octubre", Nov: "noviembre", Dic: "diciembre" };

const norm = (val: string) => {
    if (!val) return "";
    return val.toString().trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/^(CONOFTA|CLINICA|SEDE|UNIDAD|DR|DRA|DR\.|DRA\.)[\s\.]+/g, "")
        .replace(/\s+/g, " ").trim();
};

function parseDateParts(val: any): { y: number; m: number } | null {
    if (!val) return null;
    try {
        const s = String(val).trim();
        if (s.includes('-')) {
            const p = s.split('T')[0].split('-');
            if (p[0].length === 4) return { y: parseInt(p[0]), m: parseInt(p[1]) };
        }
        if (s.includes('/')) {
            const p = s.split('/');
            if (p[2].length === 4) return { y: parseInt(p[2]), m: parseInt(p[1]) };
            if (p[0].length === 4) return { y: parseInt(p[0]), m: parseInt(p[1]) };
        }
        const d = new Date(val);
        if (!isNaN(d.getTime())) return { y: d.getFullYear(), m: d.getMonth() + 1 };
    } catch (e) { }
    return null;
}

export function useConoftaData(filters: ConoftaFilters) {
    const [targetsRaw, setTargetsRaw] = useState<any[]>([]);
    const [expensesRaw, setExpensesRaw] = useState<any[]>([]);
    const [surgeriesRaw, setSurgeriesRaw] = useState<any[]>([]);
    const [productCostsRaw, setProductCostsRaw] = useState<any[]>([]);
    const [equipmentRaw, setEquipmentRaw] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [t, e, surg, prod, eq] = await Promise.all([
                supabase.from("conofta_targets").select("*"),
                supabase.from("conofta_expenses").select("*"),
                supabase.from("conofta_surgeries" as any).select("*"),
                supabase.from("conofta_product_costs" as any).select("*"),
                supabase.from("conofta_equipment_investments" as any).select("*")
            ]);
            setTargetsRaw(t.data || []); setExpensesRaw(e.data || []); setSurgeriesRaw(surg.data || []); setProductCostsRaw(prod.data || []); setEquipmentRaw(eq.data || []);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchAllData(); }, []);

    const data = useMemo(() => {
        const cYear = parseInt(filters.year);
        const monthNums = filters.months.includes("Todos") ? null : filters.months.map(m => M_ABBR_TO_NUM[m]).filter(Boolean);

        const j2b: Record<string, string> = {};
        surgeriesRaw.forEach(s => { if (s.jornada_id && s.sucursal && (s.tipo_costo || 'directo') === 'directo') j2b[s.jornada_id] = s.sucursal; });

        const processedSurg = surgeriesRaw.map(s => {
            if (!s.sucursal && s.jornada_id && j2b[s.jornada_id]) return { ...s, sucursal: j2b[s.jornada_id] };
            return s;
        });

        const allBranches = Array.from(new Set(processedSurg.map(s => s.sucursal).filter(Boolean)));
        const branchCount = Math.max(1, allBranches.length);

        const docBranchesSet = filters.medico !== "Todos"
            ? new Set(processedSurg.filter(s => norm(s.medico || "") === norm(filters.medico)).map(s => norm(s.sucursal)).filter(Boolean))
            : null;

        const filteredExpenses = expensesRaw.filter(e => {
            if (e.anio !== cYear || (monthNums && !monthNums.includes(e.mes))) return false;
            const espSuc = norm(e.sucursal || "");
            const selSuc = norm(filters.sucursal || "Todas");

            // If branch is specified, stick to it
            if (selSuc !== "TODAS") {
                if (espSuc === selSuc) return true;
                if (!espSuc || ["GLOBAL", "TODAS", "CENTRAL", "ADMIN", "ADMINISTRACION", "ADM", "CONOFTA ADM"].includes(espSuc)) return true;
                return false;
            }

            // If only doctor is specified, restrict branch expenses to active branches
            if (docBranchesSet && espSuc && !["GLOBAL", "TODAS", "CENTRAL", "ADMIN", "ADMINISTRACION", "ADM", "CONOFTA ADM"].includes(espSuc)) {
                return docBranchesSet.has(espSuc);
            }
            return true;
        }).map(e => {
            const espSuc = norm(e.sucursal || "");
            const isFilterActive = (filters.sucursal && filters.sucursal !== "Todas") || (filters.medico && filters.medico !== "Todos");

            // Distribute global costs if a filter is active
            if (isFilterActive && (!espSuc || ["GLOBAL", "TODAS", "CENTRAL", "ADMIN", "ADMINISTRACION", "ADM", "CONOFTA ADM"].includes(espSuc))) {
                return { ...e, monto: Number(e.monto || 0) / branchCount };
            }
            return e;
        });

        const surgDetail = processedSurg.filter(s => {
            const dp = parseDateParts(s.fecha || s.fecha_cirugia);
            if (!dp || dp.y !== cYear || (monthNums && !monthNums.includes(dp.m))) return false;
            if (filters.sucursal && filters.sucursal !== "Todas" && norm(s.sucursal || "") !== norm(filters.sucursal)) return false;
            if (filters.medico && filters.medico !== "Todos" && norm(s.medico || "") !== norm(filters.medico)) return false;
            return true;
        });

        const refMap: Record<string, { costo: number; honorario: number }> = {};
        // Use costs for the selected year; if none exist, fall back to the most recent year available
        const costsForYear = productCostsRaw.filter(r => !r.anio || r.anio === cYear);
        const effectiveCosts = costsForYear.length > 0 ? costsForYear : productCostsRaw;
        effectiveCosts.forEach(r => {
            const iName = norm(r.item_name || ""); const bName = norm(r.sucursal || "");
            if (!refMap[iName]) refMap[iName] = { costo: 0, honorario: 0 };
            if (r.costo_unitario) refMap[iName].costo = Number(r.costo_unitario);
            if (r.honorario_base) refMap[iName].honorario = Number(r.honorario_base);
            if (bName) refMap[`${iName}|${bName}`] = { costo: Number(r.costo_unitario || 0), honorario: Number(r.honorario_base || 0) };
        });

        const yearTargets = targetsRaw.filter(t => t.anio === cYear);

        const getRevPerSurgery = (suc?: string, type?: string) => {
            const t = yearTargets.find(it => {
                const sMatch = !suc || suc === "Todas" || norm(it.sucursal) === norm(suc) || !it.sucursal;
                const tMatch = !type || norm(it.tipo_cirugia) === norm(type) || !it.tipo_cirugia || it.tipo_cirugia === "Catarata";
                return sMatch && tMatch;
            }) || yearTargets[0];
            return Number(t?.revenue_per_surgery || 0);
        };

        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1; const mSurgeries = surgDetail.filter(s => parseDateParts(s.fecha || s.fecha_cirugia)?.m === m);
            const mExp = filteredExpenses.filter(e => e.mes === m);

            const catSurgeries = mSurgeries.filter(s => norm(s.procedimiento).includes("RETINA") || norm(s.producto_nombre).includes("RETINA"));
            const normalSurgeries = mSurgeries.filter(s => !catSurgeries.includes(s) && (s.tipo_costo || 'directo') === 'directo');

            const revenue = normalSurgeries.length * getRevPerSurgery(filters.sucursal, "Catarata") +
                catSurgeries.length * getRevPerSurgery(filters.sucursal, "Retina");

            // Calculate journey costs (indirect costs per journey)
            const journeyCosts: Record<string, number> = {};
            const journeySurgeryCount: Record<string, number> = {};

            // First pass: sum all indirect costs per journey and count surgeries
            processedSurg.forEach(s => {
                const dp = parseDateParts(s.fecha || s.fecha_cirugia);
                if (!dp || dp.y !== cYear || dp.m !== m) return;

                const jId = s.jornada_id;
                if (!jId) return;

                if (s.tipo_costo === 'indirecto') {
                    // Sum indirect costs for this journey
                    if (!journeyCosts[jId]) journeyCosts[jId] = 0;

                    let indirectCost = Number(s.costo_unitario || 0);
                    if (indirectCost === 0 && s.producto_nombre) {
                        const n = norm(s.producto_nombre); const b = norm(s.sucursal || "");
                        indirectCost = refMap[`${n}|${b}`]?.costo || refMap[n]?.costo || 0;
                    }
                    journeyCosts[jId] += indirectCost * Number(s.cantidad || 1);
                } else if (s.tipo_costo === 'directo') {
                    // Count direct surgeries for this journey
                    if (!journeySurgeryCount[jId]) journeySurgeryCount[jId] = 0;
                    journeySurgeryCount[jId]++;
                }
            });

            // Second pass: calculate costs separately for P&L visibility
            let costoLentes = 0;
            let costoInsumos = 0;

            mSurgeries.filter(s => s.tipo_costo === 'directo').forEach(row => {
                // 1. Lens cost (from COD LENTE in Pacientes sheet)
                if (row.producto_sku || row.producto_nombre) {
                    const lensSku = norm(row.producto_sku || "");
                    const lensName = norm(row.producto_nombre || "");
                    const b = norm(row.sucursal || "");

                    // Try to find lens cost by SKU or name
                    const lensCost = refMap[`${lensSku}|${b}`]?.costo || refMap[lensSku]?.costo ||
                        refMap[`${lensName}|${b}`]?.costo || refMap[lensName]?.costo || 0;
                    costoLentes += lensCost;
                }

                // 2. Distributed journey cost (indirect costs / number of surgeries)
                const jId = row.jornada_id;
                if (jId && journeyCosts[jId] && journeySurgeryCount[jId] > 0) {
                    const costPerSurgery = journeyCosts[jId] / journeySurgeryCount[jId];
                    costoInsumos += costPerSurgery;
                }
            });

            const honorariosSum = mSurgeries.reduce((s, row) => {
                let h = Number(row.honorarios || 0);
                if (h === 0) {
                    const doc = norm(row.medico || ""); const prc = norm(row.procedimiento || ""); const b = norm(row.sucursal || "");
                    h = refMap[`${doc}|${b}`]?.honorario || refMap[doc]?.honorario || refMap[`${prc}|${b}`]?.honorario || refMap[prc]?.honorario || 0;
                }
                return s + h;
            }, 0);

            // If a doctor filter is active, we NEVER fallback to aggregate expenses (which would include all doctors)
            const honorarios = (honorariosSum > 0 || (filters.medico && filters.medico !== "Todos"))
                ? honorariosSum
                : mExp.filter(e => e.categoria.toUpperCase().includes("HONORARIO")).reduce((acc, e) => acc + e.monto, 0);

            const cato = (cat: string) => mExp.filter(e => {
                const c = e.categoria.toUpperCase();
                return c.includes(cat) || (cat === "RH" && (c.includes("SUELDO") || c.includes("PERSONAL") || c.includes("RRHH"))) ||
                    (cat === "MARKETING" && (c.includes("PUBLI") || c.includes("PROMO"))) ||
                    (cat === "ADMIN" && (c.includes("GESTION") || c.includes("CONTAB") || c.includes("OFICINA") || c.includes("ADMINISTRATIVO")));
            }).reduce((acc, e) => acc + e.monto, 0);

            // Separate RH into Local (branch-specific) and Central (from CONOFTA ADM)
            const rhLocal = mExp.filter(e => {
                const c = e.categoria.toUpperCase();
                const isRH = c.includes("RH") || c.includes("SUELDO") || c.includes("PERSONAL") || c.includes("RRHH");
                const espSuc = norm(e.sucursal || "");
                const isCentral = ["GLOBAL", "TODAS", "CENTRAL", "ADMIN", "ADMINISTRACION", "ADM", "CONOFTA ADM"].includes(espSuc);
                return isRH && !isCentral;
            }).reduce((acc, e) => acc + e.monto, 0);

            const rhCentral = mExp.filter(e => {
                const c = e.categoria.toUpperCase();
                const isRH = c.includes("RH") || c.includes("SUELDO") || c.includes("PERSONAL") || c.includes("RRHH");
                const espSuc = norm(e.sucursal || "");
                const isCentral = ["GLOBAL", "TODAS", "CENTRAL", "ADMIN", "ADMINISTRACION", "ADM", "CONOFTA ADM"].includes(espSuc);
                return isRH && isCentral;
            }).reduce((acc, e) => acc + e.monto, 0);

            const mkt = cato("MARKETING");
            const adm = cato("ADMIN");
            const others = mExp.filter(e => {
                const c = e.categoria.toUpperCase();
                return !c.includes("RH") && !c.includes("MARKETING") && !c.includes("HONORARIO") && !c.includes("ADMIN") &&
                    !c.includes("SUELDO") && !c.includes("PERSONAL") && !c.includes("RRHH") && !c.includes("PUBLI") &&
                    !c.includes("PROMO") && !c.includes("GESTION") && !c.includes("CONTAB") && !c.includes("ADMINISTRATIVO");
            }).reduce((acc, e) => acc + e.monto, 0);

            // Sum targets from ALL branches (not global targets without sucursal)
            const globalTarget = yearTargets
                .filter(t => t.sucursal && (filters.sucursal === "Todas" || norm(t.sucursal) === norm(filters.sucursal))) // Respect branch filter
                .reduce((acc, t) => acc + Number(t[M_LABEL_TO_COL[M_NUM_TO_ABBR[m]]] || 0), 0);

            return {
                mes: M_NUM_TO_ABBR[m], surgeries: normalSurgeries.length + catSurgeries.length, revenue,
                costoLentes, costoInsumos, honorarios, rhLocal, rhCentral, marketing: mkt, otros: others + adm,
                margin: revenue - (costoLentes + costoInsumos + honorarios + rhLocal + rhCentral + mkt + others + adm),
                targetSurgeries: globalTarget
            };
        });

        const activeM = monthNums ? monthlyData.filter((_, i) => monthNums.includes(i + 1)) : monthlyData;
        const totalSums = activeM.reduce((a, b) => ({
            surgeries: a.surgeries + b.surgeries, revenue: a.revenue + b.revenue,
            costoLentes: a.costoLentes + b.costoLentes, costoInsumos: a.costoInsumos + b.costoInsumos,
            honorarios: a.honorarios + b.honorarios, rhLocal: a.rhLocal + b.rhLocal, rhCentral: a.rhCentral + b.rhCentral, marketing: a.marketing + b.marketing, otros: a.otros + b.otros, margin: a.margin + b.margin,
            targetSurgeries: a.targetSurgeries + b.targetSurgeries
        }), { surgeries: 0, revenue: 0, costoLentes: 0, costoInsumos: 0, honorarios: 0, rhLocal: 0, rhCentral: 0, marketing: 0, otros: 0, margin: 0, targetSurgeries: 0 });

        const gauges = allBranches.sort().map(branch => {
            const bSurgs = processedSurg.filter(s => {
                if (norm(s.sucursal) !== norm(branch)) return false;
                if ((s.tipo_costo || 'directo') !== 'directo') return false;
                if (filters.medico && filters.medico !== "Todos" && norm(s.medico || "") !== norm(filters.medico)) return false; // Added medico filter
                const dp = parseDateParts(s.fecha || s.fecha_cirugia);
                if (!dp || dp.y !== cYear || (monthNums && !monthNums.includes(dp.m))) return false;
                return true;
            }).length;

            // Only get targets for THIS specific branch (not global targets)
            const bTarget = yearTargets.filter(t => t.sucursal && norm(t.sucursal) === norm(branch)).reduce((acc, t) => {
                let sum = 0;
                if (monthNums) monthNums.forEach(m => sum += Number(t[M_LABEL_TO_COL[M_NUM_TO_ABBR[m]]] || 0));
                else Object.keys(M_LABEL_TO_COL).forEach(l => sum += Number(t[M_LABEL_TO_COL[l]] || 0));
                return acc + sum;
            }, 0);

            return { name: branch, current: bSurgs, target: bTarget, pct: bTarget > 0 ? (bSurgs / bTarget * 100) : 0 };
        });

        // Use the same gauges for summary (respect filters instead of current month only)
        const summaryGauges = gauges;

        // ── Equipment ROI calculation ────────────────────────
        const totalEquipmentInvestment = equipmentRaw.reduce((s, eq) => s + Number(eq.costo_total || 0), 0);
        const totalSurgeriesDone = totalSums.surgeries;
        const totalRevDone = totalSums.revenue;
        const totalCostDone = totalSums.costoLentes + totalSums.costoInsumos + totalSums.honorarios + totalSums.rhLocal + totalSums.rhCentral + totalSums.marketing + totalSums.otros;
        const avgNetPerSurgery = totalSurgeriesDone > 0 ? (totalRevDone - totalCostDone) / totalSurgeriesDone : 0;
        const surgeriesForPayback = avgNetPerSurgery > 0 ? Math.ceil(totalEquipmentInvestment / avgNetPerSurgery) : 0;
        const monthsForPayback = totalSurgeriesDone > 0 && surgeriesForPayback > 0
            ? Math.ceil(surgeriesForPayback / (totalSurgeriesDone / Math.max(1, activeM.length)))
            : 0;

        return {
            kpis: {
                ...totalSums,
                cumplimiento: totalSums.targetSurgeries > 0 ? (totalSums.surgeries / totalSums.targetSurgeries * 100) : 0,
                grossMarginPct: totalSums.revenue > 0 ? (totalSums.margin / totalSums.revenue * 100) : 0
            },
            monthly: monthlyData, gauges, summaryGauges,
            expensesByCategory: [
                { name: "Lentes", value: totalSums.costoLentes },
                { name: "Insumos", value: totalSums.costoInsumos },
                { name: "Honorarios", value: totalSums.honorarios },
                { name: "Gastos Op.", value: totalSums.rhLocal + totalSums.rhCentral + totalSums.marketing + totalSums.otros }
            ],
            equipmentRoi: {
                totalInvestment: totalEquipmentInvestment,
                avgNetPerSurgery,
                surgeriesForPayback,
                surgeriesDone: totalSurgeriesDone,
                monthsForPayback,
                items: equipmentRaw
            },
            options: {
                sucursales: allBranches.sort(),
                medicos: Array.from(new Set(processedSurg.filter(s => filters.sucursal && filters.sucursal !== "Todas" ? norm(s.sucursal) === norm(filters.sucursal) : true).map(s => s.medico).filter(Boolean))).sort()
            },
            topMedicos: [], topSucursales: []
        };
    }, [targetsRaw, expensesRaw, surgeriesRaw, productCostsRaw, equipmentRaw, filters]);

    return { data, loading, fetchAll: fetchAllData };
}
