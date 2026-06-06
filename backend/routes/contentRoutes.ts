import express from "express";
import { protect } from "../middleware/auth.js";
import { fetchContentRecommendations } from "../controllers/contentController.js";

const router = express.Router();

router.post("/recommendations", protect, fetchContentRecommendations);

export default router;
