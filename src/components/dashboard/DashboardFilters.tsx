import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Filter, ChevronUp, ChevronDown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const months = ["Todos", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface DashboardFiltersProps {
  isGerente: boolean;
  onFiltersChange?: (filters: {
    year: string;
    months: string[];
    lines: string[];
    vendedor: string;
  }) => void;
  hideVendedor?: boolean;
  hideLines?: boolean;
  hideTitle?: boolean;
}

export default function DashboardFilters({ isGerente, onFiltersChange, hideVendedor, hideLines, hideTitle }: DashboardFiltersProps) {
  const [open, setOpen] = useState(true);
  const [years, setYears] = useState<string[]>([new Date().getFullYear().toString()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonths, setSelectedMonths] = useState<string[]>(["Todos"]);
  const [selectedLines, setSelectedLines] = useState<string[]>(["Todas"]);
  const [selectedVendedor, setSelectedVendedor] = useState("Todos");
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [productLines, setProductLines] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      // Fetch distinct years efficiently using oldest + newest
      const [{ data: oldest }, { data: newest }] = await Promise.all([
        supabase.from("sales_details").select("fecha").order("fecha", { ascending: true }).limit(1),
        supabase.from("sales_details").select("fecha").order("fecha", { ascending: false }).limit(1),
      ]);

      if (oldest?.length && newest?.length) {
        const minYear = new Date(oldest[0].fecha).getFullYear();
        const maxYear = new Date(newest[0].fecha).getFullYear();
        const yrs: string[] = [];
        for (let y = maxYear; y >= minYear; y--) yrs.push(String(y));
        setYears(yrs);
        setSelectedYear(yrs[0]);
      }

      // Fetch distinct product lines
      const { data: lineData } = await supabase.from("sales_details").select("linea_de_producto").limit(5000);
      if (lineData) {
        const unique = [...new Set(lineData.map(d => d.linea_de_producto))].filter(Boolean).sort();
        setProductLines(unique);
      }

      if (isGerente) {
        const { data: vendData } = await supabase.from("sales_details").select("vendedor").limit(5000);
        if (vendData) {
          const unique = [...new Set(vendData.map(d => d.vendedor))].filter(Boolean).sort();
          setVendedores(unique);
        }
      }
    };
    init();
  }, [isGerente]);

  useEffect(() => {
    onFiltersChange?.({
      year: selectedYear,
      months: selectedMonths,
      lines: selectedLines,
      vendedor: selectedVendedor,
    });
  }, [selectedMonths, selectedLines, selectedVendedor, selectedYear]);

  const toggleMonth = (m: string) => {
    if (m === "Todos") return setSelectedMonths(["Todos"]);
    const next = selectedMonths.filter((x) => x !== "Todos");
    if (next.includes(m)) {
      const filtered = next.filter((x) => x !== m);
      setSelectedMonths(filtered.length ? filtered : ["Todos"]);
    } else {
      setSelectedMonths([...next, m]);
    }
  };

  const toggleLine = (l: string) => {
    if (l === "Todas") return setSelectedLines(["Todas"]);
    const next = selectedLines.filter((x) => x !== "Todas");
    if (next.includes(l)) {
      const filtered = next.filter((x) => x !== l);
      setSelectedLines(filtered.length ? filtered : ["Todas"]);
    } else {
      setSelectedLines([...next, l]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {!hideTitle && (
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              {isGerente ? "Análisis de Ventas" : "Dashboard de Ventas"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isGerente ? "Vista consolidada" : "Información comercial"} · {selectedYear}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground focus:ring-1 focus:ring-primary outline-none"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Filter className="h-4 w-4" />
            {open ? "Ocultar" : "Filtros"}
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-5 animate-slide-in">
          {isGerente && !hideVendedor && (
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  <Users className="h-3 w-3 inline mr-1" />Vendedor
                </p>
                <select
                  value={selectedVendedor}
                  onChange={(e) => setSelectedVendedor(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none min-w-[180px]"
                >
                  <option>Todos</option>
                  {vendedores.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">🔽 Meses</p>
            <div className="flex flex-wrap gap-2">
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMonth(m)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                    selectedMonths.includes(m)
                      ? "bg-secondary text-secondary-foreground border-secondary"
                      : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {!hideLines && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">⚙️ Líneas de Producto:</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleLine("Todas")}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-medium border transition-colors",
                    selectedLines.includes("Todas")
                      ? "bg-secondary text-secondary-foreground border-secondary"
                      : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground"
                  )}
                >
                  Todas
                </button>
                {productLines.map((l) => (
                  <button
                    key={l}
                    onClick={() => toggleLine(l)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-medium border transition-colors",
                      selectedLines.includes(l)
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
