// services/quizAttemptService.ts
//
// Scores and persists quiz attempts (practice / adaptive / offline-synced),
// and powers pause/resume and history. Grading is deterministic (no AI calls):
// a selected option is correct iff it matches the question's correct_option.

import QuizAttempt, {
  type AttemptQuestion,
  type AttemptResponse,
  type IQuizAttempt,
  type QuizAttemptDocument,
  type QuizAttemptSource,
  type QuizAttemptStatus,
} from "../models/QuizAttempt.js";
import type { Types } from "mongoose";

export interface IncomingQuestion {
  question_no?: number;
  question_text?: string;
  options?: string[];
  correct_option?: string;
  focus_chapter?: string | null;
  focus_sub_topic?: string | null;
  explanation?: string | null;
  marks?: number;
}

export interface IncomingSelection {
  question_no: number;
  selected_option: string | null;
}

function normalizeQuestions(rawQuestions: IncomingQuestion[]): AttemptQuestion[] {
  return (rawQuestions || []).map((question, index) => ({
    question_no: Number(question.question_no ?? index + 1),
    question_text: String(question.question_text ?? ""),
    options: Array.isArray(question.options) ? question.options.map(String) : [],
    correct_option: String(question.correct_option ?? "").trim().toUpperCase(),
    focus_chapter: question.focus_chapter ?? null,
    focus_sub_topic: question.focus_sub_topic ?? null,
    explanation: question.explanation ?? null,
    marks: Number.isFinite(Number(question.marks)) ? Number(question.marks) : 1,
  }));
}

/**
 * Grade a set of questions against the student's selections.
 * Returns the responses plus aggregate scoring.
 */
export function gradeAttempt(
  questions: AttemptQuestion[],
  selections: IncomingSelection[],
): {
  responses: AttemptResponse[];
  correctCount: number;
  scoredMarks: number;
  totalMarks: number;
  percentage: number;
} {
  const selectionByQuestion = new Map<number, string | null>();
  for (const selection of selections || []) {
    selectionByQuestion.set(
      Number(selection.question_no),
      selection.selected_option
        ? String(selection.selected_option).trim().toUpperCase()
        : null,
    );
  }

  let correctCount = 0;
  let scoredMarks = 0;
  let totalMarks = 0;

  const responses: AttemptResponse[] = questions.map((question) => {
    const selected = selectionByQuestion.get(question.question_no) ?? null;
    const isCorrect = Boolean(selected) && selected === question.correct_option;
    const marks = question.marks || 1;
    totalMarks += marks;
    if (isCorrect) {
      correctCount += 1;
      scoredMarks += marks;
    }
    return {
      question_no: question.question_no,
      selected_option: selected,
      is_correct: isCorrect,
      marks_scored: isCorrect ? marks : 0,
    };
  });

  const percentage = totalMarks > 0 ? Math.round((scoredMarks / totalMarks) * 1000) / 10 : 0;

  return { responses, correctCount, scoredMarks, totalMarks, percentage };
}

/**
 * Persist a completed (graded) quiz attempt.
 */
export async function saveCompletedAttempt({
  student_id,
  subject,
  source = "practice",
  title = "Practice Quiz",
  difficulty = "adaptive",
  language = "English",
  questions,
  selections,
  timeSpentSeconds = 0,
  syncedFromOffline = false,
}: {
  student_id: Types.ObjectId | string;
  subject: string;
  source?: QuizAttemptSource;
  title?: string;
  difficulty?: string;
  language?: string;
  questions: IncomingQuestion[];
  selections: IncomingSelection[];
  timeSpentSeconds?: number;
  syncedFromOffline?: boolean;
}): Promise<QuizAttemptDocument> {
  if (!student_id) throw new Error("student_id is required");

  const normalizedQuestions = normalizeQuestions(questions);
  if (!normalizedQuestions.length) {
    throw new Error("At least one question is required to save an attempt");
  }

  const { responses, correctCount, scoredMarks, totalMarks, percentage } =
    gradeAttempt(normalizedQuestions, selections);

  const attempt = await QuizAttempt.create({
    student_id,
    subject,
    source,
    title,
    difficulty,
    language,
    status: "completed",
    questions: normalizedQuestions,
    responses,
    current_index: normalizedQuestions.length,
    total_questions: normalizedQuestions.length,
    correct_count: correctCount,
    total_marks: totalMarks,
    scored_marks: scoredMarks,
    percentage,
    time_spent_seconds: Math.max(0, Math.round(timeSpentSeconds)),
    synced_from_offline: syncedFromOffline,
    completed_at: new Date(),
  });

  return attempt;
}

/**
 * Create or update an in-progress / paused attempt (for pause-resume).
 * If attemptId is provided the existing doc is updated; otherwise a new
 * in-progress attempt is created.
 */
export async function upsertProgressAttempt({
  attemptId,
  student_id,
  subject,
  source = "practice",
  title = "Practice Quiz",
  difficulty = "adaptive",
  language = "English",
  questions,
  selections,
  currentIndex = 0,
  timeSpentSeconds = 0,
  status = "paused",
}: {
  attemptId?: string | null;
  student_id: Types.ObjectId | string;
  subject: string;
  source?: QuizAttemptSource;
  title?: string;
  difficulty?: string;
  language?: string;
  questions: IncomingQuestion[];
  selections: IncomingSelection[];
  currentIndex?: number;
  timeSpentSeconds?: number;
  status?: Extract<QuizAttemptStatus, "in_progress" | "paused">;
}): Promise<QuizAttemptDocument> {
  const normalizedQuestions = normalizeQuestions(questions);
  const { responses, correctCount, scoredMarks, totalMarks, percentage } =
    gradeAttempt(normalizedQuestions, selections);

  const update = {
    student_id,
    subject,
    source,
    title,
    difficulty,
    language,
    status,
    questions: normalizedQuestions,
    responses,
    current_index: currentIndex,
    total_questions: normalizedQuestions.length,
    correct_count: correctCount,
    total_marks: totalMarks,
    scored_marks: scoredMarks,
    percentage,
    time_spent_seconds: Math.max(0, Math.round(timeSpentSeconds)),
    completed_at: null,
  };

  if (attemptId) {
    const existing = await QuizAttempt.findOneAndUpdate(
      { _id: attemptId, student_id },
      { $set: update },
      { new: true },
    );
    if (existing) return existing;
  }

  return QuizAttempt.create(update as Partial<IQuizAttempt>);
}

/**
 * List a student's attempts, most recent first.
 */
export async function getAttemptHistory(
  student_id: Types.ObjectId | string,
  options: { status?: QuizAttemptStatus; limit?: number } = {},
): Promise<QuizAttemptDocument[]> {
  const query: Record<string, unknown> = { student_id };
  if (options.status) query.status = options.status;
  return QuizAttempt.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(100, options.limit ?? 50));
}

export async function getAttemptById(
  attemptId: string,
  student_id: Types.ObjectId | string,
): Promise<QuizAttemptDocument | null> {
  return QuizAttempt.findOne({ _id: attemptId, student_id });
}
