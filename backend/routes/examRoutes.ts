import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeExam } from "../controllers/examController.js";
import {
  generatePaper,
  getAllPapers,
  getPaperById,
  getPapersByClass,
  downloadPaper,
} from "../controllers/paperController.js";

const router = express.Router();

const allowedExamFileMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const allowedExamFileExtensions = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]);

const allowedExamFileFormatsLabel = "PDF, JPG, JPEG, PNG, WEBP, HEIC, HEIF";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname || ""),
      );
    },
  }),
  limits: {
    files: 2,
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const mimeType = String(file.mimetype || "").toLowerCase();
    const hasSupportedMimeType = allowedExamFileMimeTypes.has(mimeType);
    const hasSupportedExtension = allowedExamFileExtensions.has(extension);

    if (hasSupportedMimeType || hasSupportedExtension) {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        `Unsupported file format for exam upload. Please upload ${allowedExamFileFormatsLabel} files.`,
      ),
    );
  },
});

const analyzeExamUpload = upload.fields([
  { name: "question_paper", maxCount: 1 },
  { name: "answer_sheet", maxCount: 1 },
]);

function handleAnalyzeExamUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  analyzeExamUpload(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          success: false,
          message:
            "Each uploaded file must be 20 MB or smaller. Supported formats: PDF, JPG, JPEG, PNG, WEBP, HEIC, HEIF.",
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Upload failed.",
    });
  });
}

router.post("/analyze-exam", handleAnalyzeExamUpload, analyzeExam);
router.post("/generate-paper", generatePaper);
router.get("/papers", getAllPapers);
router.get("/papers/:paperId/download", downloadPaper);
router.get("/papers/:paperId", getPaperById);
router.get("/papers/class/:stdClass", getPapersByClass);

export default router;
