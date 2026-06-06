"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { PageLoader } from "@/components/ui/Spinner";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, authLoading, userRole } = useAppContext();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return <PageLoader label="Loading EduAI…" />;
  }

  return (
    <div className="min-h-screen">
      <Navbar onToggleSidebar={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} />
      <Sidebar role={userRole} open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-overlay md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <main className="pt-16 md:pl-64">
        <div className="mx-auto max-w-6xl animate-fade-in px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
