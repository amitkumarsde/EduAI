// models/Question.ts

import mongoose, { Schema, model, type HydratedDocument, type Types } from "mongoose";

export type QuestionType = "2_marker" | "3_marker" | "5_marker" | "MCQ" | "case_based";

export interface IQuestion {
  exam_id: Types.ObjectId;
  question_no: number;
  chapter_code: string;
  chapter_name: string;
  sub_topic: string;
  marks_available: number;
  question_type: QuestionType;
  grading_breakdown: {
    formula: number;
    steps: number;
    final_answer: number;
  };
  section: string | null;
}

export type QuestionDocument = HydratedDocument<IQuestion>;

const questionSchema = new Schema<IQuestion>({
  exam_id: {
    type: Schema.Types.ObjectId,
    ref: "Exam",
    required: true,
  },
  question_no: {
    type: Number,
    required: true,
  },
  chapter_code: {
    type: String,
    required: true, // 'Ch-1'
  },
  chapter_name: {
    type: String,
    required: true, // 'Algebra'
  },
  sub_topic: {
    type: String,
    required: true, // 'A1', 'A2', 'A3', 'A4'
  },
  marks_available: {
    type: Number,
    required: true,
  },
  question_type: {
    type: String,
    enum: ["2_marker", "3_marker", "5_marker", "MCQ", "case_based"],
    required: true,
  },
  grading_breakdown: {
    formula: { type: Number, default: 0 }, // only for 5_marker
    steps: { type: Number, default: 0 },
    final_answer: { type: Number, default: 0 },
  },
  section: {
    type: String,
    default: null, // null for UT, 'A'/'B'/'C'/'D'/'E' for Mid-Term
  },
});

const Question = model<IQuestion>("Question", questionSchema);

export default Question;
