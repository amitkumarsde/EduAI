import type { Request, Response } from "express";
import { generatePracticeQuiz } from "../services/practiceQuizService.js";

export async function generateWeakTopicPracticeQuiz(req: Request, res: Response) {
  try {
    const { student_id, subject, question_count, difficulty, language } = req.body || {};

    if (!student_id || !subject) {
      return res.status(400).json({
        success: false,
        message: "student_id and subject are required",
      });
    }

    const quiz = await generatePracticeQuiz({
      student_id,
      subject,
      questionCount: question_count,
      difficulty,
      language: language ? String(language) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in generateWeakTopicPracticeQuiz:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}
