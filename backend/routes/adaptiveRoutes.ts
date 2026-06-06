import express from "express";
import { getNextAdaptiveQuestion } from "../controllers/adaptiveController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/next", protect, getNextAdaptiveQuestion);

export default router;
