import express from "express";
import { protect } from "../middleware/auth.js";
import { logProctorEvents, getSessionEvents } from "../controllers/proctorController.js";

const router = express.Router();

router.post("/events", protect, logProctorEvents);
router.get("/events/:sessionId", protect, getSessionEvents);

export default router;
