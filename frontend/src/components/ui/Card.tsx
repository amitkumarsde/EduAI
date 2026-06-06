import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-default bg-surface",
        "shadow-[var(--shadow-sm)]",
        hover && "transition-all duration-200 hover:border-border-strong hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border-default px-5 py-4", className)}>
      <div className="min-w-0">
        {title && <h3 className="text-base font-semibold text-fg">{title}</h3>}
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  );
}

export default Card;
