"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LuHistory, LuPlay, LuCircleCheck } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useStudentWorkspace } from "@/hooks/useStudentWorkspace";
import { getQuizAttempts } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { StudentSelector } from "@/components/StudentSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState, ProgressBar } from "@/components/ui/Misc";
import { formatDate } from "@/lib/api";
import type { QuizAttempt } from "@/lib/types";

function scoreTone(percentage: number): "success" | "warning" | "danger" {
  if (percentage >= 75) return "success";
  if (percentage >= 50) return "warning";
  return "danger";
}

export default function QuizHistoryPage() {
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

  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentId = currentStudent?.id;
  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (!studentId) {
        if (!ignore) setAttempts([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await getQuizAttempts({ student_id: studentId });
        if (!ignore) setAttempts(data);
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [studentId]);

  if (userRole !== "student") {
    return (
      <div>
        <PageHeader title="Quiz History" description="Your saved practice attempts." />
        <EmptyState
          icon={LuHistory}
          title="Student access only"
          description="Switch to student mode to view saved quiz attempts."
        />
      </div>
    );
  }

  const paused = attempts.filter((a) => a.status === "paused");
  const completed = attempts.filter((a) => a.status === "completed");

  return (
    <div>
      <PageHeader
        title="Quiz History"
        description="Every practice and offline quiz you save lands here. Resume paused sessions or review past scores."
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
        ) : !currentStudent ? (
          <EmptyState icon={LuHistory} title="No student selected" description="Select a student to see their quiz history." />
        ) : loading ? (
          <PageLoader label="Loading quiz history…" />
        ) : error ? (
          <Alert variant="danger">{error}</Alert>
        ) : attempts.length === 0 ? (
          <EmptyState
            icon={LuHistory}
            title="No attempts yet"
            description="Generate a practice quiz and use “Finish & save” to start building your history."
            action={
              <Link href="/quiz">
                <Button>Take a quiz</Button>
              </Link>
            }
          />
        ) : (
          <>
            {paused.length > 0 && (
              <Card>
                <CardBody className="space-y-3">
                  <h3 className="text-sm font-semibold text-fg">Resume where you left off</h3>
                  {paused.map((attempt) => (
                    <div
                      key={attempt._id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">
                          {attempt.title || "Practice Quiz"}
                        </p>
                        <p className="text-xs text-muted">
                          {attempt.subject} · {attempt.responses?.filter((r) => r.selected_option).length ?? 0}/
                          {attempt.total_questions} answered · {formatDate(attempt.createdAt)}
                        </p>
                      </div>
                      <Link href={`/quiz?resume=${attempt._id}`}>
                        <Button size="sm" variant="secondary">
                          <LuPlay className="h-4 w-4" /> Resume
                        </Button>
                      </Link>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

            <Card>
              <CardBody className="space-y-3">
                <h3 className="text-sm font-semibold text-fg">Completed attempts</h3>
                {completed.length === 0 ? (
                  <p className="text-sm text-muted">No completed attempts yet.</p>
                ) : (
                  completed.map((attempt) => {
                    const pct = attempt.percentage ?? 0;
                    return (
                      <div
                        key={attempt._id}
                        className="rounded-lg border border-border-default px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate text-sm font-medium text-fg">
                              <LuCircleCheck className="h-4 w-4 shrink-0 text-success" />
                              {attempt.title || "Practice Quiz"}
                            </p>
                            <p className="text-xs text-muted">
                              {attempt.subject} · {attempt.difficulty}
                              {attempt.synced_from_offline ? " · synced offline" : ""} ·{" "}
                              {formatDate(attempt.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={scoreTone(pct)}>{pct}%</Badge>
                            <span className="text-xs text-muted">
                              {attempt.correct_count}/{attempt.total_questions}
                            </span>
                          </div>
                        </div>
                        <ProgressBar value={pct} tone={scoreTone(pct)} className="mt-3" />
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
