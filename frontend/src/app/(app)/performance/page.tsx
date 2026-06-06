"use client";

import { LuTrendingUp, LuActivity, LuAward } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useStudentWorkspace } from "@/hooks/useStudentWorkspace";
import { useStudentOverview } from "@/hooks/useStudentOverview";
import { formatDate } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { StudentSelector } from "@/components/StudentSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";

interface SubjectBreakdownEntry {
  subject: string;
  exam_count?: number;
  average_percentage?: number;
  latest_percentage?: number | null;
}

interface RecentScoreEntry {
  exam_id: string;
  subject: string;
  exam_type?: string;
  exam_date?: string;
  percentage?: number | null;
}

interface ChapterEntry {
  chapter_name: string;
}

export default function PerformancePage() {
  const { userRole } = useAppContext();
  const {
    students,
    loading: studentLoading,
    error: studentError,
    creating,
    currentStudent,
    selectStudent,
    createStudentProfile,
  } = useStudentWorkspace();
  const { overview, loading: overviewLoading, error: overviewError } = useStudentOverview(currentStudent?.id);

  if (userRole !== "student") {
    return (
      <div>
        <PageHeader title="Performance" description="Review performance history and score trends." />
        <EmptyState
          icon={LuTrendingUp}
          title="Student access only"
          description="Switch to student mode to review performance history and score trends."
        />
      </div>
    );
  }

  const ov = (overview ?? {}) as Record<string, unknown>;
  const summary = (ov.summary as {
    average_percentage?: number;
    exam_count?: number;
    latest_percentage?: number | null;
    improvement_from_previous?: number | null;
  }) ?? {};
  const performance = (ov.performance as {
    subject_breakdown?: SubjectBreakdownEntry[];
    recent_scores?: RecentScoreEntry[];
    strongest_subject?: { subject?: string; average_percentage?: number };
  }) ?? {};
  const latestExam = ov.latest_exam as
    | { strong_chapters?: ChapterEntry[]; weak_chapters?: ChapterEntry[] }
    | undefined;
  const strongestSubject = performance.strongest_subject;

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Track average scores, subject-wise performance, and recent exam progress for the active student."
      />

      <div className="space-y-6">
        <StudentSelector
          students={students}
          loading={studentLoading}
          creating={creating}
          error={studentError}
          currentStudent={currentStudent}
          onSelectStudent={selectStudent}
          onCreateStudent={createStudentProfile}
        />

        {studentLoading && !currentStudent ? (
          <PageLoader label="Loading student profiles…" />
        ) : overviewLoading ? (
          <PageLoader label="Loading performance insights…" />
        ) : overviewError ? (
          <Alert variant="danger">{overviewError}</Alert>
        ) : !currentStudent ? (
          <EmptyState
            icon={LuTrendingUp}
            title="No active student yet"
            description="Your student profile appears automatically after the first analyzed answer sheet. Performance insights will unlock after that analysis is saved."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Average score"
                value={`${summary.average_percentage || 0}%`}
                icon={LuTrendingUp}
                tone="accent"
                hint={`Across ${summary.exam_count || 0} analyzed exams`}
              />
              <StatCard
                title="Latest exam"
                value={`${summary.latest_percentage ?? "N/A"}%`}
                icon={LuActivity}
                tone="info"
                hint={`Improvement: ${summary.improvement_from_previous ?? 0} points`}
              />
              <StatCard
                title="Strongest subject"
                value={strongestSubject?.subject || "N/A"}
                icon={LuAward}
                tone="success"
                hint={`${strongestSubject?.average_percentage ?? 0}% average`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Subject breakdown" />
                {(performance.subject_breakdown || []).length === 0 ? (
                  <CardBody>
                    <p className="text-sm text-muted">No subject performance data yet.</p>
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
                        {performance.subject_breakdown!.map((entry) => (
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
                <CardHeader title="Recent score trend" />
                <CardBody className="space-y-2">
                  {(performance.recent_scores || []).length === 0 ? (
                    <p className="text-sm text-muted">Recent score history will appear here.</p>
                  ) : (
                    performance.recent_scores!.map((entry) => (
                      <div
                        key={entry.exam_id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-3"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-fg">
                            {entry.subject} | {entry.exam_type}
                          </span>
                          <span className="block truncate text-xs text-muted">{formatDate(entry.exam_date)}</span>
                        </div>
                        <Badge variant="info">{entry.percentage ?? 0}%</Badge>
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader title="Latest exam snapshot" />
              <CardBody>
                {!latestExam ? (
                  <p className="text-sm text-muted">Upload and analyze an exam to unlock topic-level snapshots.</p>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-subtle">Strong topics</span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(latestExam.strong_chapters || []).length === 0 ? (
                          <Badge>No strong topics recorded yet</Badge>
                        ) : (
                          latestExam.strong_chapters!.map((chapter) => (
                            <Badge key={chapter.chapter_name} variant="success">
                              {chapter.chapter_name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-subtle">Weak topics</span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(latestExam.weak_chapters || []).length === 0 ? (
                          <Badge>No weak topics recorded yet</Badge>
                        ) : (
                          latestExam.weak_chapters!.map((chapter) => (
                            <Badge key={chapter.chapter_name} variant="warning">
                              {chapter.chapter_name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
