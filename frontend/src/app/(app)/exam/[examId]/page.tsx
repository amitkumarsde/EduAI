"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LuCircleCheck,
  LuClock,
  LuDownload,
  LuUpload,
} from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import {
  analyzeExam,
  downloadPaperPDF,
  getPaperById,
  triggerPDFDownload,
} from "@/lib/api";
import type { Student } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";
import { cn } from "@/lib/utils";

const RESULT_STORAGE_PREFIX = "edtech_exam_result_";

interface ExamQuestion {
  id: number;
  number: number;
  text: string;
  marks: number;
  options: unknown[];
}

interface ExamViewModel {
  id: string;
  name: string;
  subject: string;
  class?: string;
  totalMarks?: number;
  duration?: string;
  questions: ExamQuestion[];
}

type LooseRecord = Record<string, unknown>;

const STEP_LABELS = ["Download", "Solve", "Upload", "Submitted"];

export default function ExamFlowPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();
  const { currentStudent, setCurrentStudent } = useAppContext();

  const [offlineStep, setOfflineStep] = useState(1);
  const [exam, setExam] = useState<ExamViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState(3600);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [offlineSubmitError, setOfflineSubmitError] = useState<string | null>(null);
  const [submittingOffline, setSubmittingOffline] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<LooseRecord | null>(null);

  // Countdown timer while solving.
  useEffect(() => {
    if (offlineStep !== 2 || remainingTime <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setRemainingTime((previousTime) => {
        if (previousTime <= 1) {
          clearInterval(timer);
          alert("Time is up. Please upload your completed answer sheet.");
          setOfflineStep(3);
          return 0;
        }
        return previousTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [offlineStep, remainingTime]);

  // Load the exam paper.
  useEffect(() => {
    if (!examId) return;

    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const paper = (await getPaperById(examId)) as LooseRecord;

        const rawQuestions = Array.isArray(paper.questions)
          ? (paper.questions as LooseRecord[])
          : [];
        const normalizedQuestions: ExamQuestion[] = rawQuestions.map((question, index) => ({
          id: (question.question_no as number) || index + 1,
          number: (question.question_no as number) || index + 1,
          text: (question.question_text as string) || (question.text as string) || "",
          marks: (question.marks as number) ?? (question.marks_available as number) ?? 0,
          options: Array.isArray(question.options) ? (question.options as unknown[]) : [],
        }));

        if (ignore) return;
        setExam({
          id: paper._id as string,
          name: paper.title as string,
          subject: paper.subject as string,
          class: paper.class as string,
          totalMarks: paper.total_marks as number,
          duration: paper.duration as string,
          questions: normalizedQuestions,
        });
        setRemainingTime(parseDurationToSeconds(paper.duration as string));
        setError(null);
      } catch (fetchError) {
        if (ignore) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load exam");
        setExam(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [examId]);

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  async function handleOfflineDownload() {
    if (!exam) return;
    try {
      const blob = await downloadPaperPDF(exam.id);
      triggerPDFDownload(blob, exam.name || "paper");
      setOfflineStep(2);
      setOfflineSubmitError(null);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download paper");
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] || null;
    setUploadedFiles(nextFile ? [nextFile] : []);
    setOfflineSubmitError(null);
  }

  async function handleOfflineSubmit() {
    if (!exam) {
      setOfflineSubmitError("Exam details are missing. Reload and try again.");
      return;
    }

    if (uploadedFiles.length === 0) {
      setOfflineSubmitError("Upload your answer sheet before submitting.");
      return;
    }

    try {
      setSubmittingOffline(true);
      setOfflineSubmitError(null);

      const questionPaperBlob = await downloadPaperPDF(exam.id);
      const questionPaperFile = buildQuestionPaperFile(questionPaperBlob, exam.name);
      const answerSheetFile = uploadedFiles[0];
      const formData = new FormData();

      formData.append("question_paper", questionPaperFile);
      formData.append("answer_sheet", answerSheetFile);

      // Use the actively selected student only as a fallback when the
      // uploaded answer sheet does not include identifiable student details.
      if (currentStudent?.name && currentStudent?.class) {
        formData.append("fallback_student_name", currentStudent.name);
        formData.append("fallback_student_class", currentStudent.class);

        if (currentStudent.school) {
          formData.append("fallback_student_school", currentStudent.school);
        }
      }

      const response = (await analyzeExam(formData)) as LooseRecord;
      const resultData = ((response.data as LooseRecord) || response) as LooseRecord;

      setAnalysisResult(resultData);

      const studentInfo = resultData.student_info as LooseRecord | undefined;
      if (studentInfo?.name && studentInfo?.class) {
        const nextStudent: Student = {
          id: (resultData.student_id as string) || "",
          name: studentInfo.name as string,
          class: studentInfo.class as string,
          school: (studentInfo.school as string) || "Unknown School",
        };
        setCurrentStudent(nextStudent);
      }

      setOfflineStep(4);
    } catch (submitError) {
      setOfflineSubmitError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to analyze the uploaded answer sheet.",
      );
    } finally {
      setSubmittingOffline(false);
    }
  }

  function handleViewResult() {
    if (!exam) return;
    const targetId = (analysisResult?.exam_id as string) || exam.id;

    // Next.js has no router state. Stash the payload in sessionStorage for the
    // result page to read (it expects { resultData, examMeta } under this key).
    try {
      sessionStorage.setItem(
        `${RESULT_STORAGE_PREFIX}${targetId}`,
        JSON.stringify({ resultData: analysisResult, examMeta: exam }),
      );
    } catch {
      // Ignore storage write failures; the result page handles a missing payload.
    }

    router.push(`/result/${targetId}`);
  }

  if (loading) {
    return <PageLoader label="Loading exam…" />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert variant="danger">{error}</Alert>
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          Go back
        </Button>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          title="Exam not available"
          description="Exam data could not be loaded. Please return to the dashboard and try again."
          action={
            <Button variant="secondary" onClick={() => router.push("/dashboard")}>
              Go back
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-between gap-2">
        {STEP_LABELS.map((label, index) => {
          const step = index + 1;
          const isDone = step < offlineStep;
          const isActive = step === offlineStep;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-2">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold",
                  isActive && "border-transparent bg-accent text-accent-fg",
                  isDone && "border-transparent bg-success-soft text-success",
                  !isActive && !isDone && "border-border-default bg-surface-2 text-subtle",
                )}
              >
                {isDone ? <LuCircleCheck className="h-5 w-5" /> : step}
              </span>
              <span
                className={cn(
                  "text-center text-xs",
                  isActive ? "font-medium text-fg" : "text-subtle",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step 1: Download */}
      {offlineStep === 1 && (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
            <LuClock className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-fg">New PDF Exam Available</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Your {exam.subject} paper is ready. Download the PDF, solve it on paper, and then upload
            your answer sheet for AI checking.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <DetailItem label="Total Marks" value={String(exam.totalMarks ?? "—")} />
            <DetailItem label="Duration" value={String(exam.duration ?? "—")} />
            <DetailItem label="Format" value="PDF Paper" />
          </div>
          <div className="mt-6">
            <Button size="lg" fullWidth onClick={handleOfflineDownload}>
              <LuDownload className="h-5 w-5" /> Download PDF Paper
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Solve */}
      {offlineStep === 2 && (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
            <LuDownload className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-fg">Paper Downloaded</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Great. The paper has been downloaded. Solve it on paper and upload a clear PDF or image
            of your answer sheet when you are done.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-fg">
            <LuClock className="h-6 w-6 text-muted" />
            <span>{formatTime(remainingTime)}</span>
          </div>
          <p className="mt-2 text-xs text-subtle">
            Complete your exam and then continue to the upload step for checking.
          </p>
          <div className="mt-6">
            <Button variant="secondary" size="lg" fullWidth onClick={() => setOfflineStep(3)}>
              Ready to Upload Answer Sheet
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Upload */}
      {offlineStep === 3 && (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
            <LuUpload className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-fg">Upload Answer Sheet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Upload your completed answer sheet and we will compare it against the generated PDF
            paper.
          </p>
          <div className="mt-5">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileUpload}
              id="file-upload"
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2 px-6 py-10 transition-colors hover:bg-surface-3"
            >
              <LuUpload className="h-8 w-8 text-muted" />
              <p className="text-sm font-medium text-fg">Click to upload your answer sheet</p>
              <small className="max-w-sm text-xs text-subtle">
                Supported formats: JPEG, PNG, WEBP, HEIC, HEIF, PDF (one file up to 20 MB)
              </small>
            </label>
            {uploadedFiles.length > 0 && (
              <div className="mt-3 rounded-lg bg-surface-2 px-4 py-3 text-left text-sm">
                <p className="font-medium text-fg">Selected File:</p>
                <ul className="mt-1 list-inside list-disc text-muted">
                  {uploadedFiles.map((file) => (
                    <li key={file.name}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {offlineSubmitError && (
            <div className="mt-4">
              <Alert variant="danger">{offlineSubmitError}</Alert>
            </div>
          )}
          <div className="mt-6">
            <Button
              size="lg"
              fullWidth
              onClick={handleOfflineSubmit}
              loading={submittingOffline}
              disabled={submittingOffline}
            >
              {submittingOffline ? "Analyzing Answer Sheet…" : "Upload and Submit"}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Submitted */}
      {offlineStep === 4 && (
        <Card className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <LuCircleCheck className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-fg">Answer Sheet Checked</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {analysisResult
              ? `Your paper has been analyzed. You scored ${
                  (analysisResult.total_scored as number) ?? "—"
                }/${
                  ((analysisResult.student_info as LooseRecord)?.total_marks as number) ??
                  exam.totalMarks ??
                  "—"
                }.`
              : "Your answer sheet has been submitted successfully."}
          </p>

          {analysisResult && (
            <div className="mx-auto mt-5 max-w-md rounded-lg bg-surface-2 px-4 py-4 text-left text-sm">
              <p className="font-medium text-fg">Analysis summary:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted">
                <li>Percentage: {(analysisResult.percentage as number) ?? 0}%</li>
                <li>
                  Focus topics:{" "}
                  {(
                    ((analysisResult.ai_recommendation as LooseRecord)
                      ?.priority_topics as string[]) || []
                  )
                    .slice(0, 3)
                    .join(", ") || "No urgent topics identified"}
                </li>
                <li>
                  Suggested goal:{" "}
                  {((analysisResult.ai_recommendation as LooseRecord)?.suggested_goal as string) ||
                    "Not available"}
                </li>
              </ul>
              {Boolean(analysisResult.needs_manual_review) && (
                <div className="mt-3">
                  <Alert variant="warning">
                    <strong>Note:</strong> The handwriting was difficult to read. This score may
                    need manual review.
                  </Alert>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <Button size="lg" fullWidth onClick={handleViewResult}>
              View Result
            </Button>
            <Button variant="secondary" size="lg" fullWidth onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 text-sm font-semibold text-fg">{value}</p>
    </div>
  );
}

function buildQuestionPaperFile(blob: Blob, examName?: string): File {
  const safeName = sanitizeFileName(examName || "question-paper");
  return new File([blob], `${safeName}.pdf`, {
    type: blob.type || "application/pdf",
  });
}

function sanitizeFileName(value?: string): string {
  return (
    String(value || "paper")
      .trim()
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "paper"
  );
}

function parseDurationToSeconds(duration?: string): number {
  const normalizedDuration = String(duration || "").trim().toLowerCase();
  const durationValue = Number.parseFloat(normalizedDuration);

  if (!Number.isFinite(durationValue) || durationValue <= 0) {
    return 3600;
  }

  if (normalizedDuration.includes("minute")) {
    return Math.round(durationValue * 60);
  }

  return Math.round(durationValue * 60 * 60);
}
