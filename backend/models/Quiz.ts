// models/Quiz.ts

import mongoose, { Schema, model, type HydratedDocument, type Types } from "mongoose";

export interface QuizQuestion {
  question_no?: number;
  chapter_code?: string;
  sub_topic?: string;
  question_type?: string; // 'MCQ', 'short_answer'
  question_text?: string;
  options?: string[]; // only for MCQ
  correct_answer?: string;
  marks?: number;
}

export interface QuizResponse {
  question_no?: number;
  student_answer?: string;
  is_correct?: boolean;
  marks_scored?: number;
}

export interface IQuiz {
  student_id: Types.ObjectId;
  subject: string;
  trigger_type: "auto" | "manual";
  status: "pending" | "completed";
  scheduled_at: Date;
  completed_at: Date | null;
  questions: QuizQuestion[];
  responses: QuizResponse[];
  total_marks: number;
  scored_marks: number | null;
  created_at: Date;
}

export type QuizDocument = HydratedDocument<IQuiz>;

const quizSchema = new Schema<IQuiz>({
  student_id: {
    type: Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  trigger_type: {
    type: String,
    enum: ["auto", "manual"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending",
  },
  scheduled_at: {
    type: Date,
    default: Date.now,
  },
  completed_at: {
    type: Date,
    default: null,
  },
  questions: [
    {
      question_no: Number,
      chapter_code: String,
      sub_topic: String,
      question_type: String, // 'MCQ', 'short_answer'
      question_text: String,
      options: [String], // only for MCQ
      correct_answer: String,
      marks: Number,
    },
  ],
  responses: [
    {
      question_no: Number,
      student_answer: String,
      is_correct: Boolean,
      marks_scored: Number,
    },
  ],
  total_marks: {
    type: Number,
    default: 0,
  },
  scored_marks: {
    type: Number,
    default: null, // null until quiz completed
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const Quiz = model<IQuiz>("Quiz", quizSchema);

export default Quiz;
