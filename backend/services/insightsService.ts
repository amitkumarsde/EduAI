import Student from "../models/Student.js";
import Exam from "../models/Exam.js";
import TopicHealth from "../models/TopicHealth.js";
import type { Types } from "mongoose";

type RiskLevel = "low" | "medium" | "high";

export interface SubjectInsight {
  subject: string;
  latest_percentage: number;
  average_percentage: number;
  trend: number;
  risk_level: RiskLevel;
  predicted_next_percentage: number;
  exam_count: number;
}

export interface InsightAlert {
  severity: RiskLevel;
  subject: string | null;
  message: string;
}

export interface AtRiskTopic {
  topic: string;
  occurrences: number;
  priority: "high" | "medium";
}

export interface StudentInsightsResult {
  student: { id: Types.ObjectId; name: string; class: string };
  overall_risk: RiskLevel;
  subjects: SubjectInsight[];
  at_risk_topics: AtRiskTopic[];
  alerts: InsightAlert[];
  recommended_actions: string[];
}

/**
 * Predictive insights & early-warning alerts.
 *
 * This is a transparent, data-driven analysis (no external API needed) that:
 *  - scores each subject's risk from score level + recent trend
 *  - surfaces topics that repeatedly appear as weak ("at risk")
 *  - emits human-readable alerts and recommended actions
 */
export async function computeStudentInsights(
  studentId: string,
): Promise<StudentInsightsResult> {
  const [student, exams, topicHealthDocs] = await Promise.all([
    Student.findById(studentId).lean(),
    Exam.find({ student_id: studentId }).sort({ exam_date: 1 }).lean(),
    TopicHealth.find({ student_id: studentId }).lean(),
  ]);

  if (!student) {
    const error = new Error("Student not found") as Error & {
      statusCode?: number;
    };
    error.statusCode = 404;
    throw error;
  }

  const bySubject = new Map<string, typeof exams>();
  for (const exam of exams) {
    const subject = String(exam.subject || "General").trim();
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject)!.push(exam);
  }

  const subjectInsights: SubjectInsight[] = [];
  const alerts: InsightAlert[] = [];

  for (const [subject, subjectExams] of bySubject.entries()) {
    const percentages = subjectExams
      .map((exam) => exam.percentage)
      .filter((value): value is number => typeof value === "number");

    if (!percentages.length) continue;

    const latest = percentages[percentages.length - 1];
    const previous =
      percentages.length > 1 ? percentages[percentages.length - 2] : null;
    const average =
      percentages.reduce((sum, value) => sum + value, 0) / percentages.length;
    const trend = previous != null ? Number((latest - previous).toFixed(1)) : 0;

    // Risk scoring: lower score + downward trend => higher risk.
    let riskScore = 0;
    if (latest < 40) riskScore += 3;
    else if (latest < 55) riskScore += 2;
    else if (latest < 70) riskScore += 1;
    if (trend <= -10) riskScore += 2;
    else if (trend < 0) riskScore += 1;

    const riskLevel: RiskLevel =
      riskScore >= 4 ? "high" : riskScore >= 2 ? "medium" : "low";

    // Predicted next score: blend latest with the recent trend, clamped 0-100.
    const predictedNext = Math.max(
      0,
      Math.min(100, Math.round(latest + trend * 0.5)),
    );

    subjectInsights.push({
      subject,
      latest_percentage: Number(latest.toFixed(1)),
      average_percentage: Number(average.toFixed(1)),
      trend,
      risk_level: riskLevel,
      predicted_next_percentage: predictedNext,
      exam_count: subjectExams.length,
    });

    if (riskLevel === "high") {
      alerts.push({
        severity: "high",
        subject,
        message: `${subject} is at high risk — latest score ${Math.round(
          latest,
        )}%${trend < 0 ? ` and dropping (${trend} pts)` : ""}. Immediate revision recommended.`,
      });
    } else if (riskLevel === "medium") {
      alerts.push({
        severity: "medium",
        subject,
        message: `Keep an eye on ${subject} — scoring around ${Math.round(
          average,
        )}% on average.`,
      });
    }
  }

  // At-risk topics: weak chapters that recur across exams + "no_knowledge" topics.
  const topicCounts = new Map<string, number>();
  for (const exam of exams) {
    for (const chapter of exam.weak_chapters || []) {
      const name = chapter.chapter_name;
      if (!name) continue;
      topicCounts.set(name, (topicCounts.get(name) || 0) + 1);
    }
  }
  for (const doc of topicHealthDocs) {
    for (const chapter of doc.topic_health || []) {
      const struggling = (chapter.sub_topics || []).some(
        (sub) => sub.status === "no_knowledge",
      );
      if (struggling && chapter.chapter_name) {
        topicCounts.set(
          chapter.chapter_name,
          (topicCounts.get(chapter.chapter_name) || 0) + 1,
        );
      }
    }
  }

  const atRiskTopics: AtRiskTopic[] = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, occurrences]) => ({
      topic,
      occurrences,
      priority: occurrences >= 2 ? "high" : "medium",
    }));

  // Overall risk = worst subject risk.
  const order: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
  const overallRisk = subjectInsights.reduce<RiskLevel>(
    (worst, item) =>
      order[item.risk_level] > order[worst] ? item.risk_level : worst,
    "low",
  );

  const recommendedActions = buildRecommendedActions(
    overallRisk,
    atRiskTopics,
    subjectInsights,
  );

  if (!exams.length) {
    alerts.push({
      severity: "low",
      subject: null,
      message: "No exams analyzed yet. Upload an exam to unlock predictive insights.",
    });
  }

  return {
    student: { id: student._id, name: student.name, class: student.class },
    overall_risk: overallRisk,
    subjects: subjectInsights.sort(
      (a, b) => order[b.risk_level] - order[a.risk_level],
    ),
    at_risk_topics: atRiskTopics,
    alerts: alerts.sort(
      (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
    ),
    recommended_actions: recommendedActions,
  };
}

function severityWeight(severity: RiskLevel): number {
  return { high: 2, medium: 1, low: 0 }[severity] ?? 0;
}

function buildRecommendedActions(
  overallRisk: RiskLevel,
  atRiskTopics: AtRiskTopic[],
  subjectInsights: SubjectInsight[],
): string[] {
  const actions: string[] = [];

  if (overallRisk === "high") {
    actions.push("Schedule focused revision sessions this week for your weakest subject.");
    actions.push("Generate a practice quiz on your at-risk topics and aim for 80%+.");
  } else if (overallRisk === "medium") {
    actions.push("Add short daily practice (spaced repetition) on your weaker topics.");
  } else {
    actions.push("You're on track — keep up consistent practice to stay ahead.");
  }

  if (atRiskTopics.length) {
    actions.push(
      `Prioritize these topics: ${atRiskTopics
        .slice(0, 3)
        .map((item) => item.topic)
        .join(", ")}.`,
    );
  }

  const declining = subjectInsights.filter((item) => item.trend < 0);
  if (declining.length) {
    actions.push(
      `Reverse the dip in ${declining
        .map((item) => item.subject)
        .join(", ")} by reviewing recent mistakes before the next test.`,
    );
  }

  return actions;
}

export default computeStudentInsights;
