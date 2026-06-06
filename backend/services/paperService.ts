import "../utils/loadEnv.js";
import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import { getGeminiApiKey } from "./geminiService.js";

const MAX_GENERATION_ATTEMPTS = 3;
const UT_EXAM_TYPES = new Set(["UT-1", "UT-2"]);
const TERM_EXAM_TYPES = new Set(["Mid-Term", "Final"]);
const DEFAULT_UT_TOTAL_MARKS = 25;
const DEFAULT_UT_NUM_QUESTIONS = 10;
const MIN_UT_TOTAL_MARKS = 5;
const MAX_UT_TOTAL_MARKS = 30;
const MAX_UT_SINGLE_QUESTION_MARKS = 5;
const MIN_UT_NUM_QUESTIONS = 1;
const MAX_UT_NUM_QUESTIONS = 10;
const DEFAULT_TERM_NUM_QUESTIONS = 25;

// Lazily construct the Gemini client so a missing key only fails the request
// (not module import), and so GEMINI_API_KEY works as a fallback for API_KEY.
let genAIInstance: GoogleGenerativeAI | null = null;

function getPaperModel(): GenerativeModel {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Set API_KEY or GEMINI_API_KEY before generating papers.",
    );
  }
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance.getGenerativeModel({ model: "gemini-2.5-flash" });
}

interface GenerationContext {
  subject: string;
  stdClass: string;
  examType: string;
  requestedExamType: string;
  chapters: string[];
  requestedTotalMarks: number | null;
  totalMarks: number;
  requestedNumQuestions: number | null;
  numQuestions: number;
  useBoardStyle: boolean;
  duration: string;
}

interface ValidationContext extends GenerationContext {
  isUT: boolean;
}

type PaperQuestionJSON = Record<string, any>;

interface NormalizedPaper {
  instructions: string[];
  questions: PaperQuestionJSON[];
}

export interface GeneratedQuestionPaper {
  paper_info: {
    subject: string;
    class: string;
    exam_type: string;
    total_marks: number;
    requested_total_marks: number | null;
    num_questions: number;
    requested_num_questions: number | null;
    duration: string;
    format: "pdf";
    chapters_covered: string[];
    generated_at: Date;
  };
  questions: PaperQuestionJSON[];
  instructions: string[];
}

export async function generateQuestionPaper({
  subject,
  class: stdClass,
  exam_type,
  chapters,
  total_marks,
  num_questions,
  duration,
}: {
  subject?: string;
  class?: string;
  exam_type?: string;
  chapters?: unknown;
  total_marks?: number;
  num_questions?: number;
  duration?: string;
}): Promise<GeneratedQuestionPaper> {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    throw new Error("chapters must be a non-empty array");
  }

  const normalizedExamType = normalizeExamType(exam_type);
  const isUT = UT_EXAM_TYPES.has(normalizedExamType);
  const useBoardStyle = shouldUseBoardStyleExam({
    examType: normalizedExamType,
    stdClass,
  });
  const resolvedMarks = resolveRequestedTotalMarks({
    examType: normalizedExamType,
    requestedTotalMarks: total_marks,
  });
  const resolvedNumQuestions = resolveNumQuestions({
    examType: normalizedExamType,
    requestedNumQuestions: num_questions,
    totalMarks: resolvedMarks.effective,
  });

  if (!isUT && !TERM_EXAM_TYPES.has(normalizedExamType)) {
    throw new Error(
      `Unsupported exam_type "${exam_type}". Use UT-1, UT-2, PT-1, PT-2, Mid-Term, Final, or a supported alias like "Unit Test 1".`,
    );
  }

  const model = getPaperModel();
  const generationContext: GenerationContext = {
    subject: String(subject || "").trim(),
    stdClass: String(stdClass || "").trim(),
    examType: normalizedExamType,
    requestedExamType: String(exam_type || "").trim(),
    chapters: chapters.map((chapter) => String(chapter).trim()).filter(Boolean),
    requestedTotalMarks: resolvedMarks.requested,
    totalMarks: resolvedMarks.effective,
    requestedNumQuestions: resolvedNumQuestions.requested,
    numQuestions: resolvedNumQuestions.effective,
    useBoardStyle,
    duration: resolveDuration({
      examType: normalizedExamType,
      requestedDuration: duration,
      totalMarks: resolvedMarks.effective,
    }),
  };

  const prompt = isUT
    ? buildUTPrompt(generationContext)
    : buildTermPrompt(generationContext);

  console.log(`Calling Gemini for ${normalizedExamType} paper generation...`);

  const paperJSON = await generateValidatedPaper({
    model,
    prompt,
    validationContext: generationContext,
    isUT,
  });

  return {
    paper_info: {
      subject: generationContext.subject,
      class: generationContext.stdClass,
      exam_type:
        generationContext.requestedExamType || generationContext.examType,
      total_marks: generationContext.totalMarks,
      requested_total_marks: generationContext.requestedTotalMarks,
      num_questions: generationContext.numQuestions,
      requested_num_questions: generationContext.requestedNumQuestions,
      duration: generationContext.duration,
      format: "pdf",
      chapters_covered: generationContext.chapters,
      generated_at: new Date(),
    },
    questions: stripCoverageMetadata(paperJSON.questions),
    instructions: paperJSON.instructions,
  };
}

