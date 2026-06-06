import type { Request, Response } from "express";
import { computeStudentInsights } from "../services/insightsService.js";

/**
 * GET /api/v1/students/:studentId/insights
 * Predictive risk analysis & early-warning alerts for a student.
 */
export async function getStudentInsights(req: Request, res: Response) {
  try {
    const data = await computeStudentInsights(String(req.params.studentId));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    console.error("Insights error:", error);
    return res
      .status(err.statusCode || 500)
      .json({ success: false, message: err.message });
  }
}
