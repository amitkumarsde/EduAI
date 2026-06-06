import express from "express";
import { askTutorQuestion } from "../controllers/tutorController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Authenticated so the tutor can use the student's performance context.
router.post("/ask", protect, askTutorQuestion);

export default router;
