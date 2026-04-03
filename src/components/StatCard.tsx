import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, className, onClick, active = false }: StatCardProps) {
  const interactive = typeof onClick === "function";
  const Component = interactive ? "button" : "div";

  return (
    <Component
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl p-6 shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5",
        interactive && "w-full cursor-pointer text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        active && "ring-2 ring-primary/50",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-h2 font-bold tabular-nums mt-1">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs mt-2 font-medium",
              trend.positive ? "text-success" : "text-destructive"
            )}>
              {trend.value}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-primary/10 p-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </Component>
  );
}
