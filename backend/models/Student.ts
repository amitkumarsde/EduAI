import mongoose, {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from "mongoose";
import type { ExamDocument } from "./Exam.js";
import type { TopicHealthDocument } from "./TopicHealth.js";
import type { QuizDocument } from "./Quiz.js";
import type { StudentResponseDocument } from "./StudentResponse.js";

export interface IStudent {
  name: string;
  class: string;
  school: string;
  created_at: Date;
}

// Populate virtuals (only present after .populate()).
export interface IStudentVirtuals {
  exams: ExamDocument[];
  topic_health_records: TopicHealthDocument[];
  quizzes: QuizDocument[];
  responses: StudentResponseDocument[];
}

export type StudentModel = Model<
  IStudent,
  Record<string, never>,
  Record<string, never>,
  IStudentVirtuals
>;
export type StudentDocument = HydratedDocument<
  IStudent,
  IStudentVirtuals
>;

const studentSchema = new Schema<IStudent, StudentModel>(
  {
    name: {
      type: String,
      required: true,
    },
    class: {
      type: String,
      required: true,
    },
    school: {
      type: String,
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

studentSchema.virtual("exams", {
  ref: "Exam",
  localField: "_id",
  foreignField: "student_id",
});

studentSchema.virtual("topic_health_records", {
  ref: "TopicHealth",
  localField: "_id",
  foreignField: "student_id",
});

studentSchema.virtual("quizzes", {
  ref: "Quiz",
  localField: "_id",
  foreignField: "student_id",
});

studentSchema.virtual("responses", {
  ref: "StudentResponse",
  localField: "_id",
  foreignField: "student_id",
});

studentSchema.index({ name: 1, class: 1 });

const Student = model<IStudent, StudentModel>("Student", studentSchema);

export default Student;
