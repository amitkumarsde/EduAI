/**
 * Shared domain types for the EduAI frontend.
 * Shapes mirror the Express backend responses; optional fields stay loose
 * where the API is permissive.
 */

export type UserRole = "teacher" | "student";

export interface UserProfile {
  display_name?: string;
  avatar_color?: string;
  bio?: string;
}

export interface User {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  class?: string;
  school?: string;
  student_id?: string;
  profile?: UserProfile;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Student {
  id: string;
  _id?: string;
  name: string;
  class?: string;
  school?: string;
  [key: string]: unknown;
}

export interface QuestionOption {
  key?: string;
  text?: string;
}

export interface Question {
  id?: string;
  _id?: string;
  question?: string;
  text?: string;
  options?: string[] | QuestionOption[];
  correctAnswer?: string;
  answer?: string;
  marks?: number;
  difficulty?: string;
  subject?: string;
  topic?: string;
  explanation?: string;
  [key: string]: unknown;
}

export interface GeneratedPaper {
  id?: string;
  _id?: string;
  title?: string;
  subject?: string;
  class?: string;
  topic?: string;
  totalMarks?: number;
  duration?: number;
  questions?: Question[];
  createdAt?: string;
  [key: string]: unknown;
}

export interface PaperFormData {
  subject: string;
  class: string;
  topic?: string;
  difficulty?: string;
  numQuestions?: number;
  totalMarks?: number;
  duration?: number;
  questionTypes?: string[];
  [key: string]: unknown;
}

export interface Exam {
  id?: string;
  _id?: string;
  examId?: string;
  title?: string;
  subject?: string;
  status?: string;
  score?: number;
  totalMarks?: number;
  createdAt?: string;
  [key: string]: unknown;
}

export interface StudentOverview {
  student?: Student;
  stats?: Record<string, number | string>;
  recentExams?: Exam[];
  topics?: TopicHealth[];
  [key: string]: unknown;
}

export interface TopicHealth {
  topic?: string;
  subject?: string;
  score?: number;
  riskLevel?: "low" | "medium" | "high" | string;
  mastery?: number;
  [key: string]: unknown;
}

export interface StudentInsights {
  riskTopics?: TopicHealth[];
  recommendations?: Recommendation[];
  summary?: string;
  [key: string]: unknown;
}

export interface Recommendation {
  id?: string;
  title?: string;
  topic?: string;
  subject?: string;
  reason?: string;
  priority?: string;
  action?: string;
  [key: string]: unknown;
}

export interface TeacherAnalytics {
  totalStudents?: number;
  totalExams?: number;
  averageScore?: number;
  classPerformance?: Array<Record<string, unknown>>;
  topicHealth?: TopicHealth[];
  [key: string]: unknown;
}

export interface LeaderboardEntry {
  rank?: number;
  studentId?: string;
  name?: string;
  class?: string;
  score?: number;
  points?: number;
  avatar_color?: string;
  [key: string]: unknown;
}

export interface AdaptiveQuestion extends Question {
  difficulty?: string;
}

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PracticeQuiz {
  id?: string;
  subject?: string;
  questions?: Question[];
  [key: string]: unknown;
}

// ---------------- Persisted quiz attempts ----------------
export interface AttemptQuestion {
  question_no: number;
  question_text: string;
  options: string[];
  correct_option: string;
  focus_chapter?: string | null;
  focus_sub_topic?: string | null;
  explanation?: string | null;
  marks: number;
}

export interface AttemptResponse {
  question_no: number;
  selected_option: string | null;
  is_correct: boolean;
  marks_scored: number;
}

export interface QuizAttempt {
  _id?: string;
  student_id?: string;
  subject?: string;
  source?: "practice" | "adaptive" | "offline";
  title?: string;
  difficulty?: string;
  language?: string;
  status?: "in_progress" | "paused" | "completed";
  questions?: AttemptQuestion[];
  responses?: AttemptResponse[];
  current_index?: number;
  total_questions?: number;
  correct_count?: number;
  total_marks?: number;
  scored_marks?: number;
  percentage?: number;
  time_spent_seconds?: number;
  synced_from_offline?: boolean;
  started_at?: string;
  completed_at?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

// ---------------- Offline OCR ----------------
export interface OcrResult {
  extracted_text: string;
  confidence: number;
  confidence_label: "high" | "medium" | "low";
  legibility_issues: string[];
  preliminary_score: number;
  max_marks: number;
  feedback: string;
}

// ---------------- Institute (B2B) ----------------
export type InstituteQuestionType = "mcq" | "descriptive";

export interface InstituteQuestion {
  qid: string;
  type: InstituteQuestionType;
  question_text: string;
  options: string[];
  correct_option?: string | null;
  model_answer?: string | null;
  marks: number;
}

export interface InstituteExam {
  _id?: string;
  exam_code: string;
  title: string;
  institute_name: string;
  subject?: string;
  class?: string | null;
  description?: string;
  duration_minutes: number;
  difficulty?: string;
  total_marks: number;
  passing_marks?: number;
  questions: InstituteQuestion[];
  published?: boolean;
  createdAt?: string;
  [key: string]: unknown;
}

export interface InstituteExamSummary {
  id: string;
  exam_code: string;
  title: string;
  institute_name: string;
  subject?: string;
  class?: string | null;
  difficulty?: string;
  duration_minutes: number;
  total_marks: number;
  question_count: number;
}

export interface InstituteTakeQuestion {
  qid: string;
  type: InstituteQuestionType;
  question_text: string;
  options: string[];
  marks: number;
}

export interface InstituteExamToTake {
  id: string;
  exam_code: string;
  title: string;
  institute_name: string;
  subject?: string;
  difficulty?: string;
  duration_minutes: number;
  total_marks: number;
  questions: InstituteTakeQuestion[];
}

export interface InstituteQuestionAnalysis {
  qid: string;
  type: InstituteQuestionType;
  question_text: string;
  max_marks: number;
  awarded_marks: number;
  student_answer: string;
  correct_answer?: string | null;
  is_correct?: boolean | null;
  feedback: string;
}

export interface InstituteReport {
  total_marks: number;
  scored_marks: number;
  percentage: number;
  grade: string;
  performance_level: string;
  passed: boolean;
  question_analysis: InstituteQuestionAnalysis[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  generated_at?: string;
}

export interface InstituteAttemptSummary {
  id: string;
  exam_code: string;
  percentage: number;
  grade: string;
  passed: boolean;
  submitted_at?: string;
}

export interface InstituteExamAnalytics {
  exam: { id: string; title: string; exam_code: string; total_marks: number };
  summary: { submitted: number; average_percentage: number; pass_rate: number };
  attempts: Array<{
    id: string;
    student_name: string;
    student_email: string;
    percentage: number;
    grade: string;
    passed: boolean;
    submitted_at?: string;
  }>;
}

// ---------------- Smart content + meta-learning ----------------
export interface ContentResource {
  topic: string;
  type: "video" | "article" | "flashcards" | "practice";
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

// ---------------- Heat map ----------------
export interface HeatmapChapter {
  chapter_name: string;
  mastery: number;
  clear: number;
  partial: number;
  gaps: number;
}

export interface HeatmapSubject {
  subject: string;
  exam_count: number;
  latest_percentage: number | null;
  average_percentage: number | null;
  mastery: number;
  chapters: HeatmapChapter[];
}

export interface HeatmapData {
  subjects: HeatmapSubject[];
}

// ---------------- Essay grading + similarity ----------------
export interface EssayRubricScore {
  criterion: string;
  score: number;
  max: number;
  comment: string;
}

export interface EssayGradeResult {
  score: number;
  max_marks: number;
  percentage: number;
  rubric: EssayRubricScore[];
  strengths: string[];
  improvements: string[];
  feedback: string;
}

export interface SimilarityPair {
  a: string;
  b: string;
  similarity: number;
}

export interface SimilarityResult {
  pairs: SimilarityPair[];
  flagged: SimilarityPair[];
  threshold: number;
}

// ---------------- Languages ----------------
export const SUPPORTED_LANGUAGES = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Arabic",
  "Bengali",
  "Tamil",
  "Telugu",
  "Marathi",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
