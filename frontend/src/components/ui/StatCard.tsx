import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

type Tone = "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: IconType;
  tone?: Tone;
  hint?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, tone = "accent", hint, className }: StatCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">{value}</p>
          {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

export default StatCard;
