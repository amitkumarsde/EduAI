import type { IconType } from "react-icons";
import type { ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

/* ---------------- EmptyState ---------------- */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: IconType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-subtle">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- ProgressBar ---------------- */
export function ProgressBar({
  value,
  tone = "accent",
  className,
}: {
  value: number;
  tone?: "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({
  name,
  color,
  size = 40,
  className,
}: {
  name?: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: color || "var(--accent)", fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

/* ---------------- Alert ---------------- */
export function Alert({
  variant = "info",
  children,
  className,
}: {
  variant?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const variants = {
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <div className={cn("rounded-lg px-4 py-3 text-sm", variants[variant], className)} role="alert">
      {children}
    </div>
  );
}
