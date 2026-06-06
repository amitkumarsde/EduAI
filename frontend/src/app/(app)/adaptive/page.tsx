"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuBrain,
  LuClock,
  LuShieldAlert,
  LuCircleCheck,
  LuCircleX,
  LuTrophy,
  LuArrowRight,
  LuTrendingUp,
} from "react-icons/lu";
import { getNextAdaptiveQuestion, submitQuizAttempt } from "@/lib/api";
import type { Question } from "@/lib/types";
import { ProctorGuard } from "@/components/ProctorGuard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Label, FieldGroup, Select } from "@/components/ui/Field";
import { Alert, ProgressBar } from "@/components/ui/Misc";
import { PageLoader } from "@/components/ui/Spinner";

const SUBJECTS = ["Mathematics", "Science", "English", "Social Science", "General Knowledge"];
const MAX_QUESTIONS = 10;
const EXAM_SECONDS = 300; // 5 minutes
const MAX_WARNINGS = 3;
const LETTERS = ["A", "B", "C", "D"];

type Difficulty = "easy" | "medium" | "hard";

// Decide next difficulty from recent accuracy.
function nextDifficulty(current: Difficulty, recentCorrect: boolean[]): Difficulty {
  const window = recentCorrect.slice(-3);
  if (window.length < 2) return current;
  const acc = window.filter(Boolean).length / window.length;
  const order: Difficulty[] = ["easy", "medium", "hard"];
  let idx = order.indexOf(current);
  if (acc >= 0.8 && idx < 2) idx += 1;
  else if (acc <= 0.4 && idx > 0) idx -= 1;
  return order[idx];
}

// Narrow the loosely-typed adaptive question shape used by the backend.
interface AdaptiveQ {
  focus_topic?: string;
  question_text: string;
  options: string[];
  correct_option: string;
  explanation?: string;
}

function asAdaptiveQ(q: Question): AdaptiveQ {
  const raw = q as Record<string, unknown>;
  return {
    focus_topic: typeof raw.focus_topic === "string" ? raw.focus_topic : undefined,
    question_text: String(raw.question_text ?? ""),
    options: Array.isArray(raw.options) ? (raw.options as string[]) : [],
    correct_option: String(raw.correct_option ?? ""),
    explanation: typeof raw.explanation === "string" ? raw.explanation : undefined,
  };
}