function shouldUseBoardStyleExam({
  examType,
  stdClass,
}: {
  examType: string;
  stdClass?: string;
}): boolean {
  return examType === "Final" && [10, 12].includes(parseClassNumber(stdClass) ?? -1);
}

function parseClassNumber(stdClass?: string): number | null {
  const rawValue = String(stdClass || "").trim();
  const digitMatch = rawValue.match(/\d+/);

  if (digitMatch) {
    return Number(digitMatch[0]);
  }

  const romanValue = rawValue.toUpperCase().replace(/CLASS\s*/g, "");
  const romanMap: Record<string, number> = {
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
    XI: 11,
    XII: 12,
  };

  return romanMap[romanValue] || null;
}

function normalizeExamType(examType?: string): string {
  const normalized = String(examType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (
    normalized === "ut-1" ||
    normalized === "ut 1" ||
    normalized === "pt-1" ||
    normalized === "pt 1" ||
    normalized === "periodic test 1" ||
    normalized === "periodic test-1" ||
    normalized === "periodic test i" ||
    normalized === "unit test 1" ||
    normalized === "unit test-1" ||
    normalized === "cycle test 1"
  ) {
    return "UT-1";
  }

  if (
    normalized === "ut-2" ||
    normalized === "ut 2" ||
    normalized === "pt-2" ||
    normalized === "pt 2" ||
    normalized === "periodic test 2" ||
    normalized === "periodic test-2" ||
    normalized === "periodic test ii" ||
    normalized === "unit test 2" ||
    normalized === "unit test-2" ||
    normalized === "cycle test 2"
  ) {
    return "UT-2";
  }

  if (
    normalized === "mid-term" ||
    normalized === "mid term" ||
    normalized === "midterm" ||
    normalized === "half yearly" ||
    normalized === "half-yearly"
  ) {
    return "Mid-Term";
  }

  if (
    normalized === "final" ||
    normalized === "final exam" ||
    normalized === "annual" ||
    normalized === "annual exam"
  ) {
    return "Final";
  }

  return String(examType || "").trim();
}

function resolveRequestedTotalMarks({
  examType,
  requestedTotalMarks,
}: {
  examType: string;
  requestedTotalMarks?: number;
}): { requested: number | null; effective: number } {
  const numericMarks = Number(requestedTotalMarks);
  const isValidNumber = Number.isFinite(numericMarks) && numericMarks > 0;

  if (UT_EXAM_TYPES.has(examType)) {
    if (!isValidNumber) {
      return {
        requested: null,
        effective: DEFAULT_UT_TOTAL_MARKS,
      };
    }

    if (
      numericMarks < MIN_UT_TOTAL_MARKS ||
      numericMarks > MAX_UT_TOTAL_MARKS
    ) {
      console.warn(
        `Requested ${numericMarks} marks for ${examType}. Normalizing to ${DEFAULT_UT_TOTAL_MARKS} marks to match common school periodic/unit test patterns.`,
      );

      return {
        requested: numericMarks,
        effective: DEFAULT_UT_TOTAL_MARKS,
      };
    }

    return {
      requested: numericMarks,
      effective: numericMarks,
    };
  }

  if (!isValidNumber) {
    throw new Error("total_marks must be a positive number");
  }

  return {
    requested: numericMarks,
    effective: numericMarks,
  };
}

function resolveDuration({
  examType,
  requestedDuration,
  totalMarks,
}: {
  examType: string;
  requestedDuration?: string;
  totalMarks: number;
}): string {
  const normalizedDuration = String(requestedDuration || "").trim();

  if (normalizedDuration) {
    return normalizedDuration;
  }

  if (UT_EXAM_TYPES.has(examType)) {
    return totalMarks <= DEFAULT_UT_TOTAL_MARKS ? "1 hour" : "1.5 hours";
  }

  return "3 hours";
}

function resolveNumQuestions({
  examType,
  requestedNumQuestions,
  totalMarks,
}: {
  examType: string;
  requestedNumQuestions?: number;
  totalMarks: number;
}): { requested: number | null; effective: number } {
  const numQuestions = Number(requestedNumQuestions);
  const isValidNumber = Number.isFinite(numQuestions) && numQuestions > 0;

  if (UT_EXAM_TYPES.has(examType)) {
    if (!isValidNumber) {
      return {
        requested: null,
        effective: DEFAULT_UT_NUM_QUESTIONS,
      };
    }

    if (
      numQuestions < MIN_UT_NUM_QUESTIONS ||
      numQuestions > MAX_UT_NUM_QUESTIONS
    ) {
      console.warn(
        `Requested ${numQuestions} questions for ${examType}. Normalizing to ${DEFAULT_UT_NUM_QUESTIONS} questions.`,
      );

      return {
        requested: numQuestions,
        effective: DEFAULT_UT_NUM_QUESTIONS,
      };
    }

    return {
      requested: numQuestions,
      effective: numQuestions,
    };
  }

  // For term exams (board-style)
  if (TERM_EXAM_TYPES.has(examType)) {
    // Board exams have a fixed structure, so we don't use this for board-style
    // But return a reasonable default based on marks
    return {
      requested: isValidNumber ? numQuestions : null,
      effective: DEFAULT_TERM_NUM_QUESTIONS,
    };
  }

  if (!isValidNumber) {
    // For other exam types, use a default based on marks
    const estimatedQuestions = Math.min(Math.ceil(totalMarks / 2), 15);
    return {
      requested: null,
      effective: estimatedQuestions,
    };
  }

  return {
    requested: numQuestions,
    effective: numQuestions,
  };
}

async function generateValidatedPaper({
  model,
  prompt,
  validationContext,
  isUT,
}: {
  model: GenerativeModel;
  prompt: string;
  validationContext: GenerationContext;
  isUT: boolean;
}): Promise<NormalizedPaper> {
  let lastErrors: string[] = [];
  let previousResponse = "";

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const promptToUse =
      attempt === 1
        ? prompt
        : buildRepairPrompt({
            originalPrompt: prompt,
            previousResponse,
            errors: lastErrors,
          });

    const result = await model.generateContent(promptToUse);
    const responseText = result.response.text();
    previousResponse = responseText;

    const parsed = parsePaperJSON(responseText);
    if (!parsed.ok) {
      lastErrors = [parsed.error];
      console.warn(
        `Paper generation attempt ${attempt} failed: ${parsed.error}`,
      );
      continue;
    }

    const normalizedPaper = normalizePaperJSON(parsed.data, {
      isUT,
      useBoardStyle: validationContext.useBoardStyle,
    });
    const errors = validateGeneratedPaper(normalizedPaper, {
      ...validationContext,
      isUT,
    });

    if (errors.length === 0) {
      console.log(
        `Paper generated successfully on attempt ${attempt}. Questions: ${normalizedPaper.questions.length}, Total marks: ${validationContext.totalMarks}/${validationContext.totalMarks}`,
      );
      return normalizedPaper;
    }

    lastErrors = errors;
    console.warn(
      `Paper generation attempt ${attempt} failed validation: ${errors.join(" | ")}`,
    );
  }

  throw new Error(
    `Could not generate a valid ${validationContext.examType} paper. Last validation errors: ${lastErrors.join("; ")}`,
  );
}

