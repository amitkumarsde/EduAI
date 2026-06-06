import type { Request, Response } from "express";
import Student from "../models/Student.js";
import Exam from "../models/Exam.js";
import GeneratedPaper from "../models/GeneratedPaper.js";
import TopicHealth from "../models/TopicHealth.js";
import { buildClassMatcher, normalizeClassLabel } from "../utils/classUtils.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ExamLike = any;
type TopicHealthLike = any;

export async function getStudentsList(_req: Request, res: Response) {
  try {
    const [students, papersAgg] = await Promise.all([
      Student.aggregate<any>([
        {
          $lookup: {
            from: "exams",
            let: { studentId: { $toString: "$_id" } },
            pipeline: [
              { $match: { $expr: { $eq: [{ $toString: "$student_id" }, "$$studentId"] } } },
              { $sort: { exam_date: -1 } }
            ],
            as: "exams"
          }
        },
        {
          $lookup: {
            from: "topichealths",
            let: { studentId: { $toString: "$_id" } },
            pipeline: [
              { $match: { $expr: { $eq: [{ $toString: "$student_id" }, "$$studentId"] } } },
              { $sort: { updatedAt: -1 } },
              { $limit: 1 }
            ],
            as: "latestTopicHealth"
          }
        },
        { $sort: { created_at: -1 } }
      ]),
      GeneratedPaper.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$class", count: { $sum: 1 } } }
      ])
    ]);

    const paperCountByClass = new Map<string, number>(
      papersAgg.map((agg) => [normalizeClassLabel(agg._id) || agg._id, agg.count])
    );

    const studentList = students.map((student) => {
      const studentExams: ExamLike[] = student.exams || [];
      const latestExam = studentExams[0] || null;
      const averagePercentage = calculateAveragePercentage(studentExams);
      const topicHealthDoc = student.latestTopicHealth?.[0] || null;
      const normalizedClass = normalizeClassLabel(student.class) || student.class;

      return {
        id: student._id,
        name: student.name,
        class: normalizedClass,
        school: student.school,
        exam_count: studentExams.length,
        available_papers: paperCountByClass.get(normalizedClass) || 0,
        average_percentage: averagePercentage,
        latest_exam: latestExam ? serializeExamSummary(latestExam) : null,
        subjects: [...new Set(studentExams.map((exam) => exam.subject).filter(Boolean))],
        focus_topics: deriveFocusTopics({
          latestExam,
          topicHealthDocs: topicHealthDoc ? [topicHealthDoc] : [],
        }).slice(0, 4),
      };
    });

    return res.status(200).json({
      success: true,
      data: studentList,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching students list:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function getStudentOverview(req: Request, res: Response) {
  try {
    const { studentId } = req.params;

    const [student, exams, topicHealthDocs, availablePapers] = await Promise.all([
      Student.findById(studentId).lean(),
      Exam.find({ student_id: studentId }).sort({ exam_date: -1 }).lean(),
      TopicHealth.find({ student_id: studentId }).sort({ updatedAt: -1 }).lean(),
      Student.findById(studentId)
        .lean()
        .then((studentDoc) =>
          studentDoc?.class
            ? GeneratedPaper.find({
                class: buildClassMatcher(studentDoc.class) ?? undefined,
              })
                .sort({ created_at: -1 })
                .select(
                  "_id title subject exam_type class total_marks num_questions duration format created_at",
                )
                .lean()
            : [],
        ),
    ]);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const latestExam = exams[0] || null;
    const previousExam = exams[1] || null;
    const averagePercentage = calculateAveragePercentage(exams);
    const subjectBreakdown = buildSubjectBreakdown(exams);
    const recentScores = exams
      .slice(0, 6)
      .reverse()
      .map((exam) => ({
        exam_id: exam._id,
        subject: exam.subject,
        exam_type: exam.exam_type,
        percentage: exam.percentage,
        exam_date: exam.exam_date,
      }));
    const focusTopics = deriveFocusTopics({
      latestExam,
      topicHealthDocs,
    });
    const weakTopics = flattenWeakChapters(latestExam?.weak_chapters || []);
    const normalizedAvailablePapers = (availablePapers as any[]).map((paper) => ({
      ...paper,
      class: normalizeClassLabel(paper.class) || paper.class,
    }));

    const data = {
      student: {
        id: student._id,
        name: student.name,
        class: normalizeClassLabel(student.class) || student.class,
        school: student.school,
      },
      summary: {
        available_papers_count: normalizedAvailablePapers.length,
        exam_count: exams.length,
        average_percentage: averagePercentage,
        latest_percentage: latestExam?.percentage ?? null,
        improvement_from_previous: calculateImprovement(latestExam, previousExam),
        subjects: [
          ...new Set(
            [
              ...exams.map((exam) => exam.subject),
              ...normalizedAvailablePapers.map((paper) => paper.subject),
            ]
              .filter(Boolean),
          ),
        ],
      },
      available_papers: normalizedAvailablePapers,
      exam_history: exams.map(serializeExamSummary),
      latest_exam: latestExam ? serializeExamDetail(latestExam) : null,
      performance: {
        subject_breakdown: subjectBreakdown,
        recent_scores: recentScores,
        strongest_subject:
          subjectBreakdown.length > 0
            ? [...subjectBreakdown].sort((left, right) => right.average_percentage - left.average_percentage)[0]
            : null,
      },
      recommendations: {
        suggested_goal:
          latestExam?.suggested_goal ||
          (latestExam?.percentage != null
            ? `${Math.min(100, Math.max(50, Math.ceil((latestExam.percentage + 8) / 5) * 5))}%`
            : null),
        priority_topics: latestExam?.priority_topics || focusTopics,
        weak_topics: weakTopics,
        history_feedback: buildHistoryFeedback(latestExam, previousExam),
      },
      topic_health: topicHealthDocs.map(serializeTopicHealth),
    };

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching student overview:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function getTeacherAnalytics(_req: Request, res: Response) {
  try {
    const [
      totalPapers,
      totalStudents,
      totalExams,
      papersBySubjectAgg,
      papersByClassAgg,
      performanceBySubjectAgg,
      recentPapers,
      recentExams,
      topStudentsAgg
    ] = await Promise.all([
      GeneratedPaper.countDocuments(),
      Student.countDocuments(),
      Exam.countDocuments(),
      GeneratedPaper.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$subject", count: { $sum: 1 } } }
      ]),
      GeneratedPaper.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$class", count: { $sum: 1 } } }
      ]),
      Exam.aggregate<any>([
        { $sort: { exam_date: -1 } },
        {
          $group: {
            _id: "$subject",
            exam_count: { $sum: 1 },
            average_percentage: { $avg: "$percentage" },
            latest_percentage: { $first: "$percentage" }
          }
        }
      ]),
      GeneratedPaper.find()
        .sort({ created_at: -1 })
        .limit(5)
        .select("_id title subject class created_at")
        .lean(),
      Exam.find()
        .sort({ exam_date: -1 })
        .limit(5)
        .select("_id subject exam_type percentage total_marks exam_date")
        .lean(),
      Student.aggregate<any>([
        {
          $lookup: {
            from: "exams",
            let: { studentId: { $toString: "$_id" } },
            pipeline: [
              { $match: { $expr: { $eq: [{ $toString: "$student_id" }, "$$studentId"] } } },
              { $project: { percentage: 1 } }
            ],
            as: "exams"
          }
        },
        {
          $addFields: {
            exam_count: { $size: "$exams" },
            average_percentage: { $avg: "$exams.percentage" }
          }
        },
        { $match: { exam_count: { $gt: 0 } } },
        { $sort: { average_percentage: -1, exam_count: -1 } },
        { $limit: 5 },
        { $project: { _id: 1, name: 1, class: 1, exam_count: 1, average_percentage: 1 } }
      ])
    ]);

    const papersBySubject = papersBySubjectAgg.map((agg) => ({
      label: String(agg._id || "").trim(),
      count: agg.count
    })).filter((item) => item.label);

    const papersByClass = papersByClassAgg.map((agg) => ({
      label: normalizeClassLabel(agg._id) || agg._id,
      count: agg.count
    })).filter((item) => item.label);

    // Re-combine and normalize classes if there were duplicates due to case/spacing before normalization
    const normalizedPapersByClass = Object.values(
      papersByClass.reduce<Record<string, { label: string; count: number }>>((acc, curr) => {
        acc[curr.label] = acc[curr.label] || { label: curr.label, count: 0 };
        acc[curr.label].count += curr.count;
        return acc;
      }, {}),
    );

    const performanceBySubject = performanceBySubjectAgg.map((agg) => ({
      subject: String(agg._id || "").trim(),
      exam_count: agg.exam_count,
      average_percentage: Number((agg.average_percentage || 0).toFixed(2)),
      latest_percentage: agg.latest_percentage ?? null
    })).filter((item) => item.subject);

    const averageScore = performanceBySubject.length > 0
      ? Number((performanceBySubject.reduce((sum, s) => sum + s.average_percentage, 0) / performanceBySubject.length).toFixed(2))
      : 0;

    const recentActivity = [
      ...recentPapers.map((paper) => ({
        id: `paper-${paper._id}`,
        type: "paper",
        title: paper.title,
        subtitle: `${paper.subject} | ${normalizeClassLabel(paper.class) || paper.class}`,
        timestamp: paper.created_at,
      })),
      ...recentExams.map((exam) => ({
        id: `exam-${exam._id}`,
        type: "exam",
        title: `${exam.subject} ${exam.exam_type}`,
        subtitle: `${exam.percentage ?? "N/A"}% | ${exam.total_marks} marks`,
        timestamp: exam.exam_date,
      })),
    ]
      .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime())
      .slice(0, 8);

    const topStudents = topStudentsAgg.map((student) => ({
      id: student._id,
      name: student.name,
      class: normalizeClassLabel(student.class) || student.class,
      exam_count: student.exam_count,
      average_percentage: Number((student.average_percentage || 0).toFixed(2)),
    }));

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          total_papers: totalPapers,
          total_students: totalStudents,
          analyzed_exams: totalExams,
          average_score: averageScore,
          pdf_papers: totalPapers,
        },
        papers_by_subject: papersBySubject,
        papers_by_class: normalizedPapersByClass,
        performance_by_subject: performanceBySubject,
        recent_activity: recentActivity,
        top_students: topStudents,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching teacher analytics:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

