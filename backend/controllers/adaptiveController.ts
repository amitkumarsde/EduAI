import type { Request, Response } from "express";
import { generateAdaptiveQuestion } from "../services/adaptiveService.js";

/**
 * POST /api/v1/adaptive/next
 * Body: { subject, difficulty?, asked?: [questionText] }
 * Returns the next adaptive question at the requested difficulty.
 */
export async function getNextAdaptiveQuestion(req: Request, res: Response) {
  try {
    const subject = String(req.body?.subject || "").trim();
    if (!subject) {
      return res
        .status(400)
        .json({ success: false, message: "Subject is required." });
    }

    const difficulty = req.body?.difficulty || "medium";
    const asked = Array.isArray(req.body?.asked) ? req.body.asked : [];

    const question = await generateAdaptiveQuestion({
      studentId: req.user?.student_id || null,
      studentName: req.user?.name || null,
      studentClass: req.user?.class || null,
      subject,
      difficulty,
      askedQuestions: asked,
    });

    return res.status(200).json({ success: true, data: question });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Adaptive question error:", error);
    return res.status(500).json({ success: false, message });
  }
}
