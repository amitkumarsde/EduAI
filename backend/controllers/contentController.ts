import type { Request, Response } from "express";
import { getContentRecommendations } from "../services/contentService.js";

/**
 * POST /api/v1/content/recommendations
 * Body: { student_id?, subject, weak_topics?, class?, language? }
 */
export async function fetchContentRecommendations(req: Request, res: Response) {
  try {
    const subject = String(req.body?.subject || "").trim();
    if (!subject) {
      return res.status(400).json({ success: false, message: "subject is required." });
    }

    const data = await getContentRecommendations({
      studentId: req.body?.student_id || req.user?.student_id || null,
      subject,
      weakTopics: Array.isArray(req.body?.weak_topics)
        ? req.body.weak_topics.map(String)
        : undefined,
      studentClass: req.body?.class ? String(req.body.class) : undefined,
      language: req.body?.language ? String(req.body.language) : "English",
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("fetchContentRecommendations error:", error);
    return res.status(500).json({ success: false, message });
  }
}
