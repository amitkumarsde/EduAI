import { callGeminiText } from "./geminiService.js";
import { getPracticeQuizContext } from "./dbService.js";
import type { ChapterSummary } from "../models/Exam.js";
import type { PracticeQuizContext } from "./dbService.js";
import type { Types } from "mongoose";

const DEFAULT_QUESTION_COUNT = 10;
const MIN_QUESTION_COUNT = 5;
const MAX_QUESTION_COUNT = 20;

export interface PracticeQuizQuestion {
  question_no: number;
  focus_chapter: string | null;
  focus_sub_topic: string | null;
  question_text: string;
  options: string[];
  correct_option: string;
  explanation: string | null;
}

export interface PracticeQuizResult {
  quiz_info: {
    title: string;
    subject: string;
    class: string;
    difficulty: string;
    question_count: number;
    generated_for: string;
    generated_at: Date;
    based_on_weak_chapters: ChapterSummary[];
  };
  questions: PracticeQuizQuestion[];
}

/**
 * Generate a practice quiz for weak topics.
 * Fetches all required context from database using student_id.
 */
export async function generatePracticeQuiz({
  student_id,
  subject,
  questionCount = DEFAULT_QUESTION_COUNT,
  difficulty = "adaptive",
  language = "English",
}: {
  student_id: Types.ObjectId | string;
  subject: string;
  questionCount?: number;
  difficulty?: string;
  language?: string;
}): Promise<PracticeQuizResult> {
  if (!student_id || !subject) {
    throw new Error("student_id and subject are required");
  }

  // Fetch all context from database
  const practiceContext = await getPracticeQuizContext({
    student_id,
    subject,
  });

  if (!practiceContext) {
    throw new Error("Student or subject history not found");
  }

  // When there is no recorded weakness yet, fall back to a general subject
  // quiz instead of dead-ending the student with an error.
  const weakChapters =
    practiceContext.weak_chapters && practiceContext.weak_chapters.length
      ? practiceContext.weak_chapters
      : [];

  // Generate quiz with fetched context
  return _generatePracticeQuizFromContext({
    student: practiceContext.student,
    subject: practiceContext.subject,
    weakChapters,
    priorityTopics: practiceContext.priority_topics,
    latestExam: practiceContext.latest_exam,
    questionCount,
    difficulty,
    language,
  });
}

type PracticeStudent = PracticeQuizContext["student"];
type PracticeLatestExam = PracticeQuizContext["latest_exam"];

/**
 * Internal function: Generate quiz from pre-fetched context
 */
async function _generatePracticeQuizFromContext({
  student,
  subject,
  weakChapters,
  priorityTopics,
  latestExam,
  questionCount = DEFAULT_QUESTION_COUNT,
  difficulty = "adaptive",
  language = "English",
}: {
  student: PracticeStudent;
  subject: string;
  weakChapters: ChapterSummary[];
  priorityTopics: string[];
  latestExam: PracticeLatestExam;
  questionCount?: number;
  difficulty?: string;
  language?: string;
}): Promise<PracticeQuizResult> {
  const normalizedQuestionCount = normalizeQuestionCount(questionCount);
  const normalizedDifficulty = normalizeDifficulty(difficulty);

  let lastValidationError = "Unknown validation error";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const prompt = buildPracticeQuizPrompt({
      student,
      subject,
      weakChapters,
      priorityTopics,
      latestExam,
      questionCount: normalizedQuestionCount,
      difficulty: normalizedDifficulty,
      language,
      attempt,
      lastValidationError: attempt > 1 ? lastValidationError : null,
    });

    const quizJSON = await callGeminiText({ prompt });
    const validationErrors = validatePracticeQuiz(
      quizJSON,
      normalizedQuestionCount,
    );

    if (!validationErrors.length) {
      return normalizePracticeQuiz({
        quizJSON,
        student,
        subject,
        weakChapters,
        questionCount: normalizedQuestionCount,
        difficulty: normalizedDifficulty,
      });
    }

    lastValidationError = validationErrors.join("; ");
  }

  throw new Error(
    `Could not generate a valid practice quiz. Last validation errors: ${lastValidationError}`,
  );
}

