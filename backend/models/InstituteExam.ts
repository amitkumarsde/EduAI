// models/InstituteExam.ts
//
// A B2B exam authored by an institute/teacher. Questions can be MCQ or
// descriptive. Students discover these by institute name or exam code, attempt
// them with a live timer, and receive an auto-generated report.

import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export type InstituteQuestionType = "mcq" | "descriptive";

export interface InstituteQuestion {
  qid: string;
  type: InstituteQuestionType;
  question_text: string;
  options: string[]; // MCQ only
  correct_option: string | null; // "A".."D" for MCQ, null for descriptive
  model_answer: string | null; // optional reference answer for descriptive grading
  marks: number;
}

export interface IInstituteExam {
  exam_code: string;
  title: string;
  institute_name: string;
  created_by: Types.ObjectId;
  subject: string;
  class: string | null;
  description: string;
  duration_minutes: number;
  difficulty: string;
  total_marks: number;
  passing_marks: number;
  questions: InstituteQuestion[];
  published: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InstituteExamDocument = HydratedDocument<IInstituteExam>;

const instituteQuestionSchema = new Schema<InstituteQuestion>(
  {
    qid: { type: String, required: true },
    type: { type: String, enum: ["mcq", "descriptive"], required: true },
    question_text: { type: String, required: true },
    options: { type: [String], default: [] },
    correct_option: { type: String, default: null },
    model_answer: { type: String, default: null },
    marks: { type: Number, default: 1 },
  },
  { _id: false },
);

const instituteExamSchema = new Schema<IInstituteExam>(
  {
    exam_code: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    institute_name: { type: String, required: true, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, default: "General" },
    class: { type: String, default: null },
    description: { type: String, default: "" },
    duration_minutes: { type: Number, default: 30 },
    difficulty: { type: String, default: "medium" },
    total_marks: { type: Number, default: 0 },
    passing_marks: { type: Number, default: 0 },
    questions: { type: [instituteQuestionSchema], default: [] },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const InstituteExam = model<IInstituteExam>("InstituteExam", instituteExamSchema);

export default InstituteExam;
