"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  LuWifi,
  LuWifiOff,
  LuDownload,
  LuRefreshCw,
  LuTrash2,
  LuScanLine,
  LuCircleCheck,
} from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useStudentWorkspace } from "@/hooks/useStudentWorkspace";
import { useStudentOverview } from "@/hooks/useStudentOverview";
import {
  generatePracticeQuiz,
  submitQuizAttempt,
  ocrEvaluateImage,
} from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StudentSelector } from "@/components/StudentSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";
import { FieldGroup, Input, Label, Select } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { OcrResult } from "@/lib/types";

const OPTION_LABELS = ["A", "B", "C", "D"];
const CACHE_KEY = "edtech_offline_quiz";
const QUEUE_KEY = "edtech_offline_queue";

interface CachedQuestion {
  question_no: number;
  question_text: string;
  options: string[];
  correct_option: string;
  explanation?: string | null;
  focus_chapter?: string | null;
}

interface CachedQuiz {
  student_id: string;
  subject: string;
  title: string;
  difficulty: string;
  questions: CachedQuestion[];
  cached_at: number;
}

interface QueuedAttempt {
  payload: Record<string, unknown>;
  queued_at: number;
}

function readCache(): CachedQuiz | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedQuiz) : null;
  } catch {
    return null;
  }
}

