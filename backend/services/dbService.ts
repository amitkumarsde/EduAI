import type { Types } from "mongoose";
import Student from "../models/Student.js";
import TopicHealth from "../models/TopicHealth.js";
import Exam, { type ChapterSummary, type ExamType } from "../models/Exam.js";
import { buildClassMatcher, normalizeClassLabel } from "../utils/classUtils.js";

export interface PastExam {
  exam_id: Types.ObjectId | string | null;
  exam_type?: string;
  exam_date?: Date | null;
  subject?: string;
  total_marks?: number;
  scored_marks?: number | null;
  percentage?: number | null;
  weak_chapters: ChapterSummary[];
  strong_chapters: ChapterSummary[];
  priority_topics: string[];
  suggested_goal: string | null;
}

export interface StudentHistory {
  student_id: Types.ObjectId;
  past_exams: PastExam[];
  topic_health: Array<{
    chapter_code: string | null;
    chapter_name: string | null;
    sub_topics: unknown[];
    updated_at: Date | null;
  }>;
}

export interface NormalizedSubTopic {
  code: string;
  status: string;
}

export interface NormalizedTopicHealthChapter {
  chapter_code: string | null;
  chapter_name: string | null;
  sub_topics: NormalizedSubTopic[];
}

export interface ChapterSummariesResult {
  weak: ChapterSummary[];
  strong: ChapterSummary[];
}

export interface PracticeQuizContext {
  student: {
    id: Types.ObjectId;
    name: string;
    class: string;
    school: string;
  };
  subject: string;
  weak_chapters: ChapterSummary[];
  weak_topics: Array<{ chapter_name: string; sub_topic: string | null }>;
  priority_topics: string[];
  latest_exam: {
    exam_id: Types.ObjectId | string | null;
    exam_type?: string;
    exam_date?: Date | null;
    percentage?: number | null;
    suggested_goal: string | null;
  } | null;
}

export interface StudentInfo {
  name: string | null;
  class: string | null;
  school: string | null;
  subject: string | null;
  exam_type: string | null;
  total_marks: number;
}

export interface FinalAnalysis {
  student_info: StudentInfo;
  questions: unknown[];
  topic_health: unknown[];
  ai_recommendation: {
    priority_topics?: string[];
    suggested_goal?: string | null;
  } | null;
  comparison_with_history: unknown;
  total_scored: number;
  percentage: number;
  needs_manual_review: boolean;
  student_id?: Types.ObjectId | null;
  exam_id?: Types.ObjectId | null;
}

export async function getStudentHistory({
  student_name,
  class: studentClass,
  subject,
}: {
  student_name?: string | null;
  class?: string | null;
  subject?: string | null;
}): Promise<StudentHistory | null> {
  const normalizedStudentClass = normalizeClassLabel(studentClass);

  if (!student_name || !normalizedStudentClass) {
    return null;
  }

  const student = await Student.findOne({
    name: student_name,
    class: buildClassMatcher(normalizedStudentClass) ?? undefined,
  });

  if (!student) {
    console.log("Student not found in DB - treating as new student");
    return null;
  }

  await student.populate({
    path: "exams",
    match: subject ? { subject } : {},
    options: { sort: { exam_date: 1 }, limit: 15 },
  });

  await student.populate({
    path: "topic_health_records",
    match: subject ? { subject } : {},
    options: { sort: { updatedAt: -1 } },
  });

  const pastExams: PastExam[] = (student.exams || []).map((exam) => ({
    exam_id: exam._id as Types.ObjectId,
    exam_type: exam.exam_type,
    exam_date: exam.exam_date,
    subject: exam.subject,
    total_marks: exam.total_marks,
    scored_marks: exam.scored_marks,
    percentage: exam.percentage,
    weak_chapters: exam.weak_chapters || [],
    strong_chapters: exam.strong_chapters || [],
    priority_topics: exam.priority_topics || [],
    suggested_goal: exam.suggested_goal || null,
  }));

  if (!pastExams.length) {
    pastExams.push(
      ...(await getLegacyExamReportsForStudent({
        studentId: student._id,
        subject,
      })),
    );
  }

  if (!pastExams.length) {
    console.log("Student found but no past exams - treating as first exam");
    return null;
  }

  pastExams.sort(
    (left, right) =>
      new Date(left.exam_date || 0).getTime() -
      new Date(right.exam_date || 0).getTime(),
  );

  const topicHealthDoc =
    Array.isArray(student.topic_health_records) &&
    student.topic_health_records.length > 0
      ? student.topic_health_records[0]
      : null;

  return {
    student_id: student._id,
    past_exams: pastExams,
    topic_health: (topicHealthDoc?.topic_health || []).map((chapter) => ({
      chapter_code: chapter.chapter || null,
      chapter_name: chapter.chapter_name || chapter.chapter || null,
      sub_topics: chapter.sub_topics || [],
      updated_at: topicHealthDoc?.updatedAt || null,
    })),
  };
}

