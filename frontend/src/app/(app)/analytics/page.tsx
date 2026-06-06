"use client";

import { useEffect, useState } from "react";
import { LuFileText, LuUsers, LuTrendingUp, LuChartBar } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { formatDate, getTeacherAnalytics } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState, ProgressBar } from "@/components/ui/Misc";

/** Analytics response shape as the backend returns it (loosely typed). */
interface CountEntry {
  label: string;
  count: number;
}

interface PerformanceEntry {
  subject: string;
  exam_count: number;
  average_percentage: number;
  latest_percentage?: number | null;
}

interface TopStudent {
  id: string;
  name: string;
  class?: string;
  exam_count: number;
  average_percentage: number;
}

interface ActivityEntry {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  type: string;
}

interface AnalyticsShape {
  summary?: {
    total_papers?: number;
    pdf_papers?: number;
    total_students?: number;
    analyzed_exams?: number;
    average_score?: number;
  };
  papers_by_subject?: CountEntry[];
  papers_by_class?: CountEntry[];
  performance_by_subject?: PerformanceEntry[];
  recent_activity?: ActivityEntry[];
  top_students?: TopStudent[];
}

export default function AnalyticsPage() {
  const { userRole } = useAppContext();
  const [analytics, setAnalytics] = useState<AnalyticsShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (userRole !== "teacher") {
        setAnalytics(null);
        setLoading(false);
        setError(null);
        return;
      }
      try {
        setLoading(true);
        const analyticsData = (await getTeacherAnalytics()) as unknown as AnalyticsShape;
        setAnalytics(analyticsData);
        setError(null);
      } catch (fetchError) {
        console.error("Error fetching analytics:", fetchError);
        setAnalytics(null);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [userRole]);

  if (userRole !== "teacher") {
    return (
      <div>
        <PageHeader title="Analytics" description="Review class analytics and student trends." />
        <EmptyState
          icon={LuChartBar}
          title="Teacher access only"
          description="Switch to teacher mode to view class analytics and student trends."
        />
      </div>
    );
  }

  const summary = analytics?.summary || {};
  const papersBySubject = analytics?.papers_by_subject || [];
  const papersByClass = analytics?.papers_by_class || [];
  const performanceBySubject = analytics?.performance_by_subject || [];
  const recentActivity = analytics?.recent_activity || [];
  const topStudents = analytics?.top_students || [];

  const maxSubjectCount = Math.max(1, ...papersBySubject.map((e) => e.count));
  const maxClassCount = Math.max(1, ...papersByClass.map((e) => e.count));

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Review paper volume, subject coverage, recent activity, and student performance from one place."
      />

      {loading ? (
        <PageLoader label="Loading analytics…" />
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Generated papers"
              value={summary.total_papers ?? 0}
              icon={LuFileText}
              tone="accent"
              hint={`${summary.pdf_papers ?? 0} PDF papers ready for download and checking`}
            />
            <StatCard
              title="Students"
              value={summary.total_students ?? 0}
              icon={LuUsers}
              tone="info"
              hint={`${summary.analyzed_exams ?? 0} analyzed exams available`}
            />
            <StatCard
              title="Average score"
              value={`${summary.average_score ?? 0}%`}
              icon={LuTrendingUp}
              tone="success"
              hint="Based on submitted and analyzed student exams"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Papers by subject" subtitle="Generated exam papers" />
              <CardBody>
                {papersBySubject.length === 0 ? (
                  <p className="text-sm text-muted">No generated papers yet.</p>
                ) : (
                  <div className="space-y-4">
                    {papersBySubject.map((entry) => (
                      <div key={entry.label}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="font-medium text-fg">{entry.label}</span>
                          <span className="text-muted">{entry.count}</span>
                        </div>
                        <ProgressBar value={(entry.count / maxSubjectCount) * 100} tone="accent" />
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Papers by class" subtitle="Assigned paper count" />
              <CardBody>
                {papersByClass.length === 0 ? (
                  <p className="text-sm text-muted">No class distribution available yet.</p>
                ) : (
                  <div className="space-y-4">
                    {papersByClass.map((entry) => (
                      <div key={entry.label}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="font-medium text-fg">{entry.label}</span>
                          <span className="text-muted">{entry.count}</span>
                        </div>
                        <ProgressBar value={(entry.count / maxClassCount) * 100} tone="success" />
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Performance by subject" />
              {performanceBySubject.length === 0 ? (
                <CardBody>
                  <p className="text-sm text-muted">
                    Student performance will appear here after exam analysis.
                  </p>
                </CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-default text-left text-xs uppercase tracking-wider text-subtle">
                        <th className="px-5 py-3 font-medium">Subject</th>
                        <th className="px-5 py-3 font-medium">Exams</th>
                        <th className="px-5 py-3 font-medium">Average</th>
                        <th className="px-5 py-3 font-medium">Latest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default">
                      {performanceBySubject.map((entry) => (
                        <tr key={entry.subject} className="transition-colors hover:bg-surface-2">
                          <td className="px-5 py-3 font-medium text-fg">{entry.subject}</td>
                          <td className="px-5 py-3 text-muted">{entry.exam_count}</td>
                          <td className="px-5 py-3 text-muted">{entry.average_percentage}%</td>
                          <td className="px-5 py-3 text-muted">{entry.latest_percentage ?? "N/A"}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Top students" subtitle="Highest average performers" />
              <CardBody className="space-y-2">
                {topStudents.length === 0 ? (
                  <p className="text-sm text-muted">No analyzed student results yet.</p>
                ) : (
                  topStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-3"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">
                          {student.name} · {student.class}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {student.exam_count} analyzed exams
                        </span>
                      </div>
                      <Badge variant="success">{student.average_percentage}% avg</Badge>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Recent activity" subtitle="Latest papers and analyzed exams" />
            <CardBody className="space-y-2">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted">No recent activity to show.</p>
              ) : (
                recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-3"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{activity.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {activity.subtitle} · {formatDate(activity.timestamp)}
                      </span>
                    </div>
                    <Badge variant={activity.type === "paper" ? "accent" : "info"}>{activity.type}</Badge>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
