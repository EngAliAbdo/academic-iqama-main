import { cn } from "@/lib/utils";

interface OriginalityGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function OriginalityGauge({ score, size = "md", className }: OriginalityGaugeProps) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-success";
    if (s >= 50) return "text-warning";
    return "text-destructive";
  };

  const getLabel = (s: number) => {
    if (s >= 80) return "أصالة مرتفعة";
    if (s >= 50) return "أصالة متوسطة";
    return "أصالة منخفضة";
  };

  const sizeMap = { sm: 80, md: 120, lg: 160 };
  const dim = sizeMap[size];
  const strokeWidth = size === "sm" ? 6 : 8;
  const radius = (dim - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn("transition-all duration-700", getColor(score))}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold tabular-nums", size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-3xl")}>
            {score}%
          </span>
        </div>
      </div>
      <span className={cn("text-xs font-medium", getColor(score))}>{getLabel(score)}</span>
    </div>
  );
}
