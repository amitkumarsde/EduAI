import type { Request, Response } from "express";
import {
  saveCompletedAttempt,
  upsertProgressAttempt,
  getAttemptHistory,
  getAttemptById,
  type IncomingQuestion,
  type IncomingSelection,
} from "../services/quizAttemptService.js";
import type { QuizAttemptSource, QuizAttemptStatus } from "../models/QuizAttempt.js";

/**
 * Resolve the student id for the request: an explicit body value wins (a
 * teacher acting on a roster student), otherwise the authenticated student's
 * own linked profile.
 */
function resolveStudentId(req: Request): string | null {
  const fromBody = req.body?.student_id ? String(req.body.student_id) : null;
  if (fromBody) return fromBody;
  const linked = req.user?.student_id;
  return linked ? String(linked) : null;
}

/**
 * POST /api/v1/quiz/attempts
 * Persist a completed, graded quiz attempt.
 */
export async function submitQuizAttempt(req: Request, res: Response) {
  try {
    const student_id = resolveStudentId(req);
    if (!student_id) {
      return res
        .status(400)
        .json({ success: false, message: "A student_id is required." });
    }

    const questions = (req.body?.questions || []) as IncomingQuestion[];
    const selections = (req.body?.selections || []) as IncomingSelection[];
    if (!Array.isArray(questions) || !questions.length) {
      return res
        .status(400)
        .json({ success: false, message: "questions are required." });
    }

    const attempt = await saveCompletedAttempt({
      student_id,
      subject: String(req.body?.subject || "General"),
      source: (req.body?.source || "practice") as QuizAttemptSource,
      title: req.body?.title ? String(req.body.title) : undefined,
      difficulty: req.body?.difficulty ? String(req.body.difficulty) : undefined,
      language: req.body?.language ? String(req.body.language) : undefined,
      questions,
      selections,
      timeSpentSeconds: Number(req.body?.time_spent_seconds || 0),
      syncedFromOffline: Boolean(req.body?.synced_from_offline),
    });

    return res.status(201).json({ success: true, data: attempt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("submitQuizAttempt error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/**
 * POST /api/v1/quiz/attempts/progress
 * Create or update a paused / in-progress attempt (pause-resume).
 */
export async function saveQuizProgress(req: Request, res: Response) {
  try {
    const student_id = resolveStudentId(req);
    if (!student_id) {
      return res
        .status(400)
        .json({ success: false, message: "A student_id is required." });
    }

    const attempt = await upsertProgressAttempt({
      attemptId: req.body?.attempt_id ? String(req.body.attempt_id) : null,
      student_id,
      subject: String(req.body?.subject || "General"),
      source: (req.body?.source || "practice") as QuizAttemptSource,
      title: req.body?.title ? String(req.body.title) : undefined,
      difficulty: req.body?.difficulty ? String(req.body.difficulty) : undefined,
      language: req.body?.language ? String(req.body.language) : undefined,
      questions: (req.body?.questions || []) as IncomingQuestion[],
      selections: (req.body?.selections || []) as IncomingSelection[],
      currentIndex: Number(req.body?.current_index || 0),
      timeSpentSeconds: Number(req.body?.time_spent_seconds || 0),
      status: (req.body?.status === "in_progress" ? "in_progress" : "paused"),
    });

    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("saveQuizProgress error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/**
 * GET /api/v1/quiz/attempts?student_id=&status=
 * List quiz attempts for a student (history + resumable sessions).
 */
export async function listQuizAttempts(req: Request, res: Response) {
  try {
    const student_id =
      (req.query?.student_id ? String(req.query.student_id) : null) ||
      (req.user?.student_id ? String(req.user.student_id) : null);
    if (!student_id) {
      return res
        .status(400)
        .json({ success: false, message: "A student_id is required." });
    }

    const status = req.query?.status
      ? (String(req.query.status) as QuizAttemptStatus)
      : undefined;

    const attempts = await getAttemptHistory(student_id, { status });
    return res.status(200).json({ success: true, data: attempts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("listQuizAttempts error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/**
 * GET /api/v1/quiz/attempts/:attemptId?student_id=
 */
export async function getQuizAttempt(req: Request, res: Response) {
  try {
    const student_id =
      (req.query?.student_id ? String(req.query.student_id) : null) ||
      (req.user?.student_id ? String(req.user.student_id) : null);
    if (!student_id) {
      return res
        .status(400)
        .json({ success: false, message: "A student_id is required." });
    }

    const attempt = await getAttemptById(String(req.params.attemptId), student_id);
    if (!attempt) {
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found." });
    }
    return res.status(200).json({ success: true, data: attempt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("getQuizAttempt error:", error);
    return res.status(500).json({ success: false, message });
  }
}
