import type { Request, Response } from "express";
import { gradeEssay, checkSimilarity } from "../services/gradingService.js";

/**
 * POST /api/v1/grading/essay
 * Body: { question?, essay, max_marks?, rubric?, language? }
 */
export async function gradeEssayAnswer(req: Request, res: Response) {
  try {
    const essay = String(req.body?.essay || "").trim();
    if (!essay) {
      return res.status(400).json({ success: false, message: "essay text is required." });
    }
    const result = await gradeEssay({
      question: String(req.body?.question || ""),
      essay,
      maxMarks: Number(req.body?.max_marks) > 0 ? Number(req.body.max_marks) : 10,
      rubric: Array.isArray(req.body?.rubric) ? req.body.rubric.map(String) : undefined,
      language: req.body?.language ? String(req.body.language) : "English",
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("gradeEssayAnswer error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/**
 * POST /api/v1/grading/similarity
 * Body: { submissions: [{ id, text }], threshold? }
 */
export async function checkAnswerSimilarity(req: Request, res: Response) {
  try {
    const submissions = Array.isArray(req.body?.submissions) ? req.body.submissions : [];
    const normalized = submissions
      .map((s: any, index: number) => ({
        id: String(s?.id || `Submission ${index + 1}`),
        text: String(s?.text || ""),
      }))
      .filter((s: { text: string }) => s.text.trim().length > 0);

    if (normalized.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least two non-empty submissions are required.",
      });
    }

    const threshold =
      Number(req.body?.threshold) > 0 && Number(req.body.threshold) <= 1
        ? Number(req.body.threshold)
        : 0.8;

    const result = checkSimilarity(normalized, threshold);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("checkAnswerSimilarity error:", error);
    return res.status(500).json({ success: false, message });
  }
}
