import mongoose, { Schema, model, type HydratedDocument, type Types } from "mongoose";

export type SubTopicStatus =
  | "crystal_clear"
  | "partial_understanding"
  | "no_knowledge";

export interface SubTopicHealth {
  code: string;
  status: SubTopicStatus;
}

export interface ChapterHealth {
  chapter: string;
  chapter_name?: string;
  sub_topics: SubTopicHealth[];
}

export interface ITopicHealth {
  student_id: Types.ObjectId;
  subject: string;
  topic_health: ChapterHealth[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type TopicHealthDocument = HydratedDocument<ITopicHealth>;

const subTopicSchema = new Schema<SubTopicHealth>(
  {
    code: { type: String, required: true },
    status: {
      type: String,
      enum: ["crystal_clear", "partial_understanding", "no_knowledge"],
      required: true,
    },
  },
  { _id: false },
);

const chapterHealthSchema = new Schema<ChapterHealth>(
  {
    chapter: { type: String, required: true },
    chapter_name: { type: String },
    sub_topics: { type: [subTopicSchema], default: [] },
  },
  { _id: false },
);

const topicHealthSchema = new Schema<ITopicHealth>(
  {
    student_id: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    subject: { type: String, required: true },
    topic_health: { type: [chapterHealthSchema], default: [] },
  },
  { timestamps: true },
);

const TopicHealth = model<ITopicHealth>("TopicHealth", topicHealthSchema);

export default TopicHealth;
