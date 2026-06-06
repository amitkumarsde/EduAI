"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LuClock, LuCircleCheck, LuArrowLeft, LuTriangleAlert, LuPrinter } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  getInstituteExamToTake,
  startInstituteAttempt,
  submitInstituteAttempt,
} from "@/lib/api";
import { ProctorGuard } from "@/components/ProctorGuard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState, ProgressBar } from "@/components/ui/Misc";
import { FieldGroup, Input, Label, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { InstituteExamToTake, InstituteReport } from "@/lib/types";

const OPTION_LABELS = ["A", "B", "C", "D"];

type Phase = "intro" | "taking" | "report";

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TakeExamPage() {
  const params = useParams<{ examCode: string }>();
  const examCode = params.examCode;
  const { user } = useAppContext();
  const { language } = useLanguage();

  const [exam, setExam] = useState<InstituteExamToTake | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("intro");
  const [studentName, setStudentName] = useState(user?.name ?? "");
  const [studentEmail, setStudentEmail] = useState(user?.email ?? "");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState<InstituteReport | null>(null);
  const [sessionId] = useState(makeSessionId);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        setLoading(true);
        const data = await getInstituteExamToTake(examCode);
        if (!ignore) setExam(data);
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e.message : "Exam not found");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [examCode]);

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (!attemptId || !exam || submitting) return;
      setSubmitting(true);
      try {
        const payload = {
          answers: exam.questions.map((q) => ({ qid: q.qid, answer: answers[q.qid] ?? "" })),
          time_taken_seconds: Math.round((Date.now() - startedAtRef.current) / 1000),
          language,
        };
        const result = await submitInstituteAttempt(attemptId, payload);
        setReport(result);
        setPhase("report");
      } catch (e) {
        if (!auto) setError(e instanceof Error ? e.message : "Failed to submit");
      } finally {
        setSubmitting(false);
      }
    },
    [attemptId, exam, answers, submitting, language],
  );

  // Countdown timer during the attempt — state is only mutated inside the
  // interval callback so the effect body stays free of synchronous setState.
  useEffect(() => {
    if (phase !== "taking") return undefined;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          void handleSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, handleSubmit]);

  async function handleStart() {
    if (!exam) return;
    if (!studentName.trim()) {
      setError("Enter your name to begin.");
      return;
    }
    setError(null);
    try {
      const { attempt_id } = await startInstituteAttempt(examCode, {
        student_name: studentName,
        student_email: studentEmail,
      });
      setAttemptId(attempt_id);
      setTimeLeft(exam.duration_minutes * 60);
      startedAtRef.current = Date.now();
      setPhase("taking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start exam");
    }
  }

  const answeredCount = useMemo(
    () => (exam ? exam.questions.filter((q) => (answers[q.qid] ?? "").trim()).length : 0),
    [exam, answers],
  );

  if (loading) return <PageLoader label="Loading exam…" />;
  if (error && !exam) {
    return (
      <div>
        <PageHeader title="Exam" />
        <EmptyState
          icon={LuTriangleAlert}
          title="Exam unavailable"
          description={error}
          action={
            <Link href="/exams">
              <Button variant="secondary">
                <LuArrowLeft className="h-4 w-4" /> Back to search
              </Button>
            </Link>
          }
        />
      </div>
    );
  }
  if (!exam) return null;

  return (
    <div>
      <PageHeader
        title={exam.title}
        description={`${exam.institute_name} · ${exam.subject ?? ""} · ${exam.total_marks} marks · ${exam.duration_minutes} min`}
        actions={
          phase === "taking" ? (
            <Badge variant={timeLeft < 60 ? "danger" : "accent"}>
              <LuClock className="h-3.5 w-3.5" /> {formatClock(timeLeft)}
            </Badge>
          ) : undefined
        }
      />

      {phase === "intro" && (
        <Card>
          <CardHeader title="Before you begin" subtitle="This exam is monitored. Your camera and tab activity will be checked." />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="sn">Your name</Label>
                <Input id="sn" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="se">Email (optional)</Label>
                <Input id="se" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} />
              </FieldGroup>
            </div>
            <Alert variant="info">
              {exam.questions.length} questions · {exam.duration_minutes} minutes. The timer starts when you click begin and auto-submits at zero.
            </Alert>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button onClick={handleStart}>Begin exam</Button>
          </CardBody>
        </Card>
      )}

      {phase === "taking" && (
        <div className="space-y-4">
          <ProctorGuard sessionId={sessionId} context={`institute:${examCode}`} />

          <Card>
            <CardBody className="space-y-2">
              <Badge variant="accent">Answered {answeredCount}/{exam.questions.length}</Badge>
            </CardBody>
          </Card>

          {exam.questions.map((q, index) => (
            <Card key={q.qid}>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-fg">Question {index + 1}</span>
                  <Badge>{q.marks} marks</Badge>
                </div>
                <p className="text-sm text-fg">{q.question_text}</p>

                {q.type === "mcq" ? (
                  <div className="grid gap-2">
                    {q.options.map((opt, oi) => {
                      const label = OPTION_LABELS[oi];
                      const selected = answers[q.qid] === label;
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.qid]: label }))}
                          className={cn(
                            "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            selected ? "border-accent bg-accent-soft text-accent" : "border-border-default text-fg hover:bg-surface-2",
                          )}
                        >
                          <span className="font-semibold">{label}.</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Textarea
                    value={answers[q.qid] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.qid]: e.target.value }))}
                    placeholder="Write your answer…"
                    className="min-h-[120px]"
                  />
                )}
              </CardBody>
            </Card>
          ))}

          {error && <Alert variant="danger">{error}</Alert>}

          <Button onClick={() => handleSubmit(false)} loading={submitting}>
            <LuCircleCheck className="h-4 w-4" /> Submit exam
          </Button>
        </div>
      )}

      {phase === "report" && report && (
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold text-fg">
                    {report.scored_marks}/{report.total_marks}
                  </p>
                  <p className="text-sm text-muted">{report.performance_level}</p>
                </div>
                <div className="text-right">
                  <Badge variant={report.passed ? "success" : "danger"}>{report.grade}</Badge>
                  <p className="mt-1 text-sm text-muted">{report.percentage}%</p>
                </div>
              </div>
              <ProgressBar value={report.percentage} tone={report.passed ? "success" : "danger"} />
              <Badge variant={report.passed ? "success" : "danger"}>
                {report.passed ? "Passed" : "Did not pass"}
              </Badge>
            </CardBody>
          </Card>

          {(report.strengths.length > 0 || report.weaknesses.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader title="Strengths" />
                <CardBody className="flex flex-wrap gap-2">
                  {report.strengths.length === 0 ? (
                    <span className="text-sm text-muted">—</span>
                  ) : (
                    report.strengths.map((s, i) => <Badge key={i} variant="success">{s}</Badge>)
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Needs work" />
                <CardBody className="flex flex-wrap gap-2">
                  {report.weaknesses.length === 0 ? (
                    <span className="text-sm text-muted">—</span>
                  ) : (
                    report.weaknesses.map((w, i) => <Badge key={i} variant="warning">{w}</Badge>)
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader title="Question-by-question" />
            <CardBody className="space-y-2">
              {report.question_analysis.map((a, i) => (
                <div key={i} className="rounded-lg border border-border-default px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-fg">Q{i + 1}. {a.question_text}</span>
                    <Badge variant={a.awarded_marks >= a.max_marks ? "success" : a.awarded_marks > 0 ? "warning" : "danger"}>
                      {a.awarded_marks}/{a.max_marks}
                    </Badge>
                  </div>
                  {a.feedback && <p className="mt-1 text-xs text-muted">{a.feedback}</p>}
                </div>
              ))}
            </CardBody>
          </Card>

          {report.recommendations.length > 0 && (
            <Card>
              <CardHeader title="Recommendations" />
              <CardBody>
                <ul className="list-disc pl-5 text-sm text-muted">
                  {report.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/exams">
              <Button variant="secondary">
                <LuArrowLeft className="h-4 w-4" /> Back to exams
              </Button>
            </Link>
            <Button variant="outline" onClick={() => window.print()}>
              <LuPrinter className="h-4 w-4" /> Print / Save as PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
