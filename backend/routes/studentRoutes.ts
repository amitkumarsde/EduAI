import express, { type Request, type Response } from "express";
import Student from "../models/Student.js";
import { generateWeakTopicPracticeQuiz } from "../controllers/practiceController.js";
import {
  getStudentOverview,
  getStudentsList,
  getTeacherAnalytics,
} from "../controllers/dashboardController.js";
import { getStudentInsights } from "../controllers/insightsController.js";
import { getStudentHeatmap } from "../controllers/analyticsController.js";
import { getLeaderboard } from "../controllers/leaderboardController.js";
import { buildClassMatcher, normalizeClassLabel } from "../utils/classUtils.js";

const router = express.Router();

router.get("/students", getStudentsList);
router.get("/students/:studentId/overview", getStudentOverview);
router.get("/students/:studentId/insights", getStudentInsights);
router.get("/students/:studentId/heatmap", getStudentHeatmap);
router.get("/analytics/overview", getTeacherAnalytics);
router.get("/leaderboard", getLeaderboard);

router.post("/student/create", async (req: Request, res: Response) => {
  try {
    const normalizedName = String(req.body?.name || "").trim();
    const normalizedSchool = String(req.body?.school || "").trim();
    const normalizedClass = normalizeClassLabel(req.body?.class);

    if (
      normalizedName.length > 100 ||
      normalizedSchool.length > 200 ||
      String(req.body?.class || "").length > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Input fields exceed maximum allowed length.",
      });
    }

    let student = await Student.findOne({
      name: normalizedName,
      class: buildClassMatcher(normalizedClass) ?? undefined,
    });

    if (student) {
      student.class = normalizedClass;
      if (normalizedSchool) {
        student.school = normalizedSchool;
      }

      await student.save();
      res.status(200).json({ success: true, data: student });
      return;
    }

    student = await Student.create({
      ...req.body,
      name: normalizedName,
      school: normalizedSchool,
      class: normalizedClass,
    });
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

router.get("/student/:id", async (req: Request, res: Response) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }
    res.status(200).json({ success: true, data: student });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message });
  }
});

router.post("/student/practice-quiz", generateWeakTopicPracticeQuiz);

export default router;
