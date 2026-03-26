import { cn } from "@/lib/utils";

interface MetaAcceleratorProps {
  cumplimiento: number;
  metaTotal: string;
  ventaActual: string;
  unitsFaltantes?: number;
  label?: string;
  compact?: boolean;
}

export default function MetaAccelerator({ cumplimiento, metaTotal, ventaActual, unitsFaltantes, label, compact }: MetaAcceleratorProps) {
  const angle = Math.min(cumplimiento, 150) * 1.2;
  const getColor = () => {
    if (cumplimiento <= 0) return "text-muted-foreground";
    if (cumplimiento >= 100) return "text-emerald";
    if (cumplimiento >= 85) return "text-primary";
    return "text-destructive";
  };
  const getStrokeColor = () => {
    if (cumplimiento <= 0) return "hsl(0, 0%, 30%)"; // Gray/Muted
    if (cumplimiento >= 100) return "hsl(142, 71%, 45%)"; // Green
    if (cumplimiento >= 85) return "hsl(45, 90%, 55%)"; // Yellow/Gold
    return "hsl(0, 72%, 50%)"; // Red
  };

  if (compact) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center truncate w-full">{label}</p>
        <div className="relative w-24 h-12 mb-1">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="hsl(0, 0%, 18%)" strokeWidth="14" strokeLinecap="round" />
            <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke={getStrokeColor()} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(angle / 180) * 251.3} 251.3`} className="transition-all duration-1000" />
            <line x1="100" y1="90" x2={100 + 55 * Math.cos(((180 - angle) * Math.PI) / 180)} y2={90 - 55 * Math.sin(((180 - angle) * Math.PI) / 180)} stroke="hsl(0, 0%, 95%)" strokeWidth="2" strokeLinecap="round" className="transition-all duration-1000" />
            <circle cx="100" cy="90" r="4" fill={getStrokeColor()} />
          </svg>
        </div>
        <p className="text-lg font-display font-bold transition-colors duration-1000" style={{ color: getStrokeColor() }}>
          {cumplimiento}%
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 w-full text-center">
          <div>
            <p className="text-[9px] text-muted-foreground">Meta</p>
            <p className="text-[10px] font-semibold text-foreground">{metaTotal}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground">Actual</p>
            <p className="text-[10px] font-semibold text-foreground">{ventaActual}</p>
          </div>
        </div>
        {unitsFaltantes !== undefined && unitsFaltantes > 0 && (
          <div className="mt-2 pt-2 border-t border-border w-full text-center">
            <p className="text-[9px] text-muted-foreground">Faltan p/ Meta</p>
            <p className="text-[10px] font-bold text-primary">{unitsFaltantes} u.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center">
      <h3 className="text-sm font-display font-semibold text-foreground mb-6">{label || "Acelerómetro de Meta"}</h3>
      <div className="relative w-48 h-24 mb-4">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="hsl(0, 0%, 18%)" strokeWidth="12" strokeLinecap="round" />
          <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke={getStrokeColor()} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(angle / 180) * 251.3} 251.3`} className="transition-all duration-1000" />
          <line x1="100" y1="90" x2={100 + 60 * Math.cos(((180 - angle) * Math.PI) / 180)} y2={90 - 60 * Math.sin(((180 - angle) * Math.PI) / 180)} stroke="hsl(0, 0%, 95%)" strokeWidth="2" strokeLinecap="round" className="transition-all duration-1000" />
          <circle cx="100" cy="90" r="4" fill={getStrokeColor()} />
        </svg>
      </div>
      <p className="text-3xl font-display font-bold transition-colors duration-1000" style={{ color: getStrokeColor() }}>
        {cumplimiento}%
      </p>
      <p className="text-xs text-muted-foreground mt-1">Cumplimiento</p>
      <div className="mt-4 grid grid-cols-2 gap-4 w-full text-center">
        <div>
          <p className="text-xs text-muted-foreground">Meta</p>
          <p className="text-sm font-semibold text-foreground">{metaTotal}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Actual</p>
          <p className="text-sm font-semibold text-foreground">{ventaActual}</p>
        </div>
      </div>

      {unitsFaltantes !== undefined && unitsFaltantes > 0 && (
        <div className="mt-4 pt-4 border-t border-border w-full text-center">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Unidades Faltantes para Meta</p>
          <p className="text-2xl font-display font-bold text-primary">{unitsFaltantes.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">unidades</span></p>
        </div>
      )}
    </div>
  );
}