export async function getPracticeQuizContext({
  student_id,
  student_name,
  class: studentClass,
  subject,
}: {
  student_id?: Types.ObjectId | string | null;
  student_name?: string | null;
  class?: string | null;
  subject?: string | null;
}): Promise<PracticeQuizContext | null> {
  if (!subject) {
    return null;
  }

  let student = null;

  if (student_id) {
    student = await Student.findById(student_id);
  } else if (student_name && studentClass) {
    student = await Student.findOne({
      name: student_name,
      class: buildClassMatcher(studentClass) ?? undefined,
    });
  }

  if (!student) {
    return null;
  }

  await student.populate({
    path: "exams",
    match: { subject },
    options: { sort: { exam_date: -1 }, limit: 15 },
  });

  await student.populate({
    path: "topic_health_records",
    match: { subject },
    options: { sort: { updatedAt: -1 } },
  });

  const latestReport =
    Array.isArray(student.exams) && student.exams.length > 0
      ? student.exams[0]
      : null;
  const legacyReports = latestReport
    ? []
    : await getLegacyExamReportsForStudent({
        studentId: student._id,
        subject,
      });
  const fallbackLatestReport = legacyReports[0] || null;

  const topicHealthDoc =
    Array.isArray(student.topic_health_records) &&
    student.topic_health_records.length > 0
      ? student.topic_health_records[0]
      : null;

  const normalizedTopicHealth: NormalizedTopicHealthChapter[] = (
    topicHealthDoc?.topic_health || []
  )
    .map((chapter) => ({
      chapter_code: chapter.chapter || null,
      chapter_name: chapter.chapter_name || chapter.chapter || null,
      sub_topics: Array.isArray(chapter.sub_topics)
        ? chapter.sub_topics.map((subTopic) => ({
            code: String(subTopic.code || "").trim(),
            status: subTopic.status,
          }))
        : [],
    }))
    .filter((chapter) => Boolean(chapter.chapter_name));

  let weakChapters: ChapterSummary[] = buildChapterSummaries(
    normalizedTopicHealth,
  ).weak;

  if (!weakChapters.length && latestReport?.weak_chapters?.length) {
    weakChapters = latestReport.weak_chapters;
  }

  if (!weakChapters.length && fallbackLatestReport?.weak_chapters?.length) {
    weakChapters = fallbackLatestReport.weak_chapters;
  }

  const priorityTopics =
    latestReport?.priority_topics || fallbackLatestReport?.priority_topics || [];
  const weakTopicLabels = weakChapters.flatMap(
    (chapter): Array<{ chapter_name: string; sub_topic: string | null }> => {
      if (Array.isArray(chapter.sub_topics) && chapter.sub_topics.length) {
        return chapter.sub_topics.map((subTopic) => ({
          chapter_name: chapter.chapter_name,
          sub_topic: subTopic,
        }));
      }

      return [
        {
          chapter_name: chapter.chapter_name,
          sub_topic: null,
        },
      ];
    },
  );

  return {
    student: {
      id: student._id,
      name: student.name,
      class: student.class,
      school: student.school,
    },
    subject,
    weak_chapters: weakChapters,
    weak_topics: weakTopicLabels,
    priority_topics: priorityTopics,
    latest_exam: latestReport
      ? {
          exam_id: latestReport._id as Types.ObjectId,
          exam_type: latestReport.exam_type,
          exam_date: latestReport.exam_date,
          percentage: latestReport.percentage,
          suggested_goal: latestReport.suggested_goal || null,
        }
      : fallbackLatestReport
        ? {
            exam_id: fallbackLatestReport.exam_id || null,
            exam_type: fallbackLatestReport.exam_type,
            exam_date: fallbackLatestReport.exam_date,
            percentage: fallbackLatestReport.percentage,
            suggested_goal: fallbackLatestReport.suggested_goal || null,
          }
        : null,
  };
}

