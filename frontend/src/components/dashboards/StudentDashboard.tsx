"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuDownload, LuFileText, LuTarget, LuTrendingUp, LuZap } from "react-icons/lu";
import { useStudentWorkspace } from "@/hooks/useStudentWorkspace";
import { useStudentOverview } from "@/hooks/useStudentOverview";
import { downloadPaperPDF, formatDate, getAllPapers, triggerPDFDownload } from "@/lib/api";
import type { GeneratedPaper } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StudentSelector } from "@/components/StudentSelector";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState, ProgressBar } from "@/components/ui/Misc";

interface SubjectBreakdown {
  subject: string;
  average_percentage: number;
}

export function StudentDashboard() {
  const router = useRouter();
  const { students, loading: studentLoading, error: studentError, creating, currentStudent, selectStudent, createStudentProfile } =
    useStudentWorkspace();
  const { overview, loading: overviewLoading, error: overviewError } = useStudentOverview(currentStudent?.id);

  const [fallbackPapers, setFallbackPapers] = useState<GeneratedPaper[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState(true);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (currentStudent) {
        if (!ignore) {
          setFallbackLoading(false);
          setFallbackError(null);
        }
        return;
      }
      try {
        setFallbackLoading(true);
        const papers = await getAllPapers();
        if (!ignore) {
          setFallbackPapers(papers);
          setFallbackError(null);
        }
      } catch (err) {
        if (!ignore) {
          setFallbackPapers([]);
          setFallbackError(err instanceof Error ? err.message : "Failed to load papers");
        }
      } finally {
        if (!ignore) setFallbackLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentStudent]);

  const ov = (overview ?? {}) as Record<string, unknown>;
  const availablePapers: GeneratedPaper[] = currentStudent
    ? ((ov.available_papers as GeneratedPaper[]) ?? [])
    : fallbackPapers;
  const performance = (ov.performance as { subject_breakdown?: SubjectBreakdown[] }) ?? {};
  const recommendations = (ov.recommendations as {
    suggested_goal?: string;
    history_feedback?: string;
    priority_topics?: string[];
  }) ?? {};
  const summary = (ov.summary as { average_percentage?: number; exam_count?: number; subjects?: string[] }) ?? {};

  async function handleDownload(paperId: string, title?: string) {
    try {
      const blob = await downloadPaperPDF(paperId);
      triggerPDFDownload(blob, title || "paper");
    } catch {
      alert("Failed to download paper. Please try again.");
    }
  }

  const showLoader =
    (studentLoading && !currentStudent) ||
    (!!currentStudent && overviewLoading) ||
    (!currentStudent && fallbackLoading);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <Card className="relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 blur-3xl"
          style={{ background: "radial-gradient(40% 80% at 90% 0%, var(--accent-soft), transparent)" }}
        />
        <div className="relative">
          <h2 className="text-xl font-semibold tracking-tight text-fg">
            Hello, {currentStudent?.name || "Student"}! Ready to learn today?
          </h2>
          <p className="mt-1 text-sm text-muted">
            {currentStudent
              ? `${availablePapers.length} papers are ready for ${currentStudent.class}`
              : "Your student profile will appear automatically after the first analyzed answer sheet."}
          </p>
        </div>
      </Card>

      <StudentSelector
        students={students}
        loading={studentLoading}
        creating={creating}
        error={studentError}
        currentStudent={currentStudent}
        onSelectStudent={selectStudent}
        onCreateStudent={createStudentProfile}
      />

      {showLoader ? (
        <PageLoader label="Loading your dashboard…" />
      ) : currentStudent && overviewError ? (
        <Alert variant="danger">{overviewError}</Alert>
      ) : !currentStudent && fallbackError ? (
        <Alert variant="danger">{fallbackError}</Alert>
      ) : (
        <>
          {/* Metric tiles */}
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile label="Available papers" value={String(availablePapers.length)} hint={currentStudent ? `Assigned to ${currentStudent.class}` : "Ready to attempt right away"} />
            <MetricTile
              label={currentStudent ? "Average score" : "Student profile"}
              value={currentStudent ? `${summary.average_percentage ?? 0}%` : "Auto"}
              hint={currentStudent ? `Across ${summary.exam_count ?? 0} analyzed exams` : "Created after the first analyzed answer sheet"}
            />
            <MetricTile
              label={currentStudent ? "Target goal" : "Insights"}
              value={currentStudent ? recommendations.suggested_goal || "N/A" : "Soon"}
              hint={currentStudent ? "Suggested from the latest result" : "Unlocks after analysis"}
            />
          </div>

          {/* Available papers */}
          <section>
            <h3 className="mb-3 text-base font-semibold text-fg">Available papers</h3>
            {availablePapers.length === 0 ? (
              <EmptyState icon={LuFileText} title="No papers available yet" description="Check back soon — new papers appear here when published." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {availablePapers.map((paper) => {
                  const id = (paper._id || paper.id) as string;
                  return (
                    <Card key={id} hover className="flex flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="truncate font-semibold text-fg">{paper.title}</h4>
                          <p className="text-sm text-muted">{paper.subject}</p>
                        </div>
                        <Badge variant="success">{currentStudent ? "Available" : paper.class}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-subtle">{formatDate(paper.createdAt ?? (paper.created_at as string))}</p>
                      <p className="text-xs text-subtle">
                        {(paper.totalMarks ?? paper.total_marks) as number} marks · {String(paper.duration ?? "")}
                      </p>
                      <div className="mt-4 flex gap-2">
                        <Button variant="secondary" size="sm" fullWidth onClick={() => handleDownload(id, paper.title)}>
                          <LuDownload className="h-4 w-4" /> PDF
                        </Button>
                        <Button size="sm" fullWidth onClick={() => router.push(`/exam/${id}`)}>
                          <LuFileText className="h-4 w-4" /> Open
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Performance + recommendations (only when a student is selected) */}
          {currentStudent ? (
            <>
              <Card>
                <CardHeader title="Performance summary" action={<Button variant="secondary" size="sm" onClick={() => router.push("/performance")}><LuTrendingUp className="h-4 w-4" /> Details</Button>} />
                <CardBody>
                  {(performance.subject_breakdown ?? []).length === 0 ? (
                    <p className="text-sm text-muted">Upload and analyze an exam to unlock score trends.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-semibold tracking-tight text-fg">{summary.average_percentage ?? 0}%</span>
                        <span className="text-sm text-muted">average</span>
                      </div>
                      <div className="space-y-3">
                        {performance.subject_breakdown!.map((item) => {
                          const pct = Math.min(item.average_percentage || 0, 100);
                          const tone = pct >= 75 ? "success" : pct >= 50 ? "warning" : "danger";
                          return (
                            <div key={item.subject} className="grid grid-cols-[120px_1fr_48px] items-center gap-3">
                              <span className="truncate text-sm text-muted">{item.subject}</span>
                              <ProgressBar value={pct} tone={tone} />
                              <span className="text-right text-sm font-medium text-fg">{item.average_percentage}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><LuTarget className="h-5 w-5" /></span>
                  <h3 className="text-base font-semibold text-fg">AI recommendations</h3>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {recommendations.history_feedback || "Analyze a recent exam to get personalized next steps."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => router.push("/quiz")}><LuZap className="h-4 w-4" /> Revision quiz</Button>
                  <Button variant="secondary" onClick={() => router.push("/recommendations")}><LuTarget className="h-4 w-4" /> View plan</Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(recommendations.priority_topics ?? []).length === 0 ? (
                    <Badge>No focus topics yet</Badge>
                  ) : (
                    recommendations.priority_topics!.slice(0, 4).map((topic) => (
                      <Badge key={topic} variant="warning">{topic}</Badge>
                    ))
                  )}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><LuTarget className="h-5 w-5" /></span>
                <h3 className="text-base font-semibold text-fg">What happens next</h3>
              </div>
              <p className="mt-3 text-sm text-muted">
                Once you upload an answer sheet and it gets analyzed, we extract the student details automatically
                and unlock performance trends, recommendations, and revision quizzes.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MetricTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </Card>
  );
}

export default StudentDashboard;
