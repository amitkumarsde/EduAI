"use client";

import { useEffect, useState } from "react";
import { LuUsers, LuGraduationCap } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { formatDate, getStudentOverview, getStudents } from "@/lib/api";
import type { Student } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";
import { cn } from "@/lib/utils";

/** Roster row shape returned by the backend (loosely typed on Student). */
type RosterStudent = Student & {
  exam_count?: number;
  latest_exam?: unknown;
  average_percentage?: number;
};

interface StudentOverviewShape {
  summary: {
    average_percentage?: number;
    available_papers_count?: number;
  };
  latest_exam?: {
    subject?: string;
    exam_type?: string;
    exam_date?: string;
    scored_marks?: number;
    total_marks?: number;
    percentage?: number;
  } | null;
  recommendations: {
    priority_topics?: string[];
  };
}

export default function StudentsPage() {
  const { userRole } = useAppContext();
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedOverview, setSelectedOverview] = useState<StudentOverviewShape | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      if (userRole !== "teacher") {
        setStudents([]);
        setLoading(false);
        setError(null);
        return;
      }
      try {
        setLoading(true);
        const studentList = (await getStudents()) as RosterStudent[];
        setStudents(studentList);
        setSelectedStudentId(studentList[0]?.id || null);
        setError(null);
      } catch (fetchError) {
        console.error("Error fetching students page data:", fetchError);
        setStudents([]);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load students");
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [userRole]);

  useEffect(() => {
    const fetchOverview = async () => {
      if (!selectedStudentId) {
        setSelectedOverview(null);
        return;
      }
      try {
        setOverviewLoading(true);
        const overview = (await getStudentOverview(selectedStudentId)) as unknown as StudentOverviewShape;
        setSelectedOverview(overview);
      } catch (fetchError) {
        console.error("Error loading selected student overview:", fetchError);
        setSelectedOverview(null);
      } finally {
        setOverviewLoading(false);
      }
    };

    fetchOverview();
  }, [selectedStudentId]);

  if (userRole !== "teacher") {
    return (
      <div>
        <PageHeader title="Students" description="Track the student roster and inspect each learner&apos;s focus areas." />
        <EmptyState
          icon={LuUsers}
          title="Teacher access only"
          description="Switch to teacher mode to view the student roster."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description="Track the student roster, see who has exam history, and inspect the latest focus areas for each learner."
      />

      {loading ? (
        <PageLoader label="Loading students…" />
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : students.length === 0 ? (
        <EmptyState
          icon={LuUsers}
          title="No students yet"
          description="No students are available yet. Analyze an exam or create a student from the student workspace."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Roster" subtitle={`${students.length} students enrolled`} />
            <CardBody className="space-y-2">
              {students.map((student) => {
                const isActive = selectedStudentId === student.id;
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudentId(student.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                      isActive
                        ? "border-accent bg-accent-soft"
                        : "border-border-default hover:bg-surface-2",
                    )}
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">
                        {student.name} · {student.class}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {student.school} · {student.exam_count ?? 0} exams
                      </span>
                    </div>
                    <Badge variant={student.latest_exam ? "success" : "warning"}>
                      {student.latest_exam ? `${student.average_percentage ?? 0}% avg` : "No exams"}
                    </Badge>
                  </button>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Student details" subtitle="Progress summary for the selected learner" />
            <CardBody>
              {overviewLoading ? (
                <PageLoader label="Loading student summary…" />
              ) : !selectedOverview ? (
                <EmptyState
                  icon={LuGraduationCap}
                  title="No student selected"
                  description="Choose a student to inspect their progress."
                />
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-lg border border-border-default bg-surface-2 px-4 py-3">
                      <span className="text-xs font-medium text-muted">Average score</span>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">
                        {selectedOverview.summary.average_percentage ?? 0}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-border-default bg-surface-2 px-4 py-3">
                      <span className="text-xs font-medium text-muted">Available papers</span>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">
                        {selectedOverview.summary.available_papers_count ?? 0}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-fg">Latest exam</h3>
                    {selectedOverview.latest_exam ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-3">
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-fg">
                            {selectedOverview.latest_exam.subject} · {selectedOverview.latest_exam.exam_type}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {formatDate(selectedOverview.latest_exam.exam_date)} ·{" "}
                            {selectedOverview.latest_exam.scored_marks}/
                            {selectedOverview.latest_exam.total_marks}
                          </span>
                        </div>
                        <Badge variant="info">{selectedOverview.latest_exam.percentage ?? 0}%</Badge>
                      </div>
                    ) : (
                      <p className="text-sm text-muted">No exam result found for this student yet.</p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-fg">Current focus topics</h3>
                    <div className="flex flex-wrap gap-2">
                      {(selectedOverview.recommendations.priority_topics || []).length > 0 ? (
                        selectedOverview.recommendations.priority_topics!.map((topic) => (
                          <Badge key={topic} variant="warning">
                            {topic}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="default">No recommendation data yet</Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