export async function saveExamAnalysis({
  finalAnalysis,
  questionPaperFile,
  answerSheetFile,
}: {
  finalAnalysis: FinalAnalysis;
  questionPaperFile?: Express.Multer.File;
  answerSheetFile?: Express.Multer.File;
}): Promise<{ student_id: Types.ObjectId; exam_id: Types.ObjectId } | null> {
  const studentInfo = finalAnalysis?.student_info || ({} as StudentInfo);
  const normalizedExamType = normalizeStoredExamType(studentInfo.exam_type);
  const studentName = String(studentInfo.name || "").trim();
  const studentClass = normalizeClassLabel(studentInfo.class);
  const studentSchool =
    String(studentInfo.school || "").trim() || "Unknown School";
  const examDate = new Date();

  if (!studentName || !studentClass) {
    console.warn("Student info incomplete - skipping DB persistence");
    return null;
  }

  const student = await Student.findOne({
    name: studentName,
    class: buildClassMatcher(studentClass) ?? undefined,
  });

  if (student) {
    student.class = studentClass;

    if (studentInfo.school) {
      student.school = studentSchool;
    } else if (!student.school) {
      student.school = studentSchool;
    }

    await student.save();
  } else {
    throw new Error(
      `Student Not Found: Cannot save exam for unregistered student '${studentName}' in class '${studentClass}'`,
    );
  }

  const topicHealthSnapshot = normalizeTopicHealth(finalAnalysis.topic_health);
  const chapterSummary = buildChapterSummaries(topicHealthSnapshot);

  const examDoc = await Exam.create({
    student_id: student._id,
    exam_type: normalizedExamType,
    subject: studentInfo.subject ?? undefined,
    total_marks: studentInfo.total_marks,
    scored_marks: finalAnalysis.total_scored,
    percentage: finalAnalysis.percentage,
    exam_date: examDate,
    has_sections: false,
    suggested_goal: finalAnalysis?.ai_recommendation?.suggested_goal || null,
    goal_set_by: finalAnalysis?.ai_recommendation?.suggested_goal
      ? "ai_suggested"
      : null,
    weak_chapters: chapterSummary.weak,
    strong_chapters: chapterSummary.strong,
    priority_topics: finalAnalysis?.ai_recommendation?.priority_topics || [],
    chapters_in_scope: topicHealthSnapshot.map((chapter) => ({
      chapter_code: chapter.chapter_code ?? undefined,
      chapter_name: chapter.chapter_name ?? undefined,
    })),
    uploads: {
      question_paper: {
        file_url: null,
        file_type: questionPaperFile?.mimetype || null,
        uploaded_at: examDate,
      },
      answer_sheet: {
        file_url: null,
        file_type: answerSheetFile?.mimetype || null,
        uploaded_at: examDate,
      },
    },
    ai_processed: true,
  });

  await TopicHealth.findOneAndUpdate(
    {
      student_id: student._id,
      subject: studentInfo.subject,
    },
    {
      student_id: student._id,
      subject: studentInfo.subject,
      topic_health: topicHealthSnapshot.map((chapter) => ({
        chapter: chapter.chapter_code || chapter.chapter_name,
        chapter_name: chapter.chapter_name,
        sub_topics: chapter.sub_topics,
      })),
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    },
  );

  return {
    student_id: student._id,
    exam_id: examDoc._id,
  };
}

