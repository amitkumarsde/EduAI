"use client";

import { useEffect, useState } from "react";
import { LuGrid3X3 } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useStudentWorkspace } from "@/hooks/useStudentWorkspace";
import { getStudentHeatmap } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StudentSelector } from "@/components/StudentSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";
import type { HeatmapData } from "@/lib/types";

function masteryColor(mastery: number): string {
  if (mastery >= 80) return "bg-success text-white";
  if (mastery >= 60) return "bg-success-soft text-success";
  if (mastery >= 40) return "bg-warning-soft text-warning";
  if (mastery >= 20) return "bg-danger-soft text-danger";
  return "bg-danger text-white";
}

export default function HeatmapPage() {
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

  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentId = currentStudent?.id;
  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (!studentId) {
        if (!ignore) setData(null);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const d = await getStudentHeatmap(studentId);
        if (!ignore) setData(d);
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e.message : "Failed to load heat map");
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
        <PageHeader title="Weakness Heat Map" description="Topic-level mastery at a glance." />
        <EmptyState icon={LuGrid3X3} title="Student access only" description="Switch to student mode to view the heat map." />
      </div>
    );
  }

  const subjects = data?.subjects ?? [];

  return (
    <div>
      <PageHeader
        title="Weakness Heat Map"
        description="Chapter-level mastery from analyzed exams and topic health. Red cells need attention first."
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
          <EmptyState icon={LuGrid3X3} title="No student selected" description="Select a student to view their heat map." />
        ) : loading ? (
          <PageLoader label="Building heat map…" />
        ) : error ? (
          <Alert variant="danger">{error}</Alert>
        ) : subjects.length === 0 ? (
          <EmptyState
            icon={LuGrid3X3}
            title="No topic data yet"
            description="The heat map appears once analyzed exams and topic health are recorded for this student."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
              <span>Mastery:</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-danger" /> 0–20</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-danger-soft" /> 20–40</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-warning-soft" /> 40–60</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-success-soft" /> 60–80</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-success" /> 80–100</span>
            </div>

            {subjects.map((subject) => (
              <Card key={subject.subject}>
                <CardHeader
                  title={subject.subject}
                  subtitle={`Overall mastery ${subject.mastery}% · ${subject.exam_count} exam${subject.exam_count === 1 ? "" : "s"}${subject.average_percentage != null ? ` · avg ${subject.average_percentage}%` : ""}`}
                  action={<Badge variant={subject.mastery >= 60 ? "success" : subject.mastery >= 40 ? "warning" : "danger"}>{subject.mastery}%</Badge>}
                />
                <CardBody>
                  {subject.chapters.length === 0 ? (
                    <p className="text-sm text-muted">No chapter-level data for this subject yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {subject.chapters.map((chapter) => (
                        <div
                          key={chapter.chapter_name}
                          className={`flex flex-col gap-1 rounded-lg p-3 ${masteryColor(chapter.mastery)}`}
                          title={`${chapter.clear} clear · ${chapter.partial} partial · ${chapter.gaps} gaps`}
                        >
                          <span className="truncate text-sm font-medium">{chapter.chapter_name}</span>
                          <span className="text-lg font-semibold">{chapter.mastery}%</span>
                          <span className="text-[11px] opacity-80">
                            {chapter.clear}✓ · {chapter.partial}~ · {chapter.gaps}✗
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
