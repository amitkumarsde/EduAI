"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import {
  LuLayoutDashboard,
  LuFileText,
  LuBookOpen,
  LuUsers,
  LuChartBar,
  LuTrendingUp,
  LuZap,
  LuTrophy,
  LuMessageCircle,
  LuTriangleAlert,
  LuBrain,
  LuCircleUser,
  LuHistory,
  LuWifiOff,
  LuBuilding2,
  LuGrid3X3,
  LuPenLine,
  LuSearch,
} from "react-icons/lu";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: IconType;
  href: string;
}

const TEACHER_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LuLayoutDashboard, href: "/dashboard" },
  { label: "Generate Paper", icon: LuFileText, href: "/generate-paper" },
  { label: "My Exams", icon: LuBookOpen, href: "/my-exams" },
  { label: "Institute Exams", icon: LuBuilding2, href: "/institute" },
  { label: "Students", icon: LuUsers, href: "/students" },
  { label: "Analytics", icon: LuChartBar, href: "/analytics" },
  { label: "Essay Grader", icon: LuPenLine, href: "/grading" },
  { label: "Leaderboard", icon: LuTrophy, href: "/leaderboard" },
  { label: "Profile", icon: LuCircleUser, href: "/profile" },
];

const STUDENT_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LuLayoutDashboard, href: "/dashboard" },
  { label: "My Exams", icon: LuBookOpen, href: "/my-exams" },
  { label: "Quiz", icon: LuFileText, href: "/quiz" },
  { label: "Quiz History", icon: LuHistory, href: "/quiz-history" },
  { label: "Offline Mode", icon: LuWifiOff, href: "/offline" },
  { label: "Adaptive Exam", icon: LuBrain, href: "/adaptive" },
  { label: "Find Exams", icon: LuSearch, href: "/exams" },
  { label: "AI Tutor", icon: LuMessageCircle, href: "/tutor" },
  { label: "Performance", icon: LuTrendingUp, href: "/performance" },
  { label: "Heat Map", icon: LuGrid3X3, href: "/heatmap" },
  { label: "Insights", icon: LuTriangleAlert, href: "/insights" },
  { label: "Recommendations", icon: LuZap, href: "/recommendations" },
  { label: "Leaderboard", icon: LuTrophy, href: "/leaderboard" },
  { label: "Profile", icon: LuCircleUser, href: "/profile" },
];

export function Sidebar({
  role,
  open,
  onNavigate,
}: {
  role: UserRole;
  open?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = role === "teacher" ? TEACHER_ITEMS : STUDENT_ITEMS;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 border-r border-border-default bg-surface pt-16 transition-transform duration-200 md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-3">
        <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-subtle">
          {role === "teacher" ? "Teacher" : "Student"}
        </p>
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
