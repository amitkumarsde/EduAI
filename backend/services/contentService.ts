// services/contentService.ts
//
// Smart content recommendations (#11) and meta-learning strategy suggestions
// (#12). Given a subject and the student's weak topics, Gemini proposes study
// resources and learning strategies. To stay honest we ask for search queries
// rather than fabricated URLs; the frontend turns those into YouTube/web
// search links.

import { callGeminiText } from "./geminiService.js";
import Student from "../models/Student.js";
import Exam from "../models/Exam.js";
import TopicHealth from "../models/TopicHealth.js";
import type { Types } from "mongoose";

export type ResourceType = "video" | "article" | "flashcards" | "practice";

export interface ContentResource {
  topic: string;
  type: ResourceType;
  title: string;
  description: string;
  search_query: string;
}

export interface LearningStrategy {
  name: string;
  description: string;
  when_to_use: string;
}

export interface ContentRecommendations {
  subject: string;
  weak_topics: string[];
  resources: ContentResource[];
  strategies: LearningStrategy[];
}

const RESOURCE_TYPES: ResourceType[] = ["video", "article", "flashcards", "practice"];

/** Collect weak topic labels for a student in a subject from exams + topic health. */
async function collectWeakTopics(
  studentId: Types.ObjectId | string,
  subject: string,
): Promise<string[]> {
  const [latestExam, topicHealth] = await Promise.all([
    Exam.findOne({ student_id: studentId, subject }).sort({ exam_date: -1 }).lean(),
    TopicHealth.findOne({ student_id: studentId, subject }).lean(),
  ]);

  const fromExam = (latestExam?.weak_chapters || []).flatMap((c) =>
    (c.sub_topics && c.sub_topics.length ? c.sub_topics : [c.chapter_name]).filter(Boolean),
  ) as string[];

  const fromHealth = (topicHealth?.topic_health || [])
    .flatMap((chapter) =>
      (chapter.sub_topics || [])
        .filter((s) => s.status !== "crystal_clear")
        .map(() => chapter.chapter_name || chapter.chapter),
    )
    .filter(Boolean) as string[];

  const priority = (latestExam?.priority_topics || []) as string[];

  return Array.from(new Set([...priority, ...fromExam, ...fromHealth])).slice(0, 8);
}

export async function getContentRecommendations({
  studentId,
  subject,
  weakTopics,
  studentClass,
  language = "English",
}: {
  studentId?: Types.ObjectId | string | null;
  subject: string;
  weakTopics?: string[];
  studentClass?: string;
  language?: string;
}): Promise<ContentRecommendations> {
  let topics = weakTopics && weakTopics.length ? weakTopics : [];
  let className = studentClass || "";

  if (studentId) {
    if (!topics.length) topics = await collectWeakTopics(studentId, subject);
    if (!className) {
      const student = await Student.findById(studentId).lean();
      className = student?.class || "";
    }
  }

  const prompt = `
You are a study coach for a school student${className ? ` in ${className}` : ""}.
Subject: ${subject}.
Weak / priority topics: ${JSON.stringify(topics.length ? topics : ["core fundamentals of the subject"])}.

Recommend study content and meta-learning strategies. Write everything in ${language}.

For resources, give a realistic, specific "search_query" the student can paste
into YouTube or a search engine — do NOT invent URLs.

Return ONLY valid JSON:
{
  "resources": [
    { "topic": "string", "type": "video|article|flashcards|practice",
      "title": "string", "description": "one line", "search_query": "string" }
  ],
  "strategies": [
    { "name": "Spaced repetition|Concept mapping|Mixed practice|...",
      "description": "what it is", "when_to_use": "when it helps this student" }
  ]
}
Give 4-6 resources (mix of types) and 3-4 strategies.
`.trim();

  let resources: ContentResource[] = [];
  let strategies: LearningStrategy[] = [];

  try {
    const json = await callGeminiText({ prompt });
    resources = (Array.isArray((json as any)?.resources) ? (json as any).resources : [])
      .map((r: any) => ({
        topic: String(r?.topic || subject),
        type: RESOURCE_TYPES.includes(r?.type) ? r.type : "video",
        title: String(r?.title || "Study resource"),
        description: String(r?.description || ""),
        search_query: String(r?.search_query || `${subject} ${r?.topic || ""}`).trim(),
      }))
      .slice(0, 8);
    strategies = (Array.isArray((json as any)?.strategies) ? (json as any).strategies : [])
      .map((s: any) => ({
        name: String(s?.name || "Strategy"),
        description: String(s?.description || ""),
        when_to_use: String(s?.when_to_use || ""),
      }))
      .slice(0, 6);
  } catch (error) {
    console.error("getContentRecommendations failed:", error);
  }

  return { subject, weak_topics: topics, resources, strategies };
}
