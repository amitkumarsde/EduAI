import mongoose, { Schema, model, type HydratedDocument, type Types } from "mongoose";

export type ExamType = "UT-1" | "UT-2" | "Mid-Term" | "Final";

export interface ChapterSummary {
  chapter_name: string;
  sub_topics: string[];
}

export interface ExamFileMeta {
  file_url?: string | null;
  file_type?: string | null;
  uploaded_at?: Date | null;
}

export interface ChapterInScope {
  chapter_code?: string;
  chapter_name?: string;
}

export interface IExam {
  student_id: Types.ObjectId;
  exam_type: ExamType;
  subject: string;
  total_marks: number;
  scored_marks: number | null;
  percentage: number | null;
  exam_date: Date;
  has_sections: boolean;
  suggested_goal: string | null;
  goal_set_by: "student" | "ai_suggested" | null;
  weak_chapters: ChapterSummary[];
  strong_chapters: ChapterSummary[];
  priority_topics: string[];
  chapters_in_scope: ChapterInScope[];
  uploads: {
    question_paper?: ExamFileMeta;
    answer_sheet?: ExamFileMeta;
  };
  ai_processed: boolean;
  created_at: Date;
}

export type ExamDocument = HydratedDocument<IExam>;

const chapterSummarySchema = new Schema<ChapterSummary>(
  {
    chapter_name: { type: String, required: true },
    sub_topics: { type: [String], default: [] },
  },
  { _id: false },
);

const examSchema = new Schema<IExam>({
  student_id: {
    type: Schema.Types.ObjectId,
    ref: "Student",
    required: true,
    index: true,
  },
  exam_type: {
    type: String,
    enum: ["UT-1", "UT-2", "Mid-Term", "Final"],
    required: true,
  },
  subject: {
    type: String,
    required: true,
    index: true,
  },
  total_marks: {
    type: Number,
    required: true,
  },
  scored_marks: {
    type: Number,
    default: null,
  },
  percentage: {
    type: Number,
    default: null,
  },
  exam_date: {
    type: Date,
    required: true,
    index: true,
  },
  has_sections: {
    type: Boolean,
    default: false,
  },
  suggested_goal: {
    type: String,
    default: null,
  },
  goal_set_by: {
    type: String,
    enum: ["student", "ai_suggested", null],
    default: null,
  },
  weak_chapters: {
    type: [chapterSummarySchema],
    default: [],
  },
  strong_chapters: {
    type: [chapterSummarySchema],
    default: [],
  },
  priority_topics: {
    type: [String],
    default: [],
  },
  chapters_in_scope: [
    {
      chapter_code: String,
      chapter_name: String,
    },
  ],
  uploads: {
    question_paper: {
      file_url: String,
      file_type: String,
      uploaded_at: Date,
    },
    answer_sheet: {
      file_url: String,
      file_type: String,
      uploaded_at: Date,
    },
  },
  ai_processed: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

examSchema.index({ student_id: 1, subject: 1, exam_date: -1 });

const Exam = model<IExam>("Exam", examSchema);

export default Exam;
