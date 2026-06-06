import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import "./utils/loadEnv.js";
import { connectDB } from "./config/db.js";
import examRoutes from "./routes/examRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import tutorRoutes from "./routes/tutorRoutes.js";
import adaptiveRoutes from "./routes/adaptiveRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import offlineRoutes from "./routes/offlineRoutes.js";
import instituteRoutes from "./routes/instituteRoutes.js";
import proctorRoutes from "./routes/proctorRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";
import gradingRoutes from "./routes/gradingRoutes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Fail fast in production if the JWT secret is left at its insecure default,
// instead of silently signing guessable tokens.
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change_me_to_a_long_random_secret")
) {
  console.error("❌ JWT_SECRET must be set to a strong value in production.");
  process.exit(1);
}

app.use(express.json({ limit: "5mb" }));
// The frontend calls this API directly from the browser (cross-origin), so
// allow any origin. Auth is via Bearer JWT, not cookies, so this is safe.
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ success: true, status: "ok", time: new Date().toISOString() });
});

// Routes
app.use("/api", examRoutes);
app.use("/api/v1", studentRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/tutor", tutorRoutes);
app.use("/api/v1/adaptive", adaptiveRoutes);
app.use("/api/v1/quiz", quizRoutes);
app.use("/api/v1/offline", offlineRoutes);
app.use("/api/v1/institute", instituteRoutes);
app.use("/api/v1/proctor", proctorRoutes);
app.use("/api/v1/content", contentRoutes);
app.use("/api/v1/grading", gradingRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res
    .status(404)
    .json({ success: false, message: `Not found: ${req.method} ${req.path}` });
});

// Error handler
app.use(
  (err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(err?.status || 500).json({
      success: false,
      message: err?.message || "Internal server error",
    });
  },
);

// Start the server only after the database is connected.
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   CORS: allowing all origins`);
  });
});

export default app;