export default function AdaptiveQuizPage() {
  const [subject, setSubject] = useState("Mathematics");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState<AdaptiveQ | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [results, setResults] = useState<boolean[]>([]); // booleans
  const [askedTexts, setAskedTexts] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_SECONDS);
  const [warnings, setWarnings] = useState(0);
  const finishedRef = useRef(false);

  // Accumulated answered-question snapshots so the session can be saved to
  // history when the exam ends.
  const attemptLogRef = useRef<{ q: AdaptiveQ; selectedLetter: string | null }[]>([]);
  const savedRef = useRef(false);
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `adaptive-${Date.now()}`,
  );

  const finishExam = useCallback((reason?: string | null) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    setError(reason ?? null);
  }, []);

  // Fetch the next question at a given difficulty.
  const loadQuestion = useCallback(
    async (diff: Difficulty, asked: string[]) => {
      setLoading(true);
      setError(null);
      setSelected(null);
      setRevealed(false);
      try {
        const q = await getNextAdaptiveQuestion({ subject, difficulty: diff, asked });
        setQuestion(asAdaptiveQ(q));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load question.");
      } finally {
        setLoading(false);
      }
    },
    [subject],
  );

  const startExam = useCallback(async () => {
    finishedRef.current = false;
    savedRef.current = false;
    attemptLogRef.current = [];
    setStarted(true);
    setFinished(false);
    setResults([]);
    setAskedTexts([]);
    setDifficulty("medium");
    setSecondsLeft(EXAM_SECONDS);
    setWarnings(0);
    await loadQuestion("medium", []);
  }, [loadQuestion]);

  // Countdown timer — state is only mutated inside the interval/cleanup callbacks.
  useEffect(() => {
    if (!started || finished) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          finishExam("Time is up — exam auto-submitted.");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, finished, finishExam]);

  // Anti-cheat: detect tab switches / window blur during the exam.
  useEffect(() => {
    if (!started || finished) return undefined;
    const onHidden = () => {
      if (document.hidden) {
        setWarnings((w) => {
          const next = w + 1;
          if (next >= MAX_WARNINGS) {
            finishExam("Exam terminated: too many tab switches detected.");
          }
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onHidden);
    };
  }, [started, finished, finishExam]);

  const submitAnswer = () => {
    if (selected == null || revealed || !question) return;
    setRevealed(true);
    const isCorrect = LETTERS[selected] === question.correct_option;
    setResults((prev) => [...prev, isCorrect]);
    setAskedTexts((prev) => [...prev, question.question_text]);
    attemptLogRef.current.push({ q: question, selectedLetter: LETTERS[selected] });
  };

  // Save the adaptive session to history once it finishes (best-effort).
  useEffect(() => {
    if (!finished || savedRef.current || attemptLogRef.current.length === 0) return;
    savedRef.current = true;
    const log = attemptLogRef.current;
    void submitQuizAttempt({
      subject,
      source: "adaptive",
      title: `Adaptive Exam — ${subject}`,
      difficulty,
      questions: log.map((entry, index) => ({
        question_no: index + 1,
        question_text: entry.q.question_text,
        options: entry.q.options,
        correct_option: entry.q.correct_option,
        focus_chapter: entry.q.focus_topic ?? null,
        explanation: entry.q.explanation ?? null,
        marks: 1,
      })),
      selections: log.map((entry, index) => ({
        question_no: index + 1,
        selected_option: entry.selectedLetter,
      })),
      time_spent_seconds: EXAM_SECONDS - secondsLeft,
    }).catch(() => undefined);
  }, [finished, subject, difficulty, secondsLeft]);

  const goNext = async () => {
    const answered = results.length;
    if (answered >= MAX_QUESTIONS) {
      finishExam(null);
      return;
    }
    const newDiff = nextDifficulty(difficulty, results);
    setDifficulty(newDiff);
    await loadQuestion(newDiff, askedTexts);
  };

  const correctCount = results.filter(Boolean).length;
  const accuracy = results.length ? Math.round((correctCount / results.length) * 100) : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const diffVariant: Record<Difficulty, "success" | "warning" | "danger"> = {
    easy: "success",
    medium: "warning",
    hard: "danger",
  };

  // ---- Intro screen ----
  if (!started) {
    return (
      <div>
        <PageHeader
          title="Adaptive Exam"
          description="Questions adapt to your performance in real time. Exam mode: timed, with tab-switch monitoring."
        />
        <Card className="max-w-xl">
          <CardBody className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <LuBrain className="h-5 w-5" />
              </span>
              <h3 className="text-base font-semibold text-fg">Set up your session</h3>
            </div>

            <FieldGroup>
              <Label htmlFor="adaptive-subject">Subject</Label>
              <Select
                id="adaptive-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FieldGroup>

            <ul className="space-y-2 text-sm text-muted">
              <li className="flex items-center gap-2">
                <LuClock className="h-4 w-4 text-subtle" />
                {EXAM_SECONDS / 60} minutes, up to {MAX_QUESTIONS} questions.
              </li>
              <li className="flex items-center gap-2">
                <LuTrendingUp className="h-4 w-4 text-subtle" />
                Difficulty rises when you do well, eases when you struggle.
              </li>
              <li className="flex items-center gap-2">
                <LuShieldAlert className="h-4 w-4 text-subtle" />
                Leaving the tab is logged. {MAX_WARNINGS} switches auto-submits the exam.
              </li>
            </ul>

            <Button onClick={startExam} loading={loading}>
              Start Adaptive Exam
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ---- Results screen ----
  if (finished) {
    return (
      <div>
        <PageHeader title="Exam Complete" description="Here&apos;s how your adaptive session went." />
        <Card className="max-w-2xl">
          <CardBody className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <LuTrophy className="h-5 w-5" />
              </span>
              <h3 className="text-base font-semibold text-fg">Your results</h3>
            </div>

            {error && <Alert variant="warning">{error}</Alert>}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ResultTile value={`${accuracy}%`} label="Accuracy" />
              <ResultTile value={`${correctCount}/${results.length}`} label="Correct" />
              <ResultTile value={difficulty} label="Final difficulty" capitalize />
              <ResultTile value={String(warnings)} label="Tab-switch warnings" />
            </div>

            <Button onClick={startExam}>Try again</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  // ---- Active exam screen ----
  const answeredProgress = Math.round((results.length / MAX_QUESTIONS) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={diffVariant[difficulty]} className="capitalize">
            {difficulty} difficulty
          </Badge>
          <span className="text-sm text-muted">
            Question {results.length + (revealed ? 0 : 1)} / {MAX_QUESTIONS}
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
          <LuClock className="h-4 w-4 text-subtle" /> {mm}:{ss}
        </span>
      </div>

      <ProgressBar value={answeredProgress} />

      <ProctorGuard sessionId={sessionId} context="adaptive" />

      {warnings > 0 && (
        <Alert variant="warning">
          <span className="inline-flex items-center gap-1.5">
            <LuShieldAlert className="h-4 w-4" />
            Warning {warnings}/{MAX_WARNINGS}: stay on this tab during the exam.
          </span>
        </Alert>
      )}

      <Card>
        <CardBody>
          {loading ? (
            <PageLoader label="Generating your next question…" />
          ) : error ? (
            <Alert variant="danger">{error}</Alert>
          ) : question ? (
            <div className="space-y-5">
              {question.focus_topic && (
                <Badge variant="accent">{question.focus_topic}</Badge>
              )}
              <h2 className="text-lg font-semibold tracking-tight text-fg">
                {question.question_text}
              </h2>

              <div className="space-y-2">
                {question.options.map((option, index) => {
                  const letter = LETTERS[index];
                  const isCorrect = letter === question.correct_option;
                  const isPicked = selected === index;
                  let cls = "border-border-default bg-surface hover:bg-surface-2";
                  if (revealed && isCorrect) cls = "border-success bg-success-soft text-success";
                  else if (revealed && isPicked && !isCorrect)
                    cls = "border-danger bg-danger-soft text-danger";
                  else if (isPicked) cls = "border-accent bg-accent-soft text-accent";
                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={revealed}
                      onClick={() => setSelected(index)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${cls}`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-current text-xs font-semibold">
                        {letter}
                      </span>
                      <span className="flex-1">{option}</span>
                      {revealed && isCorrect && <LuCircleCheck className="h-5 w-5 shrink-0" />}
                      {revealed && isPicked && !isCorrect && (
                        <LuCircleX className="h-5 w-5 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {revealed && (
                <div className="rounded-lg border border-border-default bg-surface-2 px-4 py-3 text-sm text-muted">
                  <strong className="text-fg">
                    {selected != null && LETTERS[selected] === question.correct_option
                      ? "Correct! "
                      : `Answer: ${question.correct_option}. `}
                  </strong>
                  {question.explanation}
                </div>
              )}

              <div>
                {!revealed ? (
                  <Button onClick={submitAnswer} disabled={selected == null}>
                    Submit answer
                  </Button>
                ) : (
                  <Button onClick={goNext}>
                    {results.length >= MAX_QUESTIONS ? "Finish" : "Next question"}{" "}
                    <LuArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}

function ResultTile({
  value,
  label,
  capitalize,
}: {
  value: string;
  label: string;
  capitalize?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className={`text-2xl font-semibold tracking-tight text-fg ${capitalize ? "capitalize" : ""}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-subtle">{label}</p>
    </Card>
  );
}
