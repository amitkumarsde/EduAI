import type { Request, Response } from "express";
import { evaluateHandwrittenAnswer } from "../services/ocrService.js";

/**
 * POST /api/v1/offline/ocr   (multipart: field "image")
 * Body fields: question_text, max_marks?, language?
 *
 * Transcribes and scores a single photographed handwritten answer. The
 * frontend calls this once per uploaded image when the device is back online.
 */
export async function ocrEvaluate(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res
        .status(400)
        .json({ success: false, message: "An image file is required (field 'image')." });
    }

    const questionText = String(req.body?.question_text || "").trim();
    if (!questionText) {
      return res
        .status(400)
        .json({ success: false, message: "question_text is required." });
    }

    const maxMarks = Number(req.body?.max_marks) > 0 ? Number(req.body.max_marks) : 5;
    const language = req.body?.language ? String(req.body.language) : "English";

    const result = await evaluateHandwrittenAnswer({
      imageBuffer: file.buffer,
      mimeType: file.mimetype,
      questionText,
      maxMarks,
      language,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("ocrEvaluate error:", error);
    return res.status(500).json({ success: false, message });
  }
}
