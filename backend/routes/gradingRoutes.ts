import express from "express";
import { protect, requireRole } from "../middleware/auth.js";
import {
  gradeEssayAnswer,
  checkAnswerSimilarity,
} from "../controllers/gradingController.js";

const router = express.Router();

// Essay auto-grading and similarity checks are teacher tools.
router.post("/essay", protect, requireRole("teacher"), gradeEssayAnswer);
router.post("/similarity", protect, requireRole("teacher"), checkAnswerSimilarity);

export default router;