function buildPracticeQuizPrompt({
  student,
  subject,
  weakChapters,
  priorityTopics,
  latestExam,
  questionCount,
  difficulty,
  language,
  attempt,
  lastValidationError,
}: {
  student: PracticeStudent;
  subject: string;
  weakChapters: ChapterSummary[];
  priorityTopics: string[];
  latestExam: PracticeLatestExam;
  questionCount: number;
  difficulty: string;
  language: string;
  attempt: number;
  lastValidationError: string | null;
}): string {
  const focusInstruction = weakChapters.length
    ? "Every question must focus on the student's weak areas first"
    : "No weakness data is recorded yet — generate a balanced general practice quiz covering core chapters of the subject for this class";
  return `
    You are an expert school teacher creating a remedial MCQ practice quiz.

    Student details:
    - Name: ${student.name}
    - Class: ${student.class}
    - School: ${student.school}
    - Subject: ${subject}
    - Difficulty: ${difficulty}
    - Total MCQs required: ${questionCount}

    Weak chapters and sub-topics to target:
    ${JSON.stringify(weakChapters)}

    Priority topics from latest exam analysis:
    ${JSON.stringify(priorityTopics)}

    Latest exam context:
    ${JSON.stringify(latestExam)}

    Attempt number: ${attempt}
    ${
      lastValidationError
        ? `Previous output failed validation for this reason: ${lastValidationError}`
        : ""
    }

    Strict rules:
    - Generate exactly ${questionCount} MCQs
    - ${focusInstruction}
    - Prioritize weak sub-topics when they are available
    - Questions must be school-level and class-appropriate
    - Write every question, option, and explanation in ${language}
    - Keep the quiz useful for practice before the next exam
    - Each question must have exactly 4 options
    - Only one correct option per question
    - No duplicate questions
    - No overly tricky Olympiad-style questions
    - No explanations outside JSON

    Return ONLY a valid JSON object:
    {
      "quiz_info": {
        "title": "Weak Topic Practice Quiz",
        "subject": "${subject}",
        "class": "${student.class}",
        "difficulty": "${difficulty}",
        "question_count": ${questionCount}
      },
      "questions": [
        {
          "question_no": 1,
          "focus_chapter": "chapter name",
          "focus_sub_topic": "sub-topic name or null",
          "question_text": "question text",
          "options": ["option 1", "option 2", "option 3", "option 4"],
          "correct_option": "A",
          "explanation": "short explanation"
        }
      ]
    }

    correct_option must be one of: "A", "B", "C", "D"
  `;
}

function validatePracticeQuiz(
  quizJSON: any,
  expectedQuestionCount: number,
): string[] {
  const errors: string[] = [];

  if (!quizJSON || typeof quizJSON !== "object") {
    return ["Quiz response is not a JSON object"];
  }

  if (!Array.isArray(quizJSON.questions)) {
    return ["Quiz response does not contain questions array"];
  }

  if (quizJSON.questions.length !== expectedQuestionCount) {
    errors.push(
      `Expected ${expectedQuestionCount} questions but got ${quizJSON.questions.length}`,
    );
  }

  for (const [index, question] of quizJSON.questions.entries()) {
    if (!question?.question_text) {
      errors.push(`Question ${index + 1} is missing question_text`);
    }

    if (!Array.isArray(question?.options) || question.options.length !== 4) {
      errors.push(`Question ${index + 1} must contain exactly 4 options`);
    }

    if (!["A", "B", "C", "D"].includes(question?.correct_option)) {
      errors.push(
        `Question ${index + 1} has invalid correct_option ${question?.correct_option}`,
      );
    }
  }

  return errors;
}

function normalizePracticeQuiz({
  quizJSON,
  student,
  subject,
  weakChapters,
  questionCount,
  difficulty,
}: {
  quizJSON: any;
  student: PracticeStudent;
  subject: string;
  weakChapters: ChapterSummary[];
  questionCount: number;
  difficulty: string;
}): PracticeQuizResult {
  return {
    quiz_info: {
      title: quizJSON?.quiz_info?.title || "Weak Topic Practice Quiz",
      subject,
      class: student.class,
      difficulty,
      question_count: questionCount,
      generated_for: student.name,
      generated_at: new Date(),
      based_on_weak_chapters: weakChapters,
    },
    questions: quizJSON.questions.map((question: any, index: number) => ({
      question_no: index + 1,
      focus_chapter: question.focus_chapter || null,
      focus_sub_topic: question.focus_sub_topic || null,
      question_text: question.question_text,
      options: question.options,
      correct_option: question.correct_option,
      explanation: question.explanation || null,
    })),
  };
}

function normalizeQuestionCount(questionCount: unknown): number {
  const parsedQuestionCount = Number.parseInt(String(questionCount), 10);

  if (Number.isNaN(parsedQuestionCount)) {
    return DEFAULT_QUESTION_COUNT;
  }

  return Math.min(
    MAX_QUESTION_COUNT,
    Math.max(MIN_QUESTION_COUNT, parsedQuestionCount),
  );
}

function normalizeDifficulty(difficulty: unknown): string {
  const normalizedDifficulty = String(difficulty || "adaptive")
    .trim()
    .toLowerCase();

  if (["easy", "medium", "hard", "adaptive"].includes(normalizedDifficulty)) {
    return normalizedDifficulty;
  }

  return "adaptive";
}
