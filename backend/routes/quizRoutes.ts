import express from "express";
import { protect } from "../middleware/auth.js";
import {
  submitQuizAttempt,
  saveQuizProgress,
  listQuizAttempts,
  getQuizAttempt,
} from "../controllers/quizController.js";

const router = express.Router();

// All quiz-attempt endpoints require an authenticated user so attempts are
// always scoped to a student the caller is allowed to act on.
router.post("/attempts", protect, submitQuizAttempt);
router.post("/attempts/progress", protect, saveQuizProgress);
router.get("/attempts", protect, listQuizAttempts);
router.get("/attempts/:attemptId", protect, getQuizAttempt);

export default router;
