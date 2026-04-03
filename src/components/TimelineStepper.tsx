import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  label: string;
  date?: string;
  completed: boolean;
  active?: boolean;
}

interface TimelineStepperProps {
  steps: Step[];
  className?: string;
}

export function TimelineStepper({ steps, className }: TimelineStepperProps) {
  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
              step.completed ? "border-success bg-success" :
              step.active ? "border-primary bg-primary" :
              "border-border bg-card"
            )}>
              {step.completed ? (
                <Check className="h-4 w-4 text-success-foreground" />
              ) : (
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  step.active ? "bg-primary-foreground" : "bg-muted-foreground/30"
                )} />
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "w-0.5 h-8",
                step.completed ? "bg-success" : "bg-border"
              )} />
            )}
          </div>
          <div className="pt-1">
            <p className={cn(
              "text-sm font-medium",
              step.active ? "text-primary" : step.completed ? "text-foreground" : "text-muted-foreground"
            )}>
              {step.label}
            </p>
            {step.date && (
              <p className="text-xs text-muted-foreground mt-0.5">{step.date}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