function buildHistoryFeedback(latestExam: ExamLike, previousExam: ExamLike): string | null {
  if (!latestExam) {
    return null;
  }

  if (!previousExam || latestExam.percentage == null || previousExam.percentage == null) {
    if (latestExam.priority_topics?.length) {
      return `Focus next on ${latestExam.priority_topics.slice(0, 3).join(", ")} to improve your score further.`;
    }

    return "Keep practicing consistently and review your weak chapters before the next exam.";
  }

  const delta = Number(latestExam.percentage) - Number(previousExam.percentage);

  if (delta > 0) {
    return `You improved by ${delta.toFixed(1)} points compared with your previous exam. Keep building on that momentum.`;
  }

  if (delta < 0) {
    return `Your score dropped by ${Math.abs(delta).toFixed(1)} points compared with the previous exam. Revisit your recent weak topics before the next test.`;
  }

  return "Your score is steady compared with the previous exam. A little more practice can help push it higher.";
}

function buildSubjectBreakdown(exams: ExamLike[]) {
  const subjectMap = new Map<string, ExamLike[]>();

  for (const exam of exams) {
    const key = String(exam.subject || "").trim();
    if (!key) {
      continue;
    }

    if (!subjectMap.has(key)) {
      subjectMap.set(key, []);
    }

    subjectMap.get(key)!.push(exam);
  }

  return [...subjectMap.entries()].map(([subject, subjectExams]) => ({
    subject,
    exam_count: subjectExams.length,
    average_percentage: calculateAveragePercentage(subjectExams),
    latest_percentage:
      subjectExams.find((exam) => typeof exam.percentage === "number")?.percentage ?? null,
  }));
}