type ParsePaperResult =
  | { ok: true; data: any }
  | { ok: false; error: string };

function parsePaperJSON(responseText: string): ParsePaperResult {
  const cleaned = String(responseText || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return {
        ok: true,
        data: JSON.parse(candidate),
      };
    } catch {
      continue;
    }
  }

  return {
    ok: false,
    error: "Model response was not valid JSON.",
  };
}

function normalizePaperJSON(
  paperJSON: any,
  { isUT, useBoardStyle }: { isUT: boolean; useBoardStyle: boolean },
): NormalizedPaper {
  const instructions: string[] = Array.isArray(paperJSON?.instructions)
    ? paperJSON.instructions
        .map((instruction: unknown) => String(instruction || "").trim())
        .filter(Boolean)
    : [];

  const questions: PaperQuestionJSON[] = Array.isArray(paperJSON?.questions)
    ? paperJSON.questions.map((question: any, index: number) => {
        const marks = Number(question?.marks);
        const options = Array.isArray(question?.options)
          ? question.options
              .map((option: unknown) => String(option || "").trim())
              .filter(Boolean)
          : null;
        const choiceText =
          question?.choice_text ?? question?.choice_question_text ?? null;
        const sourceChapter = normalizeCoverageField(question?.source_chapter);
        const sourceSubTopic = normalizeCoverageField(
          question?.source_sub_topic,
        );

        const normalizedQuestion: PaperQuestionJSON = {
          ...question,
          question_no: Number(question?.question_no) || index + 1,
          marks: Number.isFinite(marks) ? marks : NaN,
          question_type: String(question?.question_type || "").trim(),
          question_text: String(question?.question_text || "").trim(),
          options: options && options.length > 0 ? options : null,
          internal_choice: Boolean(question?.internal_choice),
          choice_text: choiceText ? String(choiceText).trim() : null,
          choice_question_text: choiceText ? String(choiceText).trim() : null,
          source_chapter: sourceChapter,
          source_sub_topic: sourceSubTopic,
        };

        delete normalizedQuestion.chapter;
        delete normalizedQuestion.chapter_name;
        delete normalizedQuestion.sub_topic;
        delete normalizedQuestion.correct_option;

        if (isUT || !useBoardStyle) {
          delete normalizedQuestion.section;
        }

        if (isUT) {
          delete normalizedQuestion.case_passage;
        }

        return normalizedQuestion;
      })
    : [];

  return {
    instructions,
    questions,
  };
}

