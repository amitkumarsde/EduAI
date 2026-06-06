"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LuLogOut, LuMenu, LuX } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { Logo } from "./Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/ui/Misc";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export function Navbar({
  onToggleSidebar,
  sidebarOpen,
}: {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}) {
  const { user, userRole, logout } = useAppContext();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = user?.profile?.display_name || user?.name || "User";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border-default bg-bg/80 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle sidebar"
            onClick={onToggleSidebar}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border-default text-fg md:hidden"
          >
            {sidebarOpen ? <LuX className="h-5 w-5" /> : <LuMenu className="h-5 w-5" />}
          </button>
          <Logo href="/dashboard" />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-default px-2 py-1.5 transition-colors hover:bg-surface-2"
            >
              <Avatar name={displayName} color={user?.profile?.avatar_color} size={28} />
              <span className="hidden text-sm font-medium text-fg sm:block">{displayName}</span>
              <Badge variant={userRole === "teacher" ? "accent" : "info"} className="hidden capitalize sm:inline-flex">
                {userRole}
              </Badge>
            </button>

            {menuOpen && (
              <div className={cn("absolute right-0 mt-2 w-48 rounded-xl border border-border-default bg-surface p-1.5 shadow-[var(--shadow-lg)]")}>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg"
                >
                  <Avatar name={displayName} color={user?.profile?.avatar_color} size={20} />
                  My profile
                </Link>
                <button
                  type="button"
                  onMouseDown={handleLogout}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft"
                >
                  <LuLogOut className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
