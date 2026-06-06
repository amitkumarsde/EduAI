import type { Request, Response } from "express";
import { askTutor } from "../services/tutorService.js";

/**
 * POST /api/v1/tutor/ask
 * Body: { message, subject?, history?: [{role, content}] }
 * studentId is taken from the authenticated user when available.
 */
export async function askTutorQuestion(req: Request, res: Response) {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter a question." });
    }

    const subject = req.body?.subject ? String(req.body.subject) : null;
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const studentId = req.user?.student_id || req.body?.student_id || null;
    const language = req.body?.language ? String(req.body.language) : "English";

    const result = await askTutor({ studentId, subject, message, history, language });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Tutor error:", error);
    return res.status(500).json({ success: false, message });
  }
}
