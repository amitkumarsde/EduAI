import type { Request, Response } from "express";
import Student from "../models/Student.js";
import { normalizeClassLabel, buildClassMatcher } from "../utils/classUtils.js";

interface LeaderboardAggRow {
  _id: unknown;
  name: string;
  class: string;
  school: string;
  exam_count: number;
  average_percentage: number;
}

/**
 * GET /api/v1/leaderboard?class=Class%2010
 * Ranks students by average exam percentage. Optionally filtered by class.
 */
export async function getLeaderboard(req: Request, res: Response) {
  try {
    const classFilter = req.query?.class
      ? buildClassMatcher(req.query.class)
      : null;

    const match = classFilter ? { class: classFilter } : {};

    const ranked = await Student.aggregate<LeaderboardAggRow>([
      { $match: match },
      {
        $lookup: {
          from: "exams",
          let: { studentId: { $toString: "$_id" } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: [{ $toString: "$student_id" }, "$$studentId"] },
              },
            },
            { $project: { percentage: 1 } },
          ],
          as: "exams",
        },
      },
      {
        $addFields: {
          exam_count: { $size: "$exams" },
          average_percentage: { $avg: "$exams.percentage" },
        },
      },
      { $match: { exam_count: { $gt: 0 } } },
      { $sort: { average_percentage: -1, exam_count: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 1,
          name: 1,
          class: 1,
          school: 1,
          exam_count: 1,
          average_percentage: 1,
        },
      },
    ]);

    const leaderboard = ranked.map((student, index) => ({
      rank: index + 1,
      id: student._id,
      name: student.name,
      class: normalizeClassLabel(student.class) || student.class,
      school: student.school,
      exam_count: student.exam_count,
      average_percentage: Number((student.average_percentage || 0).toFixed(1)),
    }));

    return res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Leaderboard error:", error);
    return res.status(500).json({ success: false, message });
  }
}
