// models/InstituteAttempt.ts
//
// A student's attempt at an institute exam, with the auto-generated report
// embedded once submitted.

import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export interface AttemptAnswer {
  qid: string;
  answer: string; // option letter for MCQ, free text for descriptive
}

export interface QuestionAnalysis {
  qid: string;
  type: "mcq" | "descriptive";
  question_text: string;
  max_marks: number;
  awarded_marks: number;
  student_answer: string;
  correct_answer: string | null;
  is_correct: boolean | null;
  feedback: string;
}

export interface AttemptReport {
  total_marks: number;
  scored_marks: number;
  percentage: number;
  grade: string;
  performance_level: string;
  passed: boolean;
  question_analysis: QuestionAnalysis[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  generated_at: Date;
}

export type InstituteAttemptStatus = "in_progress" | "submitted";

export interface IInstituteAttempt {
  exam_id: Types.ObjectId;
  exam_code: string;
  user_id: Types.ObjectId | null;
  student_id: Types.ObjectId | null;
  student_name: string;
  student_email: string;
  answers: AttemptAnswer[];
  status: InstituteAttemptStatus;
  time_taken_seconds: number;
  started_at: Date;
  submitted_at: Date | null;
  report: AttemptReport | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InstituteAttemptDocument = HydratedDocument<IInstituteAttempt>;

const answerSchema = new Schema<AttemptAnswer>(
  { qid: { type: String, required: true }, answer: { type: String, default: "" } },
  { _id: false },
);

const questionAnalysisSchema = new Schema<QuestionAnalysis>(
  {
    qid: String,
    type: { type: String, enum: ["mcq", "descriptive"] },
    question_text: String,
    max_marks: Number,
    awarded_marks: Number,
    student_answer: String,
    correct_answer: { type: String, default: null },
    is_correct: { type: Boolean, default: null },
    feedback: { type: String, default: "" },
  },
  { _id: false },
);

const reportSchema = new Schema<AttemptReport>(
  {
    total_marks: Number,
    scored_marks: Number,
    percentage: Number,
    grade: String,
    performance_level: String,
    passed: Boolean,
    question_analysis: { type: [questionAnalysisSchema], default: [] },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    generated_at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const instituteAttemptSchema = new Schema<IInstituteAttempt>(
  {
    exam_id: { type: Schema.Types.ObjectId, ref: "InstituteExam", required: true, index: true },
    exam_code: { type: String, required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
    student_id: { type: Schema.Types.ObjectId, ref: "Student", default: null },
    student_name: { type: String, required: true },
    student_email: { type: String, default: "" },
    answers: { type: [answerSchema], default: [] },
    status: {
      type: String,
      enum: ["in_progress", "submitted"],
      default: "in_progress",
    },
    time_taken_seconds: { type: Number, default: 0 },
    started_at: { type: Date, default: Date.now },
    submitted_at: { type: Date, default: null },
    report: { type: reportSchema, default: null },
  },
  { timestamps: true },
);

const InstituteAttempt = model<IInstituteAttempt>(
  "InstituteAttempt",
  instituteAttemptSchema,
);

export default InstituteAttempt;