function calculateAveragePercentage(exams: ExamLike[]): number {
  const validPercentages = exams
    .map((exam) => exam.percentage)
    .filter((percentage): percentage is number => typeof percentage === "number");

  if (!validPercentages.length) {
    return 0;
  }

  const total = validPercentages.reduce((sum, percentage) => sum + percentage, 0);
  return Number((total / validPercentages.length).toFixed(2));
}

function calculateImprovement(latestExam: ExamLike, previousExam: ExamLike): number | null {
  if (
    !latestExam ||
    !previousExam ||
    typeof latestExam.percentage !== "number" ||
    typeof previousExam.percentage !== "number"
  ) {
    return null;
  }

  return Number((latestExam.percentage - previousExam.percentage).toFixed(2));
}

function deriveFocusTopics({
  latestExam,
  topicHealthDocs,
}: {
  latestExam: ExamLike;
  topicHealthDocs: TopicHealthLike[];
}): string[] {
  const directTopics: string[] = Array.isArray(latestExam?.priority_topics)
    ? latestExam.priority_topics.filter(Boolean)
    : [];

  if (directTopics.length > 0) {
    return directTopics;
  }

  const derivedTopics: string[] = [];

  for (const topicHealthDoc of topicHealthDocs) {
    for (const chapter of topicHealthDoc.topic_health || []) {
      for (const subTopic of chapter.sub_topics || []) {
        if (subTopic.status !== "crystal_clear") {
          derivedTopics.push(
            `${chapter.chapter_name || chapter.chapter}${subTopic.code ? ` - ${subTopic.code}` : ""}`,
          );
        }
      }
    }
  }

  return [...new Set(derivedTopics)];
}

