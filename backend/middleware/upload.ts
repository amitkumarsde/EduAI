// middleware/upload.ts
//
// Shared multer configuration using in-memory storage so handlers receive
// `file.buffer` directly (ideal for forwarding image bytes to Gemini without
// touching disk). Used by the offline OCR endpoints.

import multer from "multer";
import type { Request, Response, NextFunction } from "express";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
      cb(null, true);
      return;
    }
    cb(new Error("Unsupported image format. Use JPG, PNG, WEBP, HEIC, or HEIF."));
  },
});

/**
 * Wrap a multer middleware so its errors return clean 400 JSON instead of
 * bubbling to the generic error handler.
 */
export function withUploadErrors(
  middleware: (req: Request, res: Response, cb: (err: unknown) => void) => void,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    middleware(req, res, (error: unknown) => {
      if (!error) {
        next();
        return;
      }
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          success: false,
          message: "Image must be 15 MB or smaller.",
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Upload failed.",
      });
    });
  };
}