function validateGeneratedPaper(
  paperJSON: NormalizedPaper,
  context: ValidationContext,
): string[] {
  const errors: string[] = [];
  const { questions, instructions } = paperJSON;

  if (!Array.isArray(instructions) || instructions.length === 0) {
    errors.push("instructions must be a non-empty array");
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push("questions must be a non-empty array");
    return errors;
  }

  const totalMarks = questions.reduce(
    (sum, q) => sum + (Number(q.marks) || 0),
    0,
  );

  if (totalMarks !== context.totalMarks) {
    errors.push(
      `total marks mismatch: expected ${context.totalMarks}, got ${totalMarks}`,
    );
  }

  questions.forEach((question, index) => {
    const questionNumber = index + 1;

    if (question.question_no !== questionNumber) {
      errors.push(`question_no must be sequential starting from 1`);
    }

    if (!Number.isInteger(question.marks) || question.marks <= 0) {
      errors.push(`Q${questionNumber} has invalid marks. Marks must be positive whole numbers (e.g., 1, 2, 3). Decimals/fractions are NOT allowed.`);
    }

    if (!question.question_text) {
      errors.push(`Q${questionNumber} is missing question_text`);
    }

    if (
      question.question_type === "MCQ" &&
      (!Array.isArray(question.options) || question.options.length !== 4)
    ) {
      errors.push(`Q${questionNumber} is MCQ but does not have 4 options`);
    }

    if (
      question.question_type !== "MCQ" &&
      Array.isArray(question.options) &&
      question.options.length > 0
    ) {
      errors.push(`Q${questionNumber} is non-MCQ but still has options`);
    }
  });

  validateRequestedChapterCoverage(errors, questions, context.chapters);

  if (context.isUT) {
    validateUTPaper(errors, questions, context);
  } else {
    validateTermPaper(errors, questions, context);
  }

  return dedupeErrors(errors);
}

function validateUTPaper(
  errors: string[],
  questions: PaperQuestionJSON[],
  context: ValidationContext,
): void {
  const questionCount = questions.length;
  const expectedQuestions = context.numQuestions;
  const tolerance = 1; // Allow ±1 question for flexibility
  const mcqCount = questions.filter((q) => q.question_type === "MCQ").length;
  const internalChoiceCount = questions.filter((q) => q.internal_choice).length;
  const highValueQuestions = questions.filter((q) => q.marks > 5);
  const hasLongQuestion = questions.some(
    (q) => q.question_type === "long" || q.marks >= 4,
  );
  const sectionLikeQuestion = questions.find((q) => q.section);
  const chapterTaggedQuestion = questions.find(
    (q) => q.chapter || q.chapter_name || q.sub_topic,
  );
  const caseBasedQuestion = questions.find(
    (q) => q.case_passage || q.question_type === "case_based",
  );
  const questionTexts = questions.flatMap((q) =>
    [q.question_text, q.choice_text].filter(Boolean),
  ) as string[];
  const chapterLeak = findChapterLeak(questionTexts, context.chapters);
  const sectionLeak = questionTexts.find((text) =>
    /\bsection\s+[a-e]\b/i.test(text),
  );

  if (
    questionCount < expectedQuestions - tolerance ||
    questionCount > expectedQuestions + tolerance
  ) {
    errors.push(
      `UT paper must contain ${expectedQuestions} questions (±${tolerance} allowed), got ${questionCount}`,
    );
  }

  if (mcqCount > getUTMcqLimit(context.subject)) {
    errors.push("UT paper has too many MCQs");
  }

  if (internalChoiceCount > 1) {
    errors.push("UT paper has more than one internal choice");
  }

  if (!hasLongQuestion) {
    errors.push(
      "UT paper must include at least one 4-5 mark descriptive question",
    );
  }

  if (highValueQuestions.length > 1) {
    errors.push(
      "UT paper should not have more than one question above 5 marks",
    );
  }

  if (sectionLikeQuestion) {
    errors.push("UT paper must not contain sections");
  }

  if (chapterTaggedQuestion) {
    errors.push("UT paper must not expose chapter fields in output");
  }

  if (caseBasedQuestion) {
    errors.push("UT paper must not contain case-based questions");
  }

  if (chapterLeak) {
    errors.push("UT paper is leaking chapter/topic names into question text");
  }

  if (sectionLeak) {
    errors.push("UT paper question text contains board-style section labels");
  }

  if (isLanguageSubject(context.subject) && mcqCount > 1) {
    errors.push("Language subject UT paper should avoid MCQ-heavy pattern");
  }

  for (const question of questions) {
    if (question.marks > MAX_UT_SINGLE_QUESTION_MARKS) {
      errors.push(
        `UT paper must not have a question above ${MAX_UT_SINGLE_QUESTION_MARKS} marks`,
      );
    }

    if (question.marks > 5 && !isCompositeQuestion(question)) {
      errors.push(
        "Questions above 5 marks in UT papers must be composite with subparts",
      );
    }
  }
}