function flattenWeakChapters(weakChapters: ExamLike[]): string[] {
  if (!Array.isArray(weakChapters)) {
    return [];
  }

  return weakChapters.flatMap((chapter) => {
    const chapterName = chapter.chapter_name || chapter.chapter || "Topic";
    if (Array.isArray(chapter.sub_topics) && chapter.sub_topics.length > 0) {
      return chapter.sub_topics.map((subTopic: string) => `${chapterName} - ${subTopic}`);
    }

    return [chapterName];
  });
}

function serializeExamSummary(exam: ExamLike) {
  return {
    id: exam._id,
    subject: exam.subject,
    exam_type: exam.exam_type,
    total_marks: exam.total_marks,
    scored_marks: exam.scored_marks,
    percentage: exam.percentage,
    exam_date: exam.exam_date,
    weak_chapters: exam.weak_chapters || [],
    strong_chapters: exam.strong_chapters || [],
    suggested_goal: exam.suggested_goal || null,
    priority_topics: exam.priority_topics || [],
  };
}

function serializeExamDetail(exam: ExamLike) {
  return {
    ...serializeExamSummary(exam),
    has_sections: exam.has_sections || false,
  };
}

function serializeTopicHealth(topicHealthDoc: TopicHealthLike) {
  return {
    subject: topicHealthDoc.subject,
    updated_at: topicHealthDoc.updatedAt || null,
    topic_health: (topicHealthDoc.topic_health || []).map((chapter: any) => ({
      chapter: chapter.chapter,
      chapter_name: chapter.chapter_name || chapter.chapter,
      sub_topics: chapter.sub_topics || [],
    })),
  };
}
