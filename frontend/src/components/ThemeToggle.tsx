"use client";

import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className={cn(
        "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border-default",
        "text-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      {theme === "light" ? <FiMoon className="h-[18px] w-[18px]" /> : <FiSun className="h-[18px] w-[18px]" />}
    </button>
  );
}

export default ThemeToggle;