function readQueue(): QueuedAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAttempt[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedAttempt[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export default function OfflinePage() {
  const { userRole } = useAppContext();
  const { language } = useLanguage();
  const {
    students,
    loading: studentLoading,
    error: studentError,
    creating,
    currentStudent,
    selectStudent,
    createStudentProfile,
  } = useStudentWorkspace();
  const { overview } = useStudentOverview(currentStudent?.id);

  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [cached, setCached] = useState<CachedQuiz | null>(() => readCache());
  const [queueCount, setQueueCount] = useState<number>(() => readQueue().length);
  const [selections, setSelections] = useState<Record<number, string>>({});
  const [subject, setSubject] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const subjects = useMemo<string[]>(
    () => ((overview?.summary as { subjects?: string[] } | undefined)?.subjects ?? []),
    [overview],
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (subjects.length && !subject) setSubject(subjects[0]);

  const syncQueue = useCallback(async () => {
    const queue = readQueue();
    if (!queue.length || !navigator.onLine) return;
    setSyncing(true);
    const remaining: QueuedAttempt[] = [];
    for (const item of queue) {
      try {
        await submitQuizAttempt(item.payload);
      } catch {
        remaining.push(item);
      }
    }
    writeQueue(remaining);
    setQueueCount(remaining.length);
    setSyncing(false);
    if (remaining.length < queue.length) {
      setMessage(`Synced ${queue.length - remaining.length} offline attempt(s) to your history.`);
    }
  }, []);

  // Auto-sync whenever we come back online.
  useEffect(() => {
    if (!online) return;
    void (async () => {
      await syncQueue();
    })();
  }, [online, syncQueue]);

  async function handleDownload(event: FormEvent) {
    event.preventDefault();
    if (!currentStudent?.id || !subject) return;
    setDownloading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await generatePracticeQuiz({
        student_id: currentStudent.id,
        subject,
        question_count: 10,
        difficulty: "adaptive",
        language,
      });
      const data = (response.data ?? response) as {
        quiz_info?: { title?: string; difficulty?: string };
        questions?: CachedQuestion[];
      };
      const quiz: CachedQuiz = {
        student_id: currentStudent.id,
        subject,
        title: data.quiz_info?.title || "Offline Practice Quiz",
        difficulty: data.quiz_info?.difficulty || "adaptive",
        questions: (data.questions ?? []).map((q, i) => ({
          question_no: q.question_no ?? i + 1,
          question_text: q.question_text,
          options: q.options ?? [],
          correct_option: q.correct_option,
          explanation: q.explanation ?? null,
          focus_chapter: q.focus_chapter ?? null,
        })),
        cached_at: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(quiz));
      setCached(quiz);
      setSelections({});
      setMessage("Quiz downloaded. You can now take it even without internet.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download quiz");
    } finally {
      setDownloading(false);
    }
  }

  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    setCached(null);
    setSelections({});
  }

  const answeredCount = Object.keys(selections).length;
  const correctCount = cached
    ? cached.questions.reduce(
        (n, q) => (selections[q.question_no] === q.correct_option ? n + 1 : n),
        0,
      )
    : 0;

  async function handleSubmitOffline() {
    if (!cached) return;
    const payload = {
      student_id: cached.student_id,
      subject: cached.subject,
      source: "offline",
      title: cached.title,
      difficulty: cached.difficulty,
      language,
      synced_from_offline: true,
      questions: cached.questions.map((q) => ({
        question_no: q.question_no,
        question_text: q.question_text,
        options: q.options,
        correct_option: q.correct_option,
        explanation: q.explanation,
        focus_chapter: q.focus_chapter,
        marks: 1,
      })),
      selections: cached.questions.map((q) => ({
        question_no: q.question_no,
        selected_option: selections[q.question_no] ?? null,
      })),
    };

    if (navigator.onLine) {
      try {
        await submitQuizAttempt(payload);
        setMessage("Attempt submitted and saved to your history.");
        clearCache();
        return;
      } catch {
        // fall through to queue
      }
    }
    const queue = readQueue();
    queue.push({ payload, queued_at: Date.now() });
    writeQueue(queue);
    setQueueCount(queue.length);
    setMessage("You're offline — attempt queued and will sync automatically when you reconnect.");
    clearCache();
  }

  if (userRole !== "student") {
    return (
      <div>
        <PageHeader title="Offline Mode" description="Take quizzes without internet." />
        <EmptyState icon={LuWifiOff} title="Student access only" description="Switch to student mode to use offline quizzes." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Offline Mode"
        description="Download a quiz while online, take it anywhere, and it syncs back automatically when you reconnect."
        actions={
          <Badge variant={online ? "success" : "warning"}>
            {online ? <LuWifi className="h-3.5 w-3.5" /> : <LuWifiOff className="h-3.5 w-3.5" />}
            {online ? "Online" : "Offline"}
          </Badge>
        }
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

        {queueCount > 0 && (
          <Alert variant="warning">
            <div className="flex items-center justify-between gap-3">
              <span>{queueCount} offline attempt(s) waiting to sync.</span>
              <Button size="sm" variant="secondary" onClick={syncQueue} loading={syncing} disabled={!online}>
                <LuRefreshCw className="h-4 w-4" /> Sync now
              </Button>
            </div>
          </Alert>
        )}

        {message && <Alert variant="success">{message}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        {studentLoading && !currentStudent ? (
          <PageLoader label="Loading student profiles…" />
        ) : !currentStudent ? (
          <EmptyState icon={LuWifiOff} title="No student selected" description="Select a student to download an offline quiz." />
        ) : (
          <>
            {!cached && (
              <Card>
                <CardHeader title="Download a quiz for offline use" subtitle="Requires internet now; the quiz then works fully offline." />
                <CardBody>
                  <form className="flex flex-wrap items-end gap-3" onSubmit={handleDownload}>
                    <FieldGroup className="w-48">
                      <Label htmlFor="offline-subject">Subject</Label>
                      <Select
                        id="offline-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={subjects.length === 0}
                      >
                        {subjects.length === 0 ? (
                          <option value="">No analyzed subjects yet</option>
                        ) : (
                          subjects.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))
                        )}
                      </Select>
                    </FieldGroup>
                    <Button type="submit" loading={downloading} disabled={!online || subjects.length === 0}>
                      <LuDownload className="h-4 w-4" /> Download quiz
                    </Button>
                    {!online && <span className="text-sm text-warning">Connect to the internet to download a new quiz.</span>}
                  </form>
                </CardBody>
              </Card>
            )}

            {cached && (
              <Card>
                <CardHeader
                  title={cached.title}
                  subtitle={`${cached.subject} · cached offline · ${cached.questions.length} questions`}
                  action={
                    <Button size="sm" variant="ghost" onClick={clearCache} aria-label="Discard cached quiz">
                      <LuTrash2 className="h-4 w-4" />
                    </Button>
                  }
                />
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="accent">Answered {answeredCount}/{cached.questions.length}</Badge>
                    <Badge variant="success">Correct {correctCount}</Badge>
                  </div>

                  {cached.questions.map((q) => {
                    const selected = selections[q.question_no] ?? null;
                    const answered = Boolean(selected);
                    const isCorrect = selected === q.correct_option;
                    return (
                      <div
                        key={q.question_no}
                        className={cn(
                          "rounded-xl border border-border-default p-4",
                          answered && isCorrect && "border-success/40 bg-success-soft/40",
                          answered && !isCorrect && "border-danger/40 bg-danger-soft/40",
                        )}
                      >
                        <p className="text-sm font-medium text-fg">
                          {q.question_no}. {q.question_text}
                        </p>
                        <div className="mt-3 grid gap-2">
                          {q.options.map((option, index) => {
                            const label = OPTION_LABELS[index];
                            const state = !selected
                              ? "idle"
                              : label === q.correct_option
                                ? "correct"
                                : label === selected
                                  ? "incorrect"
                                  : "idle";
                            return (
                              <button
                                key={label}
                                type="button"
                                disabled={answered}
                                onClick={() =>
                                  setSelections((prev) => (prev[q.question_no] ? prev : { ...prev, [q.question_no]: label }))
                                }
                                className={cn(
                                  "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
                                  state === "idle" && "border-border-default text-fg enabled:hover:bg-surface-2",
                                  state === "correct" && "border-success/50 bg-success-soft text-success",
                                  state === "incorrect" && "border-danger/50 bg-danger-soft text-danger",
                                )}
                              >
                                <span className="font-semibold">{label}.</span>
                                <span>{option}</span>
                              </button>
                            );
                          })}
                        </div>
                        {answered && q.explanation && (
                          <p className="mt-2 text-xs text-muted">Explanation: {q.explanation}</p>
                        )}
                      </div>
                    );
                  })}

                  <Button onClick={handleSubmitOffline} disabled={answeredCount === 0}>
                    <LuCircleCheck className="h-4 w-4" />
                    {online ? "Submit & save" : "Submit (will sync when online)"}
                  </Button>
                </CardBody>
              </Card>
            )}

            <HandwrittenScanner online={online} language={language} />
          </>
        )}
      </div>
    </div>
  );
}

function HandwrittenScanner({ online, language }: { online: boolean; language: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [maxMarks, setMaxMarks] = useState("5");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan(event: FormEvent) {
    event.preventDefault();
    if (!file || !questionText.trim()) {
      setError("Choose an image and enter the question text.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("question_text", questionText);
      formData.append("max_marks", maxMarks);
      formData.append("language", language);
      const data = await ocrEvaluateImage(formData);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan answer");
    } finally {
      setLoading(false);
    }
  }

  const tone = result
    ? result.confidence_label === "high"
      ? "success"
      : result.confidence_label === "medium"
        ? "warning"
        : "danger"
    : "default";

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <LuScanLine className="h-4 w-4 text-accent" /> Scan a handwritten answer
          </span>
        }
        subtitle="Photograph a handwritten answer to get an AI transcription, confidence score, and preliminary grade (needs internet)."
      />
      <CardBody>
        <form className="space-y-4" onSubmit={handleScan}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="scan-question">Question</Label>
              <Input id="scan-question" value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="The question this answer responds to" />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="scan-marks">Max marks</Label>
              <Input id="scan-marks" type="number" min={1} max={20} value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label htmlFor="scan-file">Answer photo</Label>
            <input
              id="scan-file"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-fg hover:file:bg-accent-hover"
            />
          </FieldGroup>
          {error && <Alert variant="danger">{error}</Alert>}
          <Button type="submit" loading={loading} disabled={!online}>
            <LuScanLine className="h-4 w-4" /> {online ? "Scan & grade" : "Connect to scan"}
          </Button>
        </form>

        {result && (
          <div className="mt-5 space-y-3 rounded-lg border border-border-default p-4">
            <div className="flex items-center gap-2">
              <Badge variant={tone}>Confidence {result.confidence}% ({result.confidence_label})</Badge>
              <Badge variant="accent">Score {result.preliminary_score}/{result.max_marks}</Badge>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Transcription</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{result.extracted_text || "—"}</p>
            </div>
            {result.legibility_issues.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Legibility issues</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                  {result.legibility_issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.feedback && <p className="text-sm text-muted">{result.feedback}</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
