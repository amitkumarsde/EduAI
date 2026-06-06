"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LuArrowLeft, LuSparkles } from "react-icons/lu";
import Link from "next/link";
import { useAppContext } from "@/context/AppContext";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageLoader } from "@/components/ui/Spinner";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, authLoading } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace("/dashboard");
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isAuthenticated) {
    return <PageLoader label="Loading EduAI…" />;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
            >
              <LuArrowLeft className="h-4 w-4" /> Home
            </Link>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* Brand side */}
      <div className="relative hidden overflow-hidden border-l border-border-default bg-surface lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50 blur-3xl"
          style={{ background: "radial-gradient(50% 50% at 70% 20%, var(--accent-soft), transparent)" }}
        />
        <div className="relative flex h-full flex-col justify-center px-14">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border-default bg-bg px-3 py-1 text-xs font-medium text-muted">
            <LuSparkles className="h-3.5 w-3.5 text-accent" /> AI quiz & analytics
          </span>
          <h2 className="mt-6 max-w-md text-4xl font-semibold tracking-tight text-fg">
            Turn every exam into actionable insight.
          </h2>
          <p className="mt-4 max-w-md text-muted">
            Generate quizzes, analyze performance, predict risks, and deliver personalized
            learning paths — for learners and schools alike.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-muted">
            {["AI paper generation & grading", "Adaptive exams and 24/7 tutor", "Predictive insights & leaderboards"].map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
