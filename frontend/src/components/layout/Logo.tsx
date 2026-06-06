import Link from "next/link";
import { LuGraduationCap } from "react-icons/lu";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
        <LuGraduationCap className="h-5 w-5" />
      </span>
      <span className="text-lg tracking-tight text-fg">
        Edu<span className="text-accent">AI</span>
      </span>
    </Link>
  );
}

export default Logo;
