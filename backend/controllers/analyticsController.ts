import type { Request, Response } from "express";
import Exam from "../models/Exam.js";
import TopicHealth from "../models/TopicHealth.js";
import type { SubTopicStatus } from "../models/TopicHealth.js";

const STATUS_SCORE: Record<SubTopicStatus, number> = {
  crystal_clear: 100,
  partial_understanding: 50,
  no_knowledge: 0,
};

interface HeatmapChapter {
  chapter_name: string;
  mastery: number; // 0-100
  clear: number;
  partial: number;
  gaps: number;
}

interface HeatmapSubject {
  subject: string;
  exam_count: number;
  latest_percentage: number | null;
  average_percentage: number | null;
  mastery: number;
  chapters: HeatmapChapter[];
}

/**
 * GET /api/v1/students/:studentId/heatmap
 * Topic-level mastery heat map built from topic-health records and exams.
 */
export async function getStudentHeatmap(req: Request, res: Response) {
  try {
    const { studentId } = req.params;

    const [exams, topicHealthDocs] = await Promise.all([
      Exam.find({ student_id: studentId }).sort({ exam_date: 1 }).lean(),
      TopicHealth.find({ student_id: studentId }).lean(),
    ]);

    // Per-subject exam stats.
    const examStats = new Map<string, { scores: number[]; latest: number | null }>();
    for (const exam of exams) {
      const subject = exam.subject || "General";
      const entry = examStats.get(subject) || { scores: [], latest: null };
      if (typeof exam.percentage === "number") {
        entry.scores.push(exam.percentage);
        entry.latest = exam.percentage; // exams sorted ascending → last wins
      }
      examStats.set(subject, entry);
    }

    const subjects: HeatmapSubject[] = topicHealthDocs.map((doc) => {
      const chapters: HeatmapChapter[] = (doc.topic_health || []).map((chapter) => {
        const subs = chapter.sub_topics || [];
        const clear = subs.filter((s) => s.status === "crystal_clear").length;
        const partial = subs.filter((s) => s.status === "partial_understanding").length;
        const gaps = subs.filter((s) => s.status === "no_knowledge").length;
        const mastery =
          subs.length > 0
            ? Math.round(
                subs.reduce((sum, s) => sum + (STATUS_SCORE[s.status] ?? 0), 0) / subs.length,
              )
            : 0;
        return {
          chapter_name: chapter.chapter_name || chapter.chapter,
          mastery,
          clear,
          partial,
          gaps,
        };
      });

      const subjectMastery =
        chapters.length > 0
          ? Math.round(chapters.reduce((s, c) => s + c.mastery, 0) / chapters.length)
          : 0;

      const stats = examStats.get(doc.subject);
      const average =
        stats && stats.scores.length
          ? Math.round((stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) * 10) / 10
          : null;

      return {
        subject: doc.subject,
        exam_count: stats?.scores.length ?? 0,
        latest_percentage: stats?.latest ?? null,
        average_percentage: average,
        mastery: subjectMastery,
        chapters: chapters.sort((a, b) => a.mastery - b.mastery),
      };
    });

    return res.status(200).json({ success: true, data: { subjects } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("getStudentHeatmap error:", error);
    return res.status(500).json({ success: false, message });
  }
}