function validateTermPaper(
  errors: string[],
  questions: PaperQuestionJSON[],
  context: ValidationContext,
): void {
  if (!context.useBoardStyle) {
    const sectionLikeQuestion = questions.find((q) => q.section);
    const sectionLeak = questions.some((q) =>
      /\bsection\s+[a-e]\b/i.test(
        [q.question_text, q.choice_text].filter(Boolean).join(" "),
      ),
    );

    if (sectionLikeQuestion || sectionLeak) {
      errors.push(
        "School-level Mid-Term and Final papers must not contain sections",
      );
    }

    return;
  }

  const sections = questions.map((q) => q.section).filter(Boolean);
  const requiredSections = ["A", "B", "C", "D", "E"];

  for (const section of requiredSections) {
    if (!sections.includes(section)) {
      errors.push(`Missing section ${section} in term paper`);
    }
  }

  if (context.totalMarks !== 80) {
    errors.push(
      "Mid-Term and Final papers are currently designed only for 80 marks",
    );
  }
}

function dedupeErrors(errors: string[]): string[] {
  return [...new Set(errors)];
}

function validateRequestedChapterCoverage(
  errors: string[],
  questions: PaperQuestionJSON[],
  requestedChapters: string[],
): void {
  const chapterAliases = buildRequestedChapterAliasMap(requestedChapters);
  const coveredRequestedChapters = new Set<string>();
  const questionsMissingSourceChapter: string[] = [];
  const questionsWithUnknownSourceChapter: string[] = [];

  for (const question of questions) {
    const questionNumber = question.question_no || "?";
    const sourceChapter = String(question?.source_chapter || "").trim();

    if (!sourceChapter) {
      questionsMissingSourceChapter.push(`Q${questionNumber}`);
      continue;
    }

    const matchedRequestedChapter = resolveRequestedChapter(
      sourceChapter,
      chapterAliases,
    );

    if (!matchedRequestedChapter) {
      questionsWithUnknownSourceChapter.push(
        `Q${questionNumber} -> ${sourceChapter}`,
      );
      continue;
    }

    coveredRequestedChapters.add(matchedRequestedChapter);
  }

  if (questionsMissingSourceChapter.length > 0) {
    errors.push(
      `Questions missing source_chapter metadata: ${questionsMissingSourceChapter.join(", ")}`,
    );
  }

  if (questionsWithUnknownSourceChapter.length > 0) {
    errors.push(
      `Questions reference chapters outside the requested list: ${questionsWithUnknownSourceChapter.join(", ")}`,
    );
  }

  for (const requestedChapter of requestedChapters) {
    if (!coveredRequestedChapters.has(requestedChapter)) {
      errors.push(
        `Generated paper must include at least one question from "${requestedChapter}"`,
      );
    }
  }
}

function buildRequestedChapterAliasMap(
  requestedChapters: string[],
): Map<string, string> {
  const aliasMap = new Map<string, string>();

  for (const chapter of requestedChapters) {
    const canonicalChapter = String(chapter || "").trim();

    if (!canonicalChapter) {
      continue;
    }

    const aliases = [
      normalizeForComparison(canonicalChapter),
      normalizeForComparison(extractLeafChapterPhrase(canonicalChapter)),
    ].filter(Boolean);

    for (const alias of aliases) {
      if (!aliasMap.has(alias)) {
        aliasMap.set(alias, canonicalChapter);
      }
    }
  }

  return aliasMap;
}

function resolveRequestedChapter(
  sourceChapter: string,
  chapterAliases: Map<string, string>,
): string | null {
  const normalizedSourceChapter = normalizeForComparison(sourceChapter);

  if (!normalizedSourceChapter) {
    return null;
  }

  return chapterAliases.get(normalizedSourceChapter) || null;
}

