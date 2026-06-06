import express from "express";
import { protect } from "../middleware/auth.js";
import { imageUpload, withUploadErrors } from "../middleware/upload.js";
import { ocrEvaluate } from "../controllers/offlineController.js";

const router = express.Router();

// OCR-evaluate a single handwritten answer photo (called on reconnect).
router.post(
  "/ocr",
  protect,
  withUploadErrors(imageUpload.single("image")),
  ocrEvaluate,
);

export default router;
