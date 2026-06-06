import express from "express";
import { protect, requireRole } from "../middleware/auth.js";
import {
  generateQuestions,
  createExam,
  listMyExams,
  getExamForAuthor,
  listExamAttempts,
  searchExams,
  getExamToTake,
  startAttempt,
  submitAttempt,
  getAttemptReport,
  listMyAttempts,
} from "../controllers/instituteController.js";

const router = express.Router();

// ---- Authoring (teacher / institute) ----
router.post("/generate-questions", protect, requireRole("teacher"), generateQuestions);
router.post("/exams", protect, requireRole("teacher"), createExam);
router.get("/exams", protect, requireRole("teacher"), listMyExams);
router.get("/exams/:examId", protect, requireRole("teacher"), getExamForAuthor);
router.get("/exams/:examId/attempts", protect, requireRole("teacher"), listExamAttempts);

// ---- Taking (any authenticated user) ----
router.get("/search", protect, searchExams);
router.get("/my-attempts", protect, listMyAttempts);
router.get("/take/:examCode", protect, getExamToTake);
router.post("/take/:examCode/start", protect, startAttempt);
router.post("/attempts/:attemptId/submit", protect, submitAttempt);
router.get("/attempts/:attemptId/report", protect, getAttemptReport);

export default router;
