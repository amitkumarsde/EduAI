import mongoose, { Schema, model, type HydratedDocument } from "mongoose";

export type GeneratedPaperExamType =
  | "UT-1"
  | "UT-2"
  | "Mid-Term"
  | "Final Exam"
  | "Seasonal Exam";

export interface PaperQuestion {
  question_no?: number;
  marks?: number;
  question_type?: string;
  question_text?: string;
  options?: string[] | null;
  internal_choice?: boolean;
  choice_text?: string | null;
  choice_question_text?: string | null;
  section?: string | null;
  case_passage?: string | null;
  [key: string]: unknown;
}

export interface IGeneratedPaper {
  title: string;
  subject: string;
  exam_type: GeneratedPaperExamType;
  class: string;
  chapters: string[];
  total_marks: number;
  num_questions: number;
  duration: string;
  format: "pdf";
  questions: PaperQuestion[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export type GeneratedPaperDocument = HydratedDocument<IGeneratedPaper>;

const generatedPaperSchema = new Schema<IGeneratedPaper>(
  {
    title: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
      index: true,
    },
    exam_type: {
      type: String,
      enum: ["UT-1", "UT-2", "Mid-Term", "Final Exam", "Seasonal Exam"],
      required: true,
    },
    class: {
      type: String,
      required: true,
    },
    chapters: {
      type: [String],
      required: true,
    },
    total_marks: {
      type: Number,
      required: true,
    },
    num_questions: {
      type: Number,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    format: {
      type: String,
      enum: ["pdf"],
      default: "pdf",
    },
    questions: {
      type: [Object],
      required: true,
    },
    created_by: {
      type: String,
      required: true, // teacher name or ID
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Index for quick lookups
generatedPaperSchema.index({ subject: 1, class: 1 });
generatedPaperSchema.index({ created_at: -1 });

const GeneratedPaper = model<IGeneratedPaper>(
  "GeneratedPaper",
  generatedPaperSchema,
);

export default GeneratedPaper;
