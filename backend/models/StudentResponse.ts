// models/StudentResponse.ts

import mongoose, { Schema, model, type HydratedDocument, type Types } from "mongoose";

export type ResponseStatus =
  | "fully_correct"
  | "partially_correct"
  | "completely_wrong"
  | "not_attempted";

export interface IStudentResponse {
  exam_id: Types.ObjectId;
  student_id: Types.ObjectId;
  question_id: Types.ObjectId;
  question_no: number;
  marks_available: number;
  marks_scored: number;
  status: ResponseStatus;
  breakdown: {
    formula_marks: number;
    steps_marks: number;
    final_answer_marks: number;
  };
  mistake_area: string | null;
  ai_feedback: string | null;
  created_at: Date;
}

export type StudentResponseDocument = HydratedDocument<IStudentResponse>;

const studentResponseSchema = new Schema<IStudentResponse>({
  exam_id: {
    type: Schema.Types.ObjectId,
    ref: "Exam",
    required: true,
  },
  student_id: {
    type: Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  question_id: {
    type: Schema.Types.ObjectId,
    ref: "Question",
    required: true,
  },
  question_no: {
    type: Number,
    required: true,
  },
  marks_available: {
    type: Number,
    required: true,
  },
  marks_scored: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: [
      "fully_correct",
      "partially_correct",
      "completely_wrong",
      "not_attempted",
    ],
    required: true,
  },
  breakdown: {
    formula_marks: { type: Number, default: 0 },
    steps_marks: { type: Number, default: 0 },
    final_answer_marks: { type: Number, default: 0 },
  },
  mistake_area: {
    type: String,
    default: null,
  },
  ai_feedback: {
    type: String,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const StudentResponse = model<IStudentResponse>(
  "StudentResponse",
  studentResponseSchema,
);

export default StudentResponse;
