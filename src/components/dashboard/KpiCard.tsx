import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  variant?: "gold" | "emerald" | "default";
}

export default function KpiCard({ title, value, change, changeType = "neutral", icon: Icon, variant = "default" }: KpiCardProps) {
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-5 card-hover h-full flex flex-col justify-between",
      variant === "gold" && "gold-glow border-primary/20",
      variant === "emerald" && "emerald-glow border-secondary/20"
    )}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate mr-2">{title}</p>
        <div className={cn(
          "rounded-lg p-1.5 transition-colors",
          variant === "gold" ? "bg-primary/10 text-primary" : variant === "emerald" ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-0.5">
        <p className="text-2xl font-display font-bold text-foreground leading-tight">{value}</p>
        <div className="min-h-[1.25rem]">
          {change && (
            <p className={cn(
              "text-xs font-medium",
              changeType === "positive" && "text-emerald",
              changeType === "negative" && "text-destructive",
              changeType === "neutral" && "text-muted-foreground"
            )}>
              {change}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
