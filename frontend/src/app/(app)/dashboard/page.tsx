"use client";

import { useAppContext } from "@/context/AppContext";
import { TeacherDashboard } from "@/components/dashboards/TeacherDashboard";
import { StudentDashboard } from "@/components/dashboards/StudentDashboard";

export default function DashboardPage() {
  const { userRole } = useAppContext();
  return userRole === "teacher" ? <TeacherDashboard /> : <StudentDashboard />;
}
