import { callGeminiText } from "./geminiService.js";
import { getPracticeQuizContext } from "./dbService.js";
import type { Types } from "mongoose";

const ALLOWED_DIFFICULTY = new Set(["easy", "medium", "hard"]);

export interface AdaptiveQuestion {
  question_text: string;
  options: string[];
  correct_option: string;
  explanation: string;
  focus_topic: string;
  difficulty: string;
}

/**
 * Generate a single adaptive MCQ for a subject at a target difficulty.
 *
 * The caller (frontend) decides the next difficulty from the student's running
 * accuracy; this service just produces one well-formed question, biased toward
 * the student's weak chapters when performance history is available.
 */
export async function generateAdaptiveQuestion({
  studentId,
  studentName,
  studentClass,
  subject,
  difficulty = "medium",
  askedQuestions = [],
}: {
  studentId?: Types.ObjectId | string | null;
  studentName?: string | null;
  studentClass?: string | null;
  subject: string;
  difficulty?: string;
  askedQuestions?: string[];
}): Promise<AdaptiveQuestion> {
  const normalizedSubject = String(subject || "").trim();
  if (!normalizedSubject) {
    throw new Error("Subject is required.");
  }

  const level = ALLOWED_DIFFICULTY.has(difficulty) ? difficulty : "medium";

  // Pull weak-topic context if we have a student (best effort).
  let weakTopics: string[] = [];
  let resolvedClass = studentClass || "Class 10";
  if (studentId || studentName) {
    try {
      const context = await getPracticeQuizContext({
        student_id: studentId,
        student_name: studentName,
        class: studentClass,
        subject: normalizedSubject,
      });
      if (context) {
        resolvedClass = context.student?.class || resolvedClass;
        weakTopics = (context.weak_chapters || [])
          .map((chapter) => chapter.chapter_name)
          .filter(Boolean)
          .slice(0, 6);
      }
    } catch {
      // No history is fine — fall back to generic questions.
    }
  }

  const avoidList = askedQuestions
    .slice(-12)
    .map((text, index) => `${index + 1}. ${String(text).slice(0, 120)}`)
    .join("\n");

  const prompt = `You are an exam question generator. Produce exactly ONE multiple-choice question.

Subject: ${normalizedSubject}
Target class level: ${resolvedClass}
Difficulty: ${level}
${weakTopics.length ? `Prefer these weak topics when sensible: ${weakTopics.join(", ")}.` : ""}
${avoidList ? `Do NOT repeat or closely paraphrase any of these already-asked questions:\n${avoidList}` : ""}

Rules:
- Exactly 4 options.
- "correct_option" must be one of "A", "B", "C", "D".
- Keep it factually correct and unambiguous.
- "explanation" should be 1-2 sentences explaining the correct answer.

Return ONLY valid JSON (no markdown) in this shape:
{
  "question_text": "string",
  "options": ["string", "string", "string", "string"],
  "correct_option": "A",
  "explanation": "string",
  "focus_topic": "string",
  "difficulty": "${level}"
}`;

  const result = await callGeminiText({ prompt });

  // Validate shape.
  const options = Array.isArray(result?.options) ? result.options.slice(0, 4) : [];
  const correct = String(result?.correct_option || "").trim().toUpperCase();
  if (
    !result?.question_text ||
    options.length !== 4 ||
    !["A", "B", "C", "D"].includes(correct)
  ) {
    throw new Error("AI returned an invalid question. Please try again.");
  }

  return {
    question_text: String(result.question_text),
    options: options.map((option: unknown) => String(option)),
    correct_option: correct,
    explanation: result.explanation ? String(result.explanation) : "",
    focus_topic: result.focus_topic ? String(result.focus_topic) : normalizedSubject,
    difficulty: level,
  };
}

export default generateAdaptiveQuestion;
