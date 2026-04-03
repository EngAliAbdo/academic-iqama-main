import { cn } from "@/lib/utils";

type BadgeVariant = "draft" | "published" | "submitted" | "review" | "revision" | "graded" | "accepted" | "rejected" | "flagged" | "closed" | "due-soon";

const variantStyles: Record<BadgeVariant, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-primary/10 text-primary",
  submitted: "bg-info/10 text-info",
  review: "bg-warning/10 text-warning",
  revision: "bg-warning/15 text-warning",
  graded: "bg-success/10 text-success",
  accepted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  flagged: "bg-destructive/10 text-destructive",
  closed: "bg-muted text-muted-foreground",
  "due-soon": "bg-warning/10 text-warning",
};

const variantLabels: Record<BadgeVariant, string> = {
  draft: "مسودة",
  published: "منشور",
  submitted: "تم الرفع",
  review: "قيد المراجعة",
  revision: "يحتاج تعديل",
  graded: "تم التقييم",
  accepted: "مقبول",
  rejected: "مرفوض",
  flagged: "مشتبه",
  closed: "مغلق",
  "due-soon": "قريب الموعد",
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
      variantStyles[variant],
      className
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        variant === "accepted" || variant === "graded" ? "bg-success" :
        variant === "rejected" || variant === "flagged" ? "bg-destructive" :
        variant === "review" || variant === "revision" || variant === "due-soon" ? "bg-warning" :
        variant === "submitted" || variant === "published" ? "bg-primary" :
        "bg-muted-foreground"
      )} />
      {label || variantLabels[variant]}
    </span>
  );
}
