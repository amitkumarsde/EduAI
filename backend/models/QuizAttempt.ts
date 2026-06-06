// models/QuizAttempt.ts
//
// A persisted record of a quiz a student actually took (practice, adaptive, or
// an offline quiz that was synced back). Unlike the legacy `Quiz` model (which
// only stored AI-scheduled quizzes), this captures the full question snapshot,
// the student's answers, the computed score, and supports pause/resume so a
// session survives a page refresh or going offline.

import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export type QuizAttemptSource = "practice" | "adaptive" | "offline";
export type QuizAttemptStatus = "in_progress" | "paused" | "completed";

export interface AttemptQuestion {
  question_no: number;
  question_text: string;
  options: string[];
  correct_option: string; // "A" | "B" | "C" | "D"
  focus_chapter?: string | null;
  focus_sub_topic?: string | null;
  explanation?: string | null;
  marks: number;
}

export interface AttemptResponse {
  question_no: number;
  selected_option: string | null; // "A".."D" or null if skipped
  is_correct: boolean;
  marks_scored: number;
}

export interface IQuizAttempt {
  student_id: Types.ObjectId;
  subject: string;
  source: QuizAttemptSource;
  title: string;
  difficulty: string;
  language: string;
  status: QuizAttemptStatus;
  questions: AttemptQuestion[];
  responses: AttemptResponse[];
  current_index: number;
  total_questions: number;
  correct_count: number;
  total_marks: number;
  scored_marks: number;
  percentage: number;
  time_spent_seconds: number;
  synced_from_offline: boolean;
  started_at: Date;
  completed_at: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type QuizAttemptDocument = HydratedDocument<IQuizAttempt>;

const attemptQuestionSchema = new Schema<AttemptQuestion>(
  {
    question_no: { type: Number, required: true },
    question_text: { type: String, required: true },
    options: { type: [String], default: [] },
    correct_option: { type: String, required: true },
    focus_chapter: { type: String, default: null },
    focus_sub_topic: { type: String, default: null },
    explanation: { type: String, default: null },
    marks: { type: Number, default: 1 },
  },
  { _id: false },
);

const attemptResponseSchema = new Schema<AttemptResponse>(
  {
    question_no: { type: Number, required: true },
    selected_option: { type: String, default: null },
    is_correct: { type: Boolean, default: false },
    marks_scored: { type: Number, default: 0 },
  },
  { _id: false },
);

const quizAttemptSchema = new Schema<IQuizAttempt>(
  {
    student_id: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    subject: { type: String, required: true },
    source: {
      type: String,
      enum: ["practice", "adaptive", "offline"],
      default: "practice",
    },
    title: { type: String, default: "Practice Quiz" },
    difficulty: { type: String, default: "adaptive" },
    language: { type: String, default: "English" },
    status: {
      type: String,
      enum: ["in_progress", "paused", "completed"],
      default: "completed",
      index: true,
    },
    questions: { type: [attemptQuestionSchema], default: [] },
    responses: { type: [attemptResponseSchema], default: [] },
    current_index: { type: Number, default: 0 },
    total_questions: { type: Number, default: 0 },
    correct_count: { type: Number, default: 0 },
    total_marks: { type: Number, default: 0 },
    scored_marks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    time_spent_seconds: { type: Number, default: 0 },
    synced_from_offline: { type: Boolean, default: false },
    started_at: { type: Date, default: Date.now },
    completed_at: { type: Date, default: null },
  },
  { timestamps: true },
);

quizAttemptSchema.index({ student_id: 1, createdAt: -1 });

const QuizAttempt = model<IQuizAttempt>("QuizAttempt", quizAttemptSchema);

export default QuizAttempt;
