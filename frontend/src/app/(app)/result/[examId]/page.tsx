"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LuTarget, LuTrendingUp, LuZap } from "react-icons/lu";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Misc";

/* ------------------------------------------------------------------ types */
interface ChapterPerformance {
  name: string;
  score: number;
  maxScore: number;
}

interface ResultViewModel {
  examName: string;
  subject: string;
  score: number;
  totalMarks: number;
  percentage: number;
  feedback: string;
  chapters: ChapterPerformance[];
  strongTopics: string[];
  weakTopics: string[];
  suggestedGoal: string | null;
  needsManualReview: boolean;
  insights: string[];
}

type LooseRecord = Record<string, unknown>;

/* The transient analysis payload is stashed in sessionStorage by the exam flow
 * (there is no GET-by-id endpoint), keyed by exam id. */
const RESULT_STORAGE_PREFIX = "edtech_exam_result_";

const GOALS = [
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 90, label: "90%" },
  { value: 100, label: "100%" },
];

export default function StudentResultPage() {
  const { examId } = useParams<{ examId: string }>();
  const router = useRouter();

  const result = useMemo(() => loadResultViewModel(examId), [examId]);
  const [selectedGoal, setSelectedGoal] = useState<number | null>(() =>
    normalizeGoalSelection(result?.suggestedGoal),
  );

  if (!result) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-6">
          <h2 className="text-lg font-semibold tracking-tight text-fg">Result not loaded</h2>
          <p className="mt-2 text-sm text-muted">
            Live result data is not available for this visit yet. Submit an offline answer sheet to
            see the AI analysis here.
          </p>
          <div className="mt-5">
            <Button variant="secondary" size="lg" fullWidth onClick={() => router.push("/dashboard")}>
              Back to dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  function handleGenerateQuiz() {
    if (result) {
      sessionStorage.setItem("edtech_quiz_preferred_subject", result.subject);
    }
    router.push("/quiz");
  }

  return (
    <div className="space-y-6">
      {/* Score */}
      <Card className="p-6">
        {result.needsManualReview && (
          <div className="mb-4 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
            <strong>Low confidence:</strong> Handwriting was difficult to read. Results may require
            manual verification.
          </div>
        )}
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-full border-4 border-accent bg-accent-soft">
            <span className="text-3xl font-semibold tracking-tight text-accent">
              {result.percentage}%
            </span>
            <span className="text-xs text-muted">Score</span>
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{result.examName}</h1>
            <p className="mt-1 text-sm text-muted">{result.subject}</p>
            <p className="mt-2 text-sm text-muted">
              Marks obtained:{" "}
              <strong className="text-fg">
                {result.score}/{result.totalMarks}
              </strong>
            </p>
          </div>
        </div>
      </Card>

      {/* Chapter-wise performance */}
      <Card>
        <CardHeader title="Chapter-wise performance" />
        <CardBody>
          {result.chapters.length === 0 ? (
            <p className="text-sm text-muted">
              Question-level chapter breakdown is not available for this result.
            </p>
          ) : (
            <div className="space-y-3">
              {result.chapters.map((chapter) => {
                const pct =
                  chapter.maxScore > 0 ? Math.round((chapter.score / chapter.maxScore) * 100) : 0;
                const tone = pct >= 70 ? "success" : pct >= 50 ? "warning" : "danger";
                return (
                  <div
                    key={chapter.name}
                    className="grid grid-cols-[minmax(0,1fr)_2fr_48px] items-center gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-fg">{chapter.name}</p>
                      <p className="text-xs text-subtle">
                        {chapter.score}/{chapter.maxScore}
                      </p>
                    </div>
                    <ProgressBar value={Math.min(pct, 100)} tone={tone} />
                    <span className="text-right text-sm font-medium text-fg">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* AI feedback */}
      <Card>
        <CardHeader title="AI feedback" />
        <CardBody className="space-y-5">
          <p className="text-sm text-muted">{result.feedback}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-fg">Strong topics</h4>
              <div className="flex flex-wrap gap-2">
                {result.strongTopics.length === 0 ? (
                  <Badge variant="success">No strong topics recorded yet</Badge>
                ) : (
                  result.strongTopics.map((topic) => (
                    <Badge key={topic} variant="success">
                      {topic}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-fg">Focus areas</h4>
              <div className="flex flex-wrap gap-2">
                {result.weakTopics.length === 0 ? (
                  <Badge variant="warning">No urgent focus areas recorded</Badge>
                ) : (
                  result.weakTopics.map((topic) => (
                    <Badge key={topic} variant="warning">
                      {topic}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Target goal */}
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <LuTarget className="h-5 w-5" />
          </span>
          <h3 className="text-base font-semibold text-fg">Set your target</h3>
        </div>
        <p className="mt-3 text-sm text-muted">What is your target score for the next exam?</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {GOALS.map((goal) => (
            <button
              key={goal.value}
              type="button"
              onClick={() => setSelectedGoal(goal.value)}
              className={
                selectedGoal === goal.value
                  ? "cursor-pointer rounded-lg border border-transparent bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
                  : "cursor-pointer rounded-lg border border-border-default bg-surface-2 px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-3"
              }
            >
              {goal.label}
            </button>
          ))}
        </div>
        {selectedGoal && (
          <p className="mt-4 text-sm text-muted">
            Your next target is <strong className="text-fg">{selectedGoal}%</strong>. Keep practicing
            toward it.
          </p>
        )}
      </Card>

      {/* Actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" fullWidth onClick={handleGenerateQuiz}>
          <LuZap className="h-5 w-5" /> Generate revision quiz
        </Button>
        <Button variant="secondary" size="lg" fullWidth onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>

      {/* Insights */}
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <LuTrendingUp className="h-5 w-5" />
          </span>
          <h4 className="text-base font-semibold text-fg">Performance insights</h4>
        </div>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted">
          {result.insights.map((insight) => (
            <li key={insight}>{insight}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ data loading */
function loadResultViewModel(examId?: string): ResultViewModel | null {
  if (typeof window === "undefined" || !examId) return null;
  let stored: { resultData?: LooseRecord; examMeta?: LooseRecord } | null = null;
  try {
    const raw = sessionStorage.getItem(`${RESULT_STORAGE_PREFIX}${examId}`);
    stored = raw ? (JSON.parse(raw) as { resultData?: LooseRecord; examMeta?: LooseRecord }) : null;
  } catch {
    stored = null;
  }
  return buildResultViewModel(stored?.resultData, stored?.examMeta, examId);
}

/* ------------------------------------------------------------------ view-model */
function buildResultViewModel(
  resultData: LooseRecord | undefined,
  examMeta: LooseRecord | undefined,
  examId?: string,
): ResultViewModel | null {
  if (!resultData || typeof resultData !== "object") {
    return null;
  }

  const studentInfo = (resultData.student_info as LooseRecord) || {};
  const questions = Array.isArray(resultData.questions)
    ? (resultData.questions as LooseRecord[])
    : [];
  const strongTopics = extractTopicLabels(resultData.strong_chapters);
  const weakTopics = extractTopicLabels(resultData.weak_chapters);
  const aiRecommendation = (resultData.ai_recommendation as LooseRecord) || {};
  const priorityTopics = Array.isArray(aiRecommendation.priority_topics)
    ? (aiRecommendation.priority_topics as unknown[]).filter(Boolean).map(String)
    : [];
  const chapterPerformance = buildChapterPerformance(questions);
  const totalMarks =
    normalizeNumber(studentInfo.total_marks) ||
    chapterPerformance.reduce((sum, chapter) => sum + chapter.maxScore, 0);
  const score =
    normalizeNumber(resultData.total_scored) ||
    chapterPerformance.reduce((sum, chapter) => sum + chapter.score, 0);
  const percentage =
    typeof resultData.percentage === "number"
      ? resultData.percentage
      : totalMarks > 0
        ? Number(((score / totalMarks) * 100).toFixed(2))
        : 0;
  const suggestedGoal = (aiRecommendation.suggested_goal as string) || null;
  const feedback = buildFeedback({
    resultData,
    percentage,
    suggestedGoal,
    weakTopics,
    priorityTopics,
  });

  return {
    examName:
      (examMeta?.name as string) ||
      (studentInfo.exam_type
        ? `${studentInfo.exam_type as string} Result`
        : `Exam ${examId ?? ""}`),
    subject:
      (studentInfo.subject as string) || (examMeta?.subject as string) || "Unknown Subject",
    score,
    totalMarks,
    percentage,
    feedback,
    chapters: chapterPerformance,
    strongTopics: strongTopics.slice(0, 6),
    weakTopics: (weakTopics.length > 0 ? weakTopics : priorityTopics).slice(0, 6),
    suggestedGoal,
    needsManualReview: Boolean(resultData.needs_manual_review),
    insights: buildInsights({
      strongTopics,
      weakTopics,
      priorityTopics,
      suggestedGoal,
      comparisonWithHistory: resultData.comparison_with_history as LooseRecord | undefined,
      percentage,
    }),
  };
}

function buildChapterPerformance(questions: LooseRecord[]): ChapterPerformance[] {
  const chapterMap = new Map<string, ChapterPerformance>();

  for (const question of questions) {
    const chapterName =
      (question.chapter_name as string) ||
      (question.chapter as string) ||
      `Question ${(question.question_no as number) || chapterMap.size + 1}`;
    const marksAvailable = normalizeNumber(question.marks_available);
    const marksScored = normalizeNumber(question.marks_scored);
    const currentChapter = chapterMap.get(chapterName) || {
      name: chapterName,
      score: 0,
      maxScore: 0,
    };

    currentChapter.score += marksScored;
    currentChapter.maxScore += marksAvailable;
    chapterMap.set(chapterName, currentChapter);
  }

  return [...chapterMap.values()].sort((left, right) => right.maxScore - left.maxScore);
}

function buildFeedback({
  resultData,
  percentage,
  suggestedGoal,
  weakTopics,
  priorityTopics,
}: {
  resultData: LooseRecord;
  percentage: number;
  suggestedGoal: string | null;
  weakTopics: string[];
  priorityTopics: string[];
}): string {
  const historyFeedback = String(resultData.history_feedback || "").trim();

  if (historyFeedback) {
    return historyFeedback;
  }

  const focusTopics = weakTopics.length > 0 ? weakTopics : priorityTopics;

  if (focusTopics.length > 0 && suggestedGoal) {
    return `You scored ${percentage}%. Focus next on ${formatTopicList(
      focusTopics,
    )} to work toward ${suggestedGoal}.`;
  }

  if (focusTopics.length > 0) {
    return `You scored ${percentage}%. Focus next on ${formatTopicList(
      focusTopics,
    )} before the next exam.`;
  }

  return `You scored ${percentage}%. Keep revising consistently and build on your current progress.`;
}

function buildInsights({
  strongTopics,
  weakTopics,
  priorityTopics,
  suggestedGoal,
  comparisonWithHistory,
  percentage,
}: {
  strongTopics: string[];
  weakTopics: string[];
  priorityTopics: string[];
  suggestedGoal: string | null;
  comparisonWithHistory?: LooseRecord;
  percentage: number;
}): string[] {
  const insights: string[] = [];
  const improvedTopics = extractComparisonTopics(comparisonWithHistory?.improved_topics);
  const declinedTopics = extractComparisonTopics(comparisonWithHistory?.declined_topics);

  if (strongTopics.length > 0) {
    insights.push(`You are performing best in ${formatTopicList(strongTopics, 2)}.`);
  }

  if (weakTopics.length > 0) {
    insights.push(`The next revision should focus on ${formatTopicList(weakTopics)}.`);
  } else if (priorityTopics.length > 0) {
    insights.push(`Your priority topics are ${formatTopicList(priorityTopics)}.`);
  }

  if (improvedTopics.length > 0) {
    insights.push(`Improvement is visible in ${formatTopicList(improvedTopics)}.`);
  }

  if (declinedTopics.length > 0) {
    insights.push(`Spend extra time on ${formatTopicList(declinedTopics)}.`);
  }

  if (suggestedGoal) {
    insights.push(`A realistic next target is ${suggestedGoal}.`);
  } else {
    insights.push(`Your current result stands at ${percentage}%.`);
  }

  return insights.slice(0, 4);
}

function extractTopicLabels(chapters: unknown): string[] {
  if (!Array.isArray(chapters)) {
    return [];
  }

  return (chapters as LooseRecord[])
    .flatMap((chapter) => {
      const chapterName = String(chapter?.chapter_name || chapter?.chapter || "").trim();
      const subTopics = Array.isArray(chapter?.sub_topics)
        ? (chapter.sub_topics as unknown[]).filter(Boolean).map(String)
        : [];

      if (!chapterName && subTopics.length === 0) {
        return [];
      }

      if (subTopics.length === 0) {
        return [chapterName];
      }

      return subTopics.map((subTopic) => `${chapterName} - ${subTopic}`);
    })
    .filter(Boolean);
}

function extractComparisonTopics(topics: unknown): string[] {
  if (!Array.isArray(topics)) {
    return [];
  }

  return (topics as unknown[])
    .map((topic) => {
      if (typeof topic === "string") {
        return topic.trim();
      }

      const t = topic as LooseRecord;
      const chapterName = String(t?.chapter_name || t?.chapter || t?.name || "").trim();
      const subTopicName = String(t?.sub_topic || t?.subtopic || t?.topic || "").trim();

      if (chapterName && subTopicName) {
        return `${chapterName} - ${subTopicName}`;
      }

      return chapterName || subTopicName;
    })
    .filter(Boolean);
}

function formatTopicList(topics: string[], maxItems = 3): string {
  const uniqueTopics = [...new Set(topics)].slice(0, maxItems);

  if (uniqueTopics.length === 0) {
    return "your key topics";
  }

  if (uniqueTopics.length === 1) {
    return uniqueTopics[0];
  }

  if (uniqueTopics.length === 2) {
    return `${uniqueTopics[0]} and ${uniqueTopics[1]}`;
  }

  return `${uniqueTopics.slice(0, -1).join(", ")}, and ${uniqueTopics.at(-1)}`;
}

function normalizeGoalSelection(goalValue?: string | null): number | null {
  const parsedGoal = Number.parseInt(String(goalValue || "").replace("%", ""), 10);

  if (!Number.isInteger(parsedGoal)) {
    return null;
  }

  return parsedGoal;
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
