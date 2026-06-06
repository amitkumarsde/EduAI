import type { Request, Response } from "express";
import fs from "fs";
import { callGemini, callGeminiText } from "../services/geminiService.js";
import {
  buildChapterSummaries,
  getStudentHistory,
  normalizeTopicHealth,
  saveExamAnalysis,
  type FinalAnalysis,
  type StudentInfo,
  type StudentHistory,
} from "../services/dbService.js";
import { normalizeClassLabel } from "../utils/classUtils.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function analyzeExam(req: Request, res: Response) {
  try {
    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const questionPaperFile = files?.question_paper?.[0];
    const answerSheetFile = files?.answer_sheet?.[0];
    const fallbackStudentInfo = normalizeFallbackStudentInfo(req.body || {});

    if (!questionPaperFile || !answerSheetFile) {
      return res.status(400).json({
        success: false,
        message: "Both question_paper and answer_sheet files are required",
      });
    }

    console.log("Step 1: Sending files to Gemini for extraction...");

    const questionPaperBuffer = fs.readFileSync(questionPaperFile.path);
    const answerSheetBuffer = fs.readFileSync(answerSheetFile.path);

    try {
      fs.unlinkSync(questionPaperFile.path);
      fs.unlinkSync(answerSheetFile.path);
    } catch (cleanupError) {
      console.warn("Failed to cleanup temporary upload files", cleanupError);
    }

    const extractedData: any = await callGemini({
      question_paper: questionPaperBuffer,
      answer_sheet: answerSheetBuffer,
      question_paper_mime_type: questionPaperFile.mimetype,
      answer_sheet_mime_type: answerSheetFile.mimetype,
      question_paper_name: questionPaperFile.originalname,
      answer_sheet_name: answerSheetFile.originalname,
      prompt: `
        You are an expert school teacher.

        You have been given two documents:
        1. A question paper (first document)
        2. A student's answer sheet (second document)

        Extract student information from the documents and analyze the answer sheet.

        Return ONLY a valid JSON object - no explanation, no markdown, ONLY raw JSON.

        {
          "student_info": {
            "name": "extracted from answer sheet - null if not found",
            "class": "extracted from answer sheet - null if not found",
            "school": "extracted from answer sheet - null if not found",
            "subject": "extracted from question paper",
            "exam_type": "UT-1 or UT-2 or Mid-Term or Final",
            "total_marks": 0
          },
          "transcription_confidence": 0.95,
          "questions": [
            {
              "question_no": 1,
              "chapter": "Ch-1",
              "chapter_name": "Algebra",
              "sub_topic": "A1",
              "marks_available": 2,
              "marks_scored": 2,
              "status": "fully_correct",
              "mistake_area": null,
              "ai_feedback": null,
              "breakdown": {
                "formula_marks": 0,
                "steps_marks": 1,
                "final_answer_marks": 1
              }
            }
          ],
          "weak_topics": [],
          "strong_topics": [],
          "topic_health": [
            {
              "chapter_code": "Ch-1",
              "chapter_name": "Algebra",
              "sub_topics": [
                { "code": "A1", "status": "crystal_clear" }
              ]
            }
          ]
        }

        Rules:
        - transcription_confidence: a float between 0.0 and 1.0 indicating how confident you are in reading the student's handwriting
        - status values: "fully_correct" | "partially_correct" | "completely_wrong" | "not_attempted"
        - sub_topic status: "crystal_clear" | "partial_understanding" | "no_knowledge"
        - marks_scored per question must be accurate - do NOT calculate total yourself
        - For each question breakdown: formula_marks + steps_marks + final_answer_marks must equal marks_scored
      `,
    });

    const rawExtractedStudentInfo = normalizeStudentInfo(
      extractedData.student_info || {},
    );
    const extractedStudentInfo = mergeStudentInfo(
      fallbackStudentInfo,
      rawExtractedStudentInfo,
    );
    const extractedQuestions = normalizeExtractedQuestions(
      extractedData.questions,
    );

    if (!extractedQuestions.length) {
      throw new Error(
        "Gemini did not return any question analysis from the uploaded answer sheet.",
      );
    }

    const confidence = Number(extractedData.transcription_confidence);
    const needsManualReview = !Number.isNaN(confidence) && confidence < 0.8;
    if (needsManualReview) {
      console.warn("Low transcription confidence detected (< 80%). Flagging exam for manual review.");
    }

    extractedData.student_info = extractedStudentInfo;
    extractedData.questions = extractedQuestions;

    if (
      (!rawExtractedStudentInfo.name || !rawExtractedStudentInfo.class) &&
      fallbackStudentInfo.name &&
      fallbackStudentInfo.class
    ) {
      console.log(
        "Using active student fallback because the answer sheet did not expose full student identity.",
      );
    }

    console.log("Step 1 done - Student extracted:", extractedData.student_info);

    extractedData.questions.forEach((question: any) => {
      console.log(
        `Q${question.question_no} - available: ${question.marks_available} | scored: ${question.marks_scored} | status: ${question.status}`,
      );
    });

    const calculatedTotalScored = extractedData.questions.reduce(
      (sum: number, question: any) => sum + (question.marks_scored || 0),
      0,
    );

    const totalMarks = extractedData.student_info.total_marks || 0;
    const calculatedPercentage =
      totalMarks > 0
        ? parseFloat(((calculatedTotalScored / totalMarks) * 100).toFixed(2))
        : 0;

    if (calculatedPercentage > 100) {
      console.error(
        `Percentage exceeded 100% - something wrong in marks. Total: ${calculatedTotalScored}/${totalMarks}`,
      );
    }

    console.log(
      `Backend calculated: ${calculatedTotalScored} / ${totalMarks} = ${calculatedPercentage}%`,
    );

    extractedData.total_scored = calculatedTotalScored;
    extractedData.percentage = calculatedPercentage;

    const { name, class: studentClass, subject } = extractedData.student_info;

    console.log(
      "Step 2: Checking DB history for:",
      name,
      studentClass,
      subject,
    );

    const studentHistory = await getStudentHistory({
      student_name: name,
      class: studentClass,
      subject,
    });

    console.log(
      studentHistory
        ? `History found for ${name}`
        : `No history - first exam for ${name}`,
    );

    console.log("Step 3: Sending to Gemini for final analysis with history...");

    const geminiResponse: any = await callGeminiText({
      prompt: `
        You are an expert teacher and student mentor.

        Current exam analysis generated from the uploaded question paper and answer sheet:
        ${JSON.stringify(extractedData)}

        Student past history:
        ${
          studentHistory
            ? JSON.stringify(studentHistory)
            : "null - this is the student's first exam. No prior history."
        }

        Based on all of the above, return ONLY a valid JSON object.
        No explanation, no markdown - ONLY raw JSON.

        {
          "student_info": {
            "name": "",
            "class": "",
            "school": "",
            "subject": "",
            "exam_type": "",
            "total_marks": 0
          },
          "topic_health": [],
          "history_feedback": "Short progress feedback based on comparison with previous exam history, or null for first exam",
          "ai_recommendation": {
            "priority_topics": [],
            "suggested_goal": "75%"
          },
          "comparison_with_history": {
            "improved_topics": [],
            "declined_topics": [],
            "new_weak_topics": []
          }
        }

        Rules:
        - The uploaded answer sheet has already been graded in current exam analysis. Do NOT re-grade or overwrite question-level marks.
        - Do NOT return a questions array.
        - Do NOT recalculate total_scored or percentage - these will be added by backend
        - If past history is null, set comparison_with_history to null
        - If past history is null, set history_feedback to null
        - If past history exists, clearly mention whether the student improved on previously weak topics
        - suggested_goal must be realistic based on current performance
        - priority_topics should be ordered by urgency - most weak first
      `,
    });

    const normalizedGeminiResponse: any =
      geminiResponse && typeof geminiResponse === "object"
        ? geminiResponse
        : {};

    const finalAnalysis: FinalAnalysis = {
      student_info: mergeStudentInfo(
        extractedData.student_info,
        normalizedGeminiResponse.student_info,
      ),
      questions: extractedData.questions,
      topic_health:
        Array.isArray(normalizedGeminiResponse.topic_health) &&
        normalizedGeminiResponse.topic_health.length
          ? normalizedGeminiResponse.topic_health
          : extractedData.topic_health || [],
      ai_recommendation: normalizedGeminiResponse.ai_recommendation || null,
      comparison_with_history:
        normalizedGeminiResponse.comparison_with_history ?? null,
      total_scored: calculatedTotalScored,
      percentage: calculatedPercentage,
      needs_manual_review: needsManualReview,
    };

    // The step-3 prompt skeleton carries `"total_marks": 0`, so the model can
    // echo a 0 that would clobber the authoritative total extracted in step 1
    // (and on which the percentage above was computed). Keep the real value.
    finalAnalysis.student_info.total_marks = extractedData.student_info.total_marks;

    console.log(
      "Final marks confirmed:",
      calculatedTotalScored,
      "/",
      totalMarks,
      "=",
      `${calculatedPercentage}%`,
    );
    console.log("Step 3 done - Final analysis ready!");

    const persistenceResult = await saveExamAnalysis({
      finalAnalysis,
      questionPaperFile,
      answerSheetFile,
    });

    if (persistenceResult) {
      finalAnalysis.student_id = persistenceResult.student_id;
      finalAnalysis.exam_id = persistenceResult.exam_id;
    }

    const topicHealthSnapshot = normalizeTopicHealth(
      finalAnalysis.topic_health,
    );
    const chapterSummary = buildChapterSummaries(topicHealthSnapshot);
    const historyFeedback = buildHistoryFeedback({
      studentHistory,
      comparisonWithHistory: finalAnalysis.comparison_with_history,
      currentWeakChapters: chapterSummary.weak,
      geminiHistoryFeedback: normalizedGeminiResponse.history_feedback,
    });

    const responseData = {
      student_info: finalAnalysis.student_info,
      questions: finalAnalysis.questions,
      total_scored: finalAnalysis.total_scored,
      percentage: finalAnalysis.percentage,
      weak_chapters: chapterSummary.weak,
      strong_chapters: chapterSummary.strong,
      history_feedback: historyFeedback,
      ai_recommendation: {
        priority_topics:
          finalAnalysis?.ai_recommendation?.priority_topics || [],
        suggested_goal:
          finalAnalysis?.ai_recommendation?.suggested_goal || null,
      },
      comparison_with_history: finalAnalysis.comparison_with_history,
      needs_manual_review: finalAnalysis.needs_manual_review,
      student_id: finalAnalysis.student_id || null,
      exam_id: finalAnalysis.exam_id || null,
      used_fallback_student:
        (!rawExtractedStudentInfo.name || !rawExtractedStudentInfo.class) &&
        Boolean(fallbackStudentInfo.name && fallbackStudentInfo.class),
    };

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in analyzeExam:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

function normalizeFallbackStudentInfo(body: any): StudentInfo {
  return normalizeStudentInfo({
    name: body?.fallback_student_name,
    class: body?.fallback_student_class,
    school: body?.fallback_student_school,
  });
}

function buildHistoryFeedback({
  studentHistory,
  comparisonWithHistory,
  currentWeakChapters,
  geminiHistoryFeedback,
}: {
  studentHistory: StudentHistory | null;
  comparisonWithHistory: any;
  currentWeakChapters: any[];
  geminiHistoryFeedback: unknown;
}): string | null {
  if (!studentHistory) {
    return null;
  }

  const trimmedGeminiFeedback = String(geminiHistoryFeedback || "").trim();

  if (trimmedGeminiFeedback) {
    return trimmedGeminiFeedback;
  }

  const improvedTopics = extractTopicLabels(
    comparisonWithHistory?.improved_topics,
  );
  const declinedTopics = extractTopicLabels(
    comparisonWithHistory?.declined_topics,
  );
  const newWeakTopics = extractTopicLabels(
    comparisonWithHistory?.new_weak_topics,
  );

  if (improvedTopics.length > 0) {
    let message = `Compared with your previous exam, you have improved in ${formatTopicList(improvedTopics)}.`;

    if (declinedTopics.length > 0 || newWeakTopics.length > 0) {
      const focusTopics = [...declinedTopics, ...newWeakTopics];
      message += ` Keep working on ${formatTopicList(focusTopics)}.`;
    }

    return message;
  }

  const lastExam =
    Array.isArray(studentHistory.past_exams) &&
    studentHistory.past_exams.length > 0
      ? studentHistory.past_exams[studentHistory.past_exams.length - 1]
      : null;

  const previousWeakCount = countWeakTopics(lastExam?.weak_chapters);
  const currentWeakCount = countWeakTopics(currentWeakChapters);

  if (previousWeakCount > 0 && currentWeakCount < previousWeakCount) {
    return "Compared with your previous exam, your weak areas have reduced overall. Keep building on that progress.";
  }

  if (declinedTopics.length > 0 || newWeakTopics.length > 0) {
    const focusTopics = [...declinedTopics, ...newWeakTopics];
    return `Compared with your previous exam, strong improvement is not visible yet. Focus more on ${formatTopicList(focusTopics)} before the next test.`;
  }

  return "Compared with your previous exam, your overall performance pattern looks similar. Keep practicing your earlier weak areas consistently.";
}

function extractTopicLabels(topics: any): string[] {
  if (!Array.isArray(topics)) {
    return [];
  }

  return topics
    .map((topic) => {
      if (typeof topic === "string") {
        return topic.trim();
      }

      if (!topic || typeof topic !== "object") {
        return "";
      }

      const chapterName = String(
        topic.chapter_name || topic.chapter || topic.name || "",
      ).trim();
      const subTopicName = String(
        topic.sub_topic || topic.subtopic || topic.topic || "",
      ).trim();

      if (chapterName && subTopicName) {
        return `${chapterName} - ${subTopicName}`;
      }

      return chapterName || subTopicName;
    })
    .filter(Boolean);
}

function formatTopicList(topics: string[], maxItems = 3): string {
  const uniqueTopics = [...new Set(topics)].slice(0, maxItems);

  if (uniqueTopics.length === 0) {
    return "your key topics";
  }

  if (uniqueTopics.length === 1) {
    return uniqueTopics[0];
  }

  if (uniqueTopics.length === 2) {
    return `${uniqueTopics[0]} and ${uniqueTopics[1]}`;
  }

  return `${uniqueTopics.slice(0, -1).join(", ")}, and ${uniqueTopics.at(-1)}`;
}

function countWeakTopics(chapters: any): number {
  if (!Array.isArray(chapters)) {
    return 0;
  }

  return chapters.reduce((count, chapter) => {
    if (Array.isArray(chapter?.sub_topics) && chapter.sub_topics.length > 0) {
      return count + chapter.sub_topics.length;
    }

    return count + 1;
  }, 0);
}

function mergeStudentInfo(
  extractedStudentInfo: any,
  suggestedStudentInfo: any,
): StudentInfo {
  const merged: any = { ...normalizeStudentInfo(extractedStudentInfo) };

  if (!suggestedStudentInfo || typeof suggestedStudentInfo !== "object") {
    return merged;
  }

  for (const [key, value] of Object.entries(suggestedStudentInfo)) {
    if (value == null) {
      continue;
    }

    if (typeof value === "string" && !value.trim()) {
      continue;
    }

    merged[key] = value;
  }

  return normalizeStudentInfo(merged);
}

function normalizeStudentInfo(studentInfo: any): StudentInfo {
  return {
    name: normalizeNullableString(studentInfo?.name),
    class: normalizeNullableString(normalizeClassLabel(studentInfo?.class)),
    school: normalizeNullableString(studentInfo?.school),
    subject: normalizeNullableString(studentInfo?.subject),
    exam_type: normalizeNullableString(studentInfo?.exam_type),
    total_marks: normalizeNonNegativeNumber(studentInfo?.total_marks),
  };
}

function normalizeExtractedQuestions(questions: any): any[] {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((question, index) => {
      const questionNo = normalizePositiveInteger(
        question?.question_no,
        index + 1,
      );
      const marksAvailable = normalizeNonNegativeNumber(
        question?.marks_available,
      );
      let marksScored = Math.round(normalizeNonNegativeNumber(question?.marks_scored));

      if (marksScored > marksAvailable) {
        console.warn(
          `Q${questionNo} - marks_scored (${marksScored}) > marks_available (${marksAvailable}) - capping to marks_available`,
        );
        marksScored = marksAvailable;
      }

      return {
        ...question,
        question_no: questionNo,
        chapter: normalizeNullableString(question?.chapter),
        chapter_name:
          normalizeNullableString(question?.chapter_name) ||
          normalizeNullableString(question?.chapter),
        sub_topic: normalizeNullableString(question?.sub_topic),
        marks_available: marksAvailable,
        marks_scored: marksScored,
        status: normalizeQuestionStatus(question?.status, marksScored),
        mistake_area: normalizeNullableString(question?.mistake_area),
        ai_feedback: normalizeNullableString(question?.ai_feedback),
        breakdown: normalizeBreakdown(question?.breakdown, marksScored),
      };
    })
    .sort((left, right) => left.question_no - right.question_no);
}

function normalizeBreakdown(breakdown: any, marksScored: number) {
  const normalizedBreakdown = {
    formula_marks: normalizeNonNegativeNumber(breakdown?.formula_marks),
    steps_marks: normalizeNonNegativeNumber(breakdown?.steps_marks),
    final_answer_marks: normalizeNonNegativeNumber(
      breakdown?.final_answer_marks,
    ),
  };

  const totalBreakdownMarks =
    normalizedBreakdown.formula_marks +
    normalizedBreakdown.steps_marks +
    normalizedBreakdown.final_answer_marks;

  if (totalBreakdownMarks === marksScored) {
    return normalizedBreakdown;
  }

  return {
    formula_marks: 0,
    steps_marks: 0,
    final_answer_marks: marksScored,
  };
}

function normalizeNullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function normalizePositiveInteger(value: unknown, fallbackValue: number): number {
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }

  return parsed;
}

function normalizeQuestionStatus(status: unknown, marksScored: number): string {
  const normalizedStatus = String(status || "")
    .trim()
    .toLowerCase();
  const supportedStatuses = new Set([
    "fully_correct",
    "partially_correct",
    "completely_wrong",
    "not_attempted",
  ]);

  if (supportedStatuses.has(normalizedStatus)) {
    return normalizedStatus;
  }

  return marksScored > 0 ? "partially_correct" : "not_attempted";
}