// Maps whatever exam_type Gemini returns to one of the values allowed by the
// Exam schema enum (["UT-1", "UT-2", "Mid-Term", "Final"]). Returning an
// unrecognised string here would make Exam.create() throw a validation error
// and discard the entire (expensive) analysis, so we default to "UT-1".
function normalizeStoredExamType(examType: string | null | undefined): ExamType {
  const normalized = String(examType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const aliasGroups: Record<ExamType, string[]> = {
    "UT-2": ["ut-2", "ut 2", "ut2", "pt-2", "pt 2", "periodic test 2", "unit test 2", "unit test-2", "cycle test 2"],
    "UT-1": ["ut-1", "ut 1", "ut1", "pt-1", "pt 1", "periodic test 1", "unit test 1", "unit test-1", "cycle test 1"],
    "Mid-Term": ["mid-term", "mid term", "midterm", "half yearly", "half-yearly"],
    "Final": ["final", "final exam", "annual", "annual exam"],
  };

  for (const [canonical, aliases] of Object.entries(aliasGroups) as [
    ExamType,
    string[],
  ][]) {
    if (aliases.includes(normalized)) {
      return canonical;
    }
  }

  return "UT-1";
}

async function getLegacyExamReportsForStudent({
  studentId,
  subject,
}: {
  studentId: Types.ObjectId;
  subject?: string | null;
}): Promise<PastExam[]> {
  const legacyStudent = await Student.collection.findOne(
    { _id: studentId },
    { projection: { exam_reports: 1 } },
  );

  const reports: any[] = Array.isArray(legacyStudent?.exam_reports)
    ? legacyStudent.exam_reports
    : [];

  return reports
    .filter((report) => !subject || report.subject === subject)
    .sort(
      (left, right) =>
        new Date(right.exam_date || 0).getTime() -
        new Date(left.exam_date || 0).getTime(),
    )
    .map((report) => ({
      exam_id: report.exam_id || null,
      exam_type: report.exam_type,
      exam_date: report.exam_date || null,
      subject: report.subject,
      total_marks: report.total_marks,
      scored_marks: report.scored_marks,
      percentage: report.percentage,
      weak_chapters: report.weak_chapters || [],
      strong_chapters: report.strong_chapters || [],
      priority_topics: report.priority_topics || [],
      suggested_goal: report.suggested_goal || null,
    }));
}

export function normalizeTopicHealth(
  topicHealth: unknown,
): NormalizedTopicHealthChapter[] {
  if (!Array.isArray(topicHealth)) {
    return [];
  }

  return topicHealth
    .map((chapter: any) => ({
      chapter_code: chapter.chapter_code || chapter.chapter || null,
      chapter_name: chapter.chapter_name || chapter.chapter || null,
      sub_topics: Array.isArray(chapter.sub_topics)
        ? chapter.sub_topics
            .filter((subTopic: any) => subTopic?.code && subTopic?.status)
            .map((subTopic: any) => ({
              code: String(subTopic.code).trim(),
              status: subTopic.status,
            }))
        : [],
    }))
    .filter((chapter) => Boolean(chapter.chapter_name));
}

export function buildChapterSummaries(
  topicHealthSnapshot: NormalizedTopicHealthChapter[],
): ChapterSummariesResult {
  const weak: ChapterSummary[] = [];
  const strong: ChapterSummary[] = [];

  for (const chapter of topicHealthSnapshot) {
    const weakSubTopics = chapter.sub_topics
      .filter((subTopic) => subTopic.status !== "crystal_clear")
      .map((subTopic) => subTopic.code);

    if (weakSubTopics.length > 0) {
      weak.push({
        chapter_name: chapter.chapter_name || "",
        sub_topics: weakSubTopics,
      });
    } else {
      strong.push({
        chapter_name: chapter.chapter_name || "",
        sub_topics: chapter.sub_topics.map((subTopic) => subTopic.code),
      });
    }
  }

  return { weak, strong };
}
