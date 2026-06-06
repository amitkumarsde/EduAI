"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuDownload, LuExternalLink, LuFileText } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useStudentWorkspace } from "@/hooks/useStudentWorkspace";
import { useStudentOverview } from "@/hooks/useStudentOverview";
import {
  downloadPaperPDF,
  formatDate,
  getAllPapers,
  triggerPDFDownload,
} from "@/lib/api";
import type { GeneratedPaper } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StudentSelector } from "@/components/StudentSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";

interface ExamHistoryEntry {
  id?: string;
  subject?: string;
  exam_type?: string;
  scored_marks?: number;
  total_marks?: number;
  percentage?: number;
  exam_date?: string;
  priority_topics?: string[];
  [key: string]: unknown;
}

export default function MyExamsPage() {
  const router = useRouter();
  const { userRole } = useAppContext();
  const isTeacher = userRole === "teacher";

  const {
    students,
    loading: studentLoading,
    error: studentError,
    creating,
    currentStudent,
    selectStudent,
    createStudentProfile,
  } = useStudentWorkspace();
  const {
    overview,
    loading: overviewLoading,
    error: overviewError,
  } = useStudentOverview(currentStudent?.id);

  const [studentPapers, setStudentPapers] = useState<GeneratedPaper[]>([]);
  const [studentPapersLoading, setStudentPapersLoading] = useState(false);
  const [studentPapersError, setStudentPapersError] = useState<string | null>(null);

  const [teacherPapers, setTeacherPapers] = useState<GeneratedPaper[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(isTeacher);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  // Teacher: load every generated paper.
  useEffect(() => {
    if (!isTeacher) return;

    let ignore = false;
    (async () => {
      try {
        setTeacherLoading(true);
        const papers = await getAllPapers();
        if (!ignore) {
          setTeacherPapers(papers);
          setTeacherError(null);
        }
      } catch (err) {
        if (!ignore) {
          setTeacherPapers([]);
          setTeacherError(err instanceof Error ? err.message : "Failed to load papers");
        }
      } finally {
        if (!ignore) setTeacherLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [isTeacher]);

  // Student (no active profile): fall back to all available papers.
  useEffect(() => {
    if (isTeacher || currentStudent) return;

    let ignore = false;
    (async () => {
      try {
        setStudentPapersLoading(true);
        const papers = await getAllPapers();
        if (!ignore) {
          setStudentPapers(papers);
          setStudentPapersError(null);
        }
      } catch (err) {
        if (!ignore) {
          setStudentPapers([]);
          setStudentPapersError(err instanceof Error ? err.message : "Failed to load available papers");
        }
      } finally {
        if (!ignore) setStudentPapersLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentStudent, isTeacher]);

  async function handleDownload(paperId: string, fileName?: string) {
    try {
      const blob = await downloadPaperPDF(paperId);
      triggerPDFDownload(blob, fileName || "paper");
    } catch {
      alert("Failed to download this paper.");
    }
  }

  // ---------------------------------------------------------------- Teacher view
  if (isTeacher) {
    return (
      <div>
        <PageHeader
          title="My Exams"
          description="Review every generated paper in one place and jump back into download or preview flows."
        />

        {teacherLoading ? (
          <PageLoader label="Loading your generated papers…" />
        ) : teacherError ? (
          <Alert variant="danger">{teacherError}</Alert>
        ) : teacherPapers.length === 0 ? (
          <EmptyState
            icon={LuFileText}
            title="No papers generated yet"
            description="Create one from the paper generation screen to see it here."
            action={<Button onClick={() => router.push("/generate-paper")}>Generate paper</Button>}
          />
        ) : (
          <Card>
            <CardHeader title="Generated papers" subtitle={`${teacherPapers.length} papers`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-left text-xs uppercase tracking-wider text-subtle">
                    <th className="px-5 py-3 font-medium">Exam</th>
                    <th className="px-5 py-3 font-medium">Subject</th>
                    <th className="px-5 py-3 font-medium">Class</th>
                    <th className="px-5 py-3 font-medium">Format</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {teacherPapers.map((paper) => {
                    const id = (paper._id || paper.id) as string;
                    return (
                      <tr key={id} className="transition-colors hover:bg-surface-2">
                        <td className="px-5 py-3 font-medium text-fg">{paper.title}</td>
                        <td className="px-5 py-3 text-muted">{paper.subject}</td>
                        <td className="px-5 py-3 text-muted">{paper.class}</td>
                        <td className="px-5 py-3">
                          <Badge variant="success">PDF</Badge>
                        </td>
                        <td className="px-5 py-3 text-muted">
                          {formatDate((paper.created_at as string) ?? paper.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => handleDownload(id, paper.title)}>
                              <LuDownload className="h-4 w-4" /> Download
                            </Button>
                            <Button size="sm" onClick={() => router.push("/paper-generated")}>
                              <LuExternalLink className="h-4 w-4" /> Open
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- Student view
  const ov = (overview ?? {}) as Record<string, unknown>;
  const availablePapers: GeneratedPaper[] = currentStudent
    ? ((ov.available_papers as GeneratedPaper[]) ?? [])
    : studentPapers;
  const examHistory = (ov.exam_history as ExamHistoryEntry[]) ?? [];
  const papersLoading = currentStudent ? overviewLoading : studentPapersLoading;
  const papersError = currentStudent ? overviewError : studentPapersError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Exams"
        description="Browse available papers for your class and review previously analyzed exams for the active student."
      />

      <StudentSelector
        students={students}
        loading={studentLoading}
        creating={creating}
        error={studentError}
        currentStudent={currentStudent}
        onSelectStudent={selectStudent}
        onCreateStudent={createStudentProfile}
      />

      {!currentStudent && (
        <Alert variant="info">
          Your student profile will be created automatically after the first analyzed answer sheet.
          You can still browse papers below, and exam history will appear as soon as one answer sheet
          is checked.
        </Alert>
      )}

      {/* Available papers */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-fg">Available papers</h2>
        {papersLoading ? (
          <PageLoader label="Loading student exams…" />
        ) : papersError ? (
          <Alert variant="danger">{papersError}</Alert>
        ) : availablePapers.length === 0 ? (
          <EmptyState
            icon={LuFileText}
            title="No papers available yet"
            description={
              currentStudent
                ? `No papers are available for ${currentStudent.class} yet.`
                : "Once an answer sheet is analyzed, your profile and history will appear automatically."
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {availablePapers.map((paper) => {
              const id = (paper._id || paper.id) as string;
              return (
                <Card key={id} hover className="flex flex-col p-5">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-fg">{paper.title}</h3>
                    <p className="text-sm text-muted">
                      {paper.subject} · {(paper.total_marks as number) ?? paper.totalMarks} marks ·{" "}
                      {String(paper.duration ?? "")}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{paper.class}</Badge>
                    <Badge variant="success">PDF</Badge>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="secondary" fullWidth onClick={() => handleDownload(id, paper.title)}>
                      <LuDownload className="h-4 w-4" /> Download
                    </Button>
                    <Button fullWidth onClick={() => router.push(`/exam/${id}`)}>
                      <LuFileText className="h-4 w-4" /> Open PDF Workflow
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Exam history */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-fg">Exam history</h2>
        {!currentStudent ? (
          <EmptyState
            icon={LuFileText}
            title="No exam history yet"
            description="Exam history will be created automatically after your first analyzed answer sheet."
          />
        ) : overviewLoading ? (
          <PageLoader label="Loading exam history…" />
        ) : overviewError ? (
          <Alert variant="danger">{overviewError}</Alert>
        ) : examHistory.length === 0 ? (
          <EmptyState
            icon={LuFileText}
            title="No analyzed exams yet"
            description="Upload an answer sheet from the offline exam flow to build this history."
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-left text-xs uppercase tracking-wider text-subtle">
                    <th className="px-5 py-3 font-medium">Subject</th>
                    <th className="px-5 py-3 font-medium">Exam type</th>
                    <th className="px-5 py-3 font-medium">Score</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Focus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {examHistory.map((exam) => (
                    <tr key={exam.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-3 font-medium text-fg">{exam.subject}</td>
                      <td className="px-5 py-3 text-muted">{exam.exam_type}</td>
                      <td className="px-5 py-3 text-muted">
                        {exam.scored_marks ?? 0}/{exam.total_marks} ({exam.percentage ?? 0}%)
                      </td>
                      <td className="px-5 py-3 text-muted">{formatDate(exam.exam_date)}</td>
                      <td className="px-5 py-3 text-muted">
                        {(exam.priority_topics || []).slice(0, 2).join(", ") || "Review weak chapters"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