function getUTMcqLimit(subject: string): number {
  return isLanguageSubject(subject) ? 1 : 3;
}

function normalizeCoverageField(value: unknown): string | null {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || null;
}

function isLanguageSubject(subject: string): boolean {
  return /(hindi|english|sanskrit|urdu|punjabi|french|german|language)/i.test(
    String(subject || ""),
  );
}

function normalizeForComparison(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findChapterLeak(
  questionTexts: string[],
  chapters: string[],
): string | null {
  const leakPhrases = extractChapterLeakPhrases(chapters);

  if (leakPhrases.length === 0) {
    return null;
  }

  for (const text of questionTexts) {
    if (!hasChapterReferenceContext(text)) {
      continue;
    }

    const normalizedText = normalizeForComparison(text);
    const matchedPhrase = leakPhrases.find((phrase) =>
      normalizedText.includes(phrase),
    );

    if (matchedPhrase) {
      return matchedPhrase;
    }
  }

  return null;
}

function extractChapterLeakPhrases(chapters: string[]): string[] {
  return chapters
    .map((chapter) => extractLeafChapterPhrase(chapter))
    .map((phrase) => normalizeForComparison(phrase))
    .filter(Boolean)
    .filter((phrase) => phrase.length >= 8)
    .filter((phrase) => phrase.split(" ").length >= 2)
    .filter((phrase) => !isGenericSkillPhrase(phrase));
}

function extractLeafChapterPhrase(chapter: string): string {
  const rawChapter = String(chapter || "").trim();
  if (!rawChapter) {
    return "";
  }

  const separatedParts = rawChapter
    .split(/\s[-:]\s|[-:]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return separatedParts.length > 1
    ? separatedParts[separatedParts.length - 1]
    : rawChapter;
}

function hasChapterReferenceContext(text: string): boolean {
  return /\b(chapter|lesson|text|topic|poem|story|prose|extract)\b|अध्याय|पाठ|कविता|कहानी|गद्य|पद्य|लेख|पाठांश/i.test(
    String(text || ""),
  );
}

function isGenericSkillPhrase(phrase: string): boolean {
  return [
    "apthit gadyansh",
    "अपठित गद्यांश",
    "पत्र लेखन",
    "अनुच्छेद लेखन",
    "शब्द और पद",
    "वाक्य भेद",
    "व्याकरण",
    "grammar",
    "writing skill",
    "writing कौशल",
    "लेखन कौशल",
  ].includes(phrase);
}

function isCompositeQuestion(question: PaperQuestionJSON): boolean {
  const combinedText = [question?.question_text, question?.choice_text]
    .filter(Boolean)
    .join("\n");

  return /(\([a-z]\)|\([ivx]+\)|\b(i|ii|iii|iv|v)\b|sub-?part|attempt any two)/i.test(
    combinedText,
  );
}

function stripCoverageMetadata(
  questions: PaperQuestionJSON[],
): PaperQuestionJSON[] {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.map((question) => {
    const sanitizedQuestion = { ...question };
    delete sanitizedQuestion.source_chapter;
    delete sanitizedQuestion.source_sub_topic;
    return sanitizedQuestion;
  });
}

function buildRepairPrompt({
  originalPrompt,
  previousResponse,
  errors,
}: {
  originalPrompt: string;
  previousResponse: string;
  errors: string[];
}): string {
  return `
You previously generated an invalid question paper.

Validation errors:
${errors.map((error, index) => `${index + 1}. ${error}`).join("\n")}

Previous invalid response:
${previousResponse}

Rewrite the full paper from scratch and fix every validation error.
Return ONLY valid raw JSON.

Original instructions:
${originalPrompt}
  `;
}

function buildUTPrompt({
  subject,
  stdClass,
  examType,
  chapters,
  totalMarks,
  numQuestions,
  duration,
}: GenerationContext): string {
  return `
You are an experienced school teacher creating a realistic school-level Unit Test paper.

First, silently infer the most likely NCERT/CBSE syllabus and textbook flow for the given class and subject.
Prefer NCERT textbooks and the CBSE-style school curriculum used in Delhi schools.
This is a school Unit Test, not a CBSE board paper.

Details:
- Subject: ${subject}
- Class: ${stdClass}
- Exam type: ${examType}
- Total Marks: ${totalMarks}
- Number of questions: ${numQuestions}
- Duration: ${duration}
- Candidate chapters/topics provided by the user: ${JSON.stringify(chapters)}

Before writing questions:
- Every chapter/topic supplied by the user is mandatory
- Include at least one question from every supplied chapter/topic
- If marks are tight, use shorter questions, but do not drop any chapter/topic

Strict paper rules:
- This must look like a normal school Unit Test paper
- This should follow the feel of a real school periodic/unit test across subjects and classes
- Do NOT use CBSE board-paper styling
- Do NOT divide the paper into sections like A, B, C, D, E
- Do NOT write chapter names or topic names in or near the questions
- Do NOT over-structure the paper
- Do NOT create case-based questions
- Do NOT create assertion-reason questions
- Keep internal choice minimal: maximum 1 OR question in the full paper

Paper pattern:
- Prefer the common school pattern of 25 marks for periodic/unit tests
- Duration should remain suitable for a school periodic/unit test
- Total questions: MUST BE EXACTLY ${numQuestions}. Do NOT generate any extra questions.
- Marks MUST BE STRICTLY WHOLE NUMBERS (1, 2, 3, 4, 5). NEVER use fractions or decimals like 0.5 or 1.5.
- Total marks must add up to exactly ${totalMarks}.
- Every provided chapter/topic must appear in the paper at least once
- Use a realistic mix of 2, 3, 4 and 5 mark questions
- Include at least one descriptive question worth 4 or 5 marks
- Avoid questions above 5 marks unless one composite question with clear subparts is genuinely needed
- Never create a 10-mark single question in a periodic/unit test paper
- Maximum MCQs: ${getUTMcqLimit(subject)}
- Avoid MCQ-heavy pattern
- IMPORTANT: For MCQs, explicitly randomize the correct option across A, B, C, and D so they don't always default to the first option.

Subject guidance:
- Language subjects: include literature, grammar, comprehension, and writing as appropriate
- Mathematics: use numericals, short reasoning, and application-based problems
- Science: use short explanation, concept clarity, diagrams if suitable, and application
- Social Science: use short answer, explanation, map/context only if natural
- Commerce subjects: use practical entries, calculations, or concept-based short answers
- Computer subjects: use logic, syntax awareness, output-based or concept questions

Language rules:
- Use the natural language of the subject paper
- Hindi subject -> write the paper in Hindi
- English subject -> write the paper in English
- Sanskrit subject -> use school-appropriate Sanskrit/Hindi mix
- Keep wording simple, clear, and school-like for Class ${stdClass}

Output rules:
- Return ONLY a valid JSON object
- No markdown
- No explanation
- No extra text before or after JSON
- source_chapter is validation metadata only; do not print it in the question text
- source_chapter must exactly match one of the provided chapter/topic strings
- Allowed question_type values only: "MCQ", "short", "long"

JSON shape:
{
  "instructions": [
    "instruction 1",
    "instruction 2"
  ],
  "answer_key": {
    "1": "brief correct answer or option",
    "2": "brief correct answer or points"
  },
  "questions": [
    {
      "question_no": 1,
      "marks": 2,
      "question_type": "MCQ",
      "source_chapter": "exact chapter/topic string from the provided list",
      "source_sub_topic": "optional sub-topic string or null",
      "question_text": "question text here",
      "options": ["(a) ...", "(b) ...", "(c) ...", "(d) ..."],
      "internal_choice": false,
      "choice_text": null
    },
    {
      "question_no": 2,
      "marks": 3,
      "question_type": "short",
      "source_chapter": "exact chapter/topic string from the provided list",
      "source_sub_topic": "optional sub-topic string or null",
      "question_text": "question text here",
      "options": null,
      "internal_choice": false,
      "choice_text": null
    },
    {
      "question_no": 3,
      "marks": 5,
      "question_type": "long",
      "source_chapter": "exact chapter/topic string from the provided list",
      "source_sub_topic": "optional sub-topic string or null",
      "question_text": "question text here",
      "options": null,
      "internal_choice": true,
      "choice_text": "alternate question text here"
    }
  ]
}
  `;
}

function buildTermPrompt({ useBoardStyle, ...context }: GenerationContext): string {
  return useBoardStyle
    ? buildBoardExamPrompt(context)
    : buildSchoolExamPrompt(context);
}

function buildSchoolExamPrompt({
  subject,
  stdClass,
  examType,
  chapters,
  totalMarks,
  numQuestions,
  duration,
}: Omit<GenerationContext, "useBoardStyle">): string {
  return `
You are an experienced school teacher creating a realistic school-level ${examType} examination paper.

This is a school exam, not a CBSE board paper.
Do not copy board-exam section formatting unless explicitly asked. For this paper, do not use sections like A, B, C, D, E.

Generate a question paper with these details:
- Subject: ${subject}
- Class: ${stdClass}
- Exam type: ${examType}
- Total Marks: ${totalMarks}
- Number of questions: ${numQuestions}
- Duration: ${duration}
- Chapters to cover: ${JSON.stringify(chapters)}

IMPORTANT RULES:
- Keep the paper school-level and classroom-realistic
- Do NOT divide the paper into formal sections
- Do NOT print chapter names or topic names with the questions
- Keep the question list flat: Q1, Q2, Q3...
- Questions must match the level of Class ${stdClass}
- Every provided chapter/topic is mandatory and must appear at least once
- Cover the supplied syllabus in a balanced way
- Include internal choice only where it feels natural and minimal
- Use question styles appropriate to the subject: numericals, theory, short answer, long answer, application, diagrams, proofs, grammar, writing etc.
- Total questions: MUST BE EXACTLY ${numQuestions}.
- Total marks must add up to exactly ${totalMarks}
- Marks MUST BE STRICTLY WHOLE NUMBERS (1, 2, 3, 4, 5, 10, etc.). NEVER use fractions or decimals.
- Use a realistic mix of short, medium, and long questions rather than a rigid board blueprint
- source_chapter is validation metadata only; do not print it in the question text
- source_chapter must exactly match one of the provided chapter/topic strings
- IMPORTANT: For MCQs, explicitly randomize the correct option across A, B, C, and D so they don't always default to the first option.

Return ONLY a valid JSON object. No markdown. No explanation.

{
  "instructions": [
    "Answer all questions.",
    "Show all necessary working clearly."
  ],
  "answer_key": {
    "1": "brief correct answer",
    "2": "brief correct answer points"
  },
  "questions": [
    {
      "question_no": 1,
      "marks": 2,
      "question_type": "short",
      "source_chapter": "exact chapter/topic string from the provided list",
      "source_sub_topic": "optional sub-topic string or null",
      "question_text": "question text here",
      "options": null,
      "internal_choice": false,
      "choice_text": null
    },
    {
      "question_no": 2,
      "marks": 4,
      "question_type": "long",
      "source_chapter": "exact chapter/topic string from the provided list",
      "source_sub_topic": "optional sub-topic string or null",
      "question_text": "question text here",
      "options": null,
      "internal_choice": true,
      "choice_text": "alternate question text here"
    }
  ]
}
  `;
}

function buildBoardExamPrompt({
  subject,
  stdClass,
  examType,
  chapters,
  totalMarks,
  duration,
}: Omit<GenerationContext, "useBoardStyle">): string {
  return `
You are an experienced school teacher creating a ${examType} examination paper.

Generate a question paper with these details:
- Subject: ${subject}
- Class: ${stdClass}
- Total Marks: ${totalMarks}
- Duration: ${duration}
- Chapters to cover: ${JSON.stringify(chapters)}

IMPORTANT RULES:
- Paper must have 5 sections: A, B, C, D, E
- Section A: 20 MCQs of 1 mark each = 20 marks
- Section B: 5 questions of 2 marks each = 10 marks
- Section C: 6 questions of 3 marks each = 18 marks
- Section D: 4 questions of 5 marks each = 20 marks (with internal choice)
- Section E: 3 case-based questions of 4 marks each = 12 marks
- Total = 80 marks exactly
- Marks MUST BE STRICTLY WHOLE NUMBERS. NEVER use fractions or decimals.
- All chapters must be covered across sections
- Questions must be realistic and curriculum-appropriate for Class ${stdClass}
- Section D must have internal choice
- Section E must have a case passage followed by sub-questions
- source_chapter is validation metadata only; do not print it in the question text
- source_chapter must exactly match one of the provided chapter/topic strings
- IMPORTANT: For MCQs, explicitly randomize the correct option across A, B, C, and D so they don't always default to the first option.

Return ONLY a valid JSON object. No markdown. No explanation.

{
  "instructions": [
    "This paper consists of 38 questions divided into 5 sections.",
    "All questions are compulsory. However, internal choice is provided in Section D.",
    "Section E has case-based questions.",
    "Use of calculator is not permitted."
  ],
  "answer_key": {
    "1": "A",
    "36": "brief correct answer points"
  },
  "questions": [
    {
      "question_no": 1,
      "section": "A",
      "marks": 1,
      "question_type": "MCQ",
      "source_chapter": "exact chapter/topic string from the provided list",
      "source_sub_topic": "optional sub-topic string or null",
      "question_text": "Full question text...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_option": "A",
      "internal_choice": false,
      "choice_question_text": null,
      "case_passage": null
    },
    {
      "question_no": 36,
      "section": "E",
      "marks": 4,
      "question_type": "case_based",
      "source_chapter": "exact chapter/topic string from the provided list",
      "source_sub_topic": "optional sub-topic string or null",
      "case_passage": "A park has a circular fountain... [full passage here]",
      "question_text": "Sub-questions here...",
      "options": null,
      "correct_option": null,
      "internal_choice": false,
      "choice_question_text": null
    }
  ]
}
  `;
}
