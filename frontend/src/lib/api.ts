/**
 * Centralized API client for all backend calls.
 * Next.js rewrites proxy "/api" to the Express backend (see next.config.ts).
 * A JWT (localStorage "edtech_token") is attached to every request.
 */
import axios, { type AxiosRequestConfig } from "axios";
import type {
  AuthResponse,
  ContentRecommendations,
  EssayGradeResult,
  Exam,
  GeneratedPaper,
  HeatmapData,
  InstituteAttemptSummary,
  InstituteExam,
  InstituteExamAnalytics,
  InstituteExamSummary,
  InstituteExamToTake,
  InstituteQuestion,
  InstituteReport,
  LeaderboardEntry,
  OcrResult,
  PaperFormData,
  PracticeQuiz,
  Question,
  QuizAttempt,
  SimilarityResult,
  Student,
  StudentInsights,
  StudentOverview,
  TeacherAnalytics,
  TutorMessage,
  User,
} from "./types";

const API_BASE = "/api";
const API_V1 = "/api/v1";

// Origin of the Express backend. Set NEXT_PUBLIC_API_URL to the deployed
// backend URL (e.g. https://eduai-backend.onrender.com); empty falls back to
// same-origin for local dev against a backend on the same host.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const TOKEN_KEY = "edtech_token";
export const USER_KEY = "edtech_user";

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

function toError(error: unknown): Error {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  const message =
    err?.response?.data?.message || err?.message || "Unexpected API error";
  return new Error(message);
}

async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  try {
    const { data } = await client.get<T>(url, config);
    return data;
  } catch (error) {
    throw toError(error);
  }
}

async function post<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const { data } = await client.post<T>(url, body, config);
    return data;
  } catch (error) {
    throw toError(error);
  }
}

async function put<T>(url: string, body?: unknown): Promise<T> {
  try {
    const { data } = await client.put<T>(url, body);
    return data;
  } catch (error) {
    throw toError(error);
  }
}

/** Generic envelope used by most v1 endpoints: { data, ... } */
interface Envelope<T> {
  data?: T;
  [key: string]: unknown;
}

// ============================================ AUTH
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: "teacher" | "student";
  class?: string;
  school?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  return post<AuthResponse>(`${API_V1}/auth/register`, payload);
}

export function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  return post<AuthResponse>(`${API_V1}/auth/login`, payload);
}

export function fetchMe(): Promise<{ user: User }> {
  return get<{ user: User }>(`${API_V1}/auth/me`);
}

export function updateProfile(payload: Partial<User & { display_name: string; avatar_color: string; bio: string }>): Promise<{ user: User }> {
  return put<{ user: User }>(`${API_V1}/auth/me`, payload);
}

// ============================================ ADAPTIVE EXAM
export async function getNextAdaptiveQuestion(params: {
  subject: string;
  difficulty: string;
  asked: string[];
}): Promise<Question> {
  const response = await post<Envelope<Question>>(`${API_V1}/adaptive/next`, params);
  return response.data as Question;
}

// ============================================ PAPER MANAGEMENT
export function generatePaper(paperData: PaperFormData): Promise<Envelope<GeneratedPaper>> {
  return post<Envelope<GeneratedPaper>>(`${API_BASE}/generate-paper`, paperData);
}

export async function getAllPapers(): Promise<GeneratedPaper[]> {
  const response = await get<Envelope<GeneratedPaper[]>>(`${API_BASE}/papers`);
  return response.data ?? [];
}

export async function getPaperById(paperId: string): Promise<GeneratedPaper> {
  const response = await get<Envelope<GeneratedPaper>>(`${API_BASE}/papers/${paperId}`);
  return response.data as GeneratedPaper;
}

export async function downloadPaperPDF(paperId: string): Promise<Blob> {
  try {
    const response = await client.get<Blob>(`${API_BASE}/papers/${paperId}/download`, {
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    throw toError(error);
  }
}

export async function getPapersByClass(stdClass: string): Promise<GeneratedPaper[]> {
  const response = await get<Envelope<GeneratedPaper[]>>(`${API_BASE}/papers/class/${stdClass}`);
  return response.data ?? [];
}

export function analyzeExam(formData: FormData): Promise<Envelope<Exam>> {
  return post<Envelope<Exam>>(`${API_BASE}/analyze-exam`, formData);
}

// ============================================ STUDENT MANAGEMENT
export function createStudent(studentData: Partial<Student>): Promise<Envelope<Student>> {
  return post<Envelope<Student>>(`${API_V1}/student/create`, studentData);
}

export async function getStudents(): Promise<Student[]> {
  const response = await get<Envelope<Student[]>>(`${API_V1}/students`);
  return response.data ?? [];
}

export async function getStudentOverview(studentId: string): Promise<StudentOverview> {
  const response = await get<Envelope<StudentOverview>>(`${API_V1}/students/${studentId}/overview`);
  return response.data as StudentOverview;
}

export async function getStudentInsights(studentId: string): Promise<StudentInsights> {
  const response = await get<Envelope<StudentInsights>>(`${API_V1}/students/${studentId}/insights`);
  return response.data as StudentInsights;
}

export async function getTeacherAnalytics(): Promise<TeacherAnalytics> {
  const response = await get<Envelope<TeacherAnalytics>>(`${API_V1}/analytics/overview`);
  return response.data as TeacherAnalytics;
}

export async function getStudentById(studentId: string): Promise<Student> {
  const response = await get<Envelope<Student>>(`${API_V1}/student/${studentId}`);
  return response.data as Student;
}

export function generatePracticeQuiz(quizData: Record<string, unknown>): Promise<Envelope<PracticeQuiz>> {
  return post<Envelope<PracticeQuiz>>(`${API_V1}/student/practice-quiz`, quizData);
}

export async function getLeaderboard(stdClass?: string): Promise<LeaderboardEntry[]> {
  const query = stdClass ? `?class=${encodeURIComponent(stdClass)}` : "";
  const response = await get<Envelope<LeaderboardEntry[]>>(`${API_V1}/leaderboard${query}`);
  return response.data ?? [];
}

// ============================================ AI TUTOR
export async function askTutor(params: {
  message: string;
  subject?: string;
  history?: TutorMessage[];
  language?: string;
}): Promise<{ reply?: string; answer?: string; [key: string]: unknown }> {
  const response = await post<Envelope<{ reply?: string; answer?: string }>>(
    `${API_V1}/tutor/ask`,
    params,
  );
  return (response.data ?? response) as { reply?: string; answer?: string };
}

// ============================================ QUIZ ATTEMPTS (persisted history)
export async function submitQuizAttempt(payload: Record<string, unknown>): Promise<QuizAttempt> {
  const response = await post<Envelope<QuizAttempt>>(`${API_V1}/quiz/attempts`, payload);
  return response.data as QuizAttempt;
}

export async function saveQuizProgress(payload: Record<string, unknown>): Promise<QuizAttempt> {
  const response = await post<Envelope<QuizAttempt>>(`${API_V1}/quiz/attempts/progress`, payload);
  return response.data as QuizAttempt;
}

export async function getQuizAttempts(params: {
  student_id: string;
  status?: string;
}): Promise<QuizAttempt[]> {
  const query = new URLSearchParams({ student_id: params.student_id });
  if (params.status) query.set("status", params.status);
  const response = await get<Envelope<QuizAttempt[]>>(`${API_V1}/quiz/attempts?${query.toString()}`);
  return response.data ?? [];
}

export async function getQuizAttempt(attemptId: string, studentId: string): Promise<QuizAttempt> {
  const response = await get<Envelope<QuizAttempt>>(
    `${API_V1}/quiz/attempts/${attemptId}?student_id=${encodeURIComponent(studentId)}`,
  );
  return response.data as QuizAttempt;
}

// ============================================ OFFLINE OCR
export async function ocrEvaluateImage(formData: FormData): Promise<OcrResult> {
  const response = await post<Envelope<OcrResult>>(`${API_V1}/offline/ocr`, formData);
  return response.data as OcrResult;
}

// ============================================ INSTITUTE (B2B)
export async function generateInstituteQuestions(payload: Record<string, unknown>): Promise<{ questions: InstituteQuestion[] }> {
  const response = await post<Envelope<{ questions: InstituteQuestion[] }>>(
    `${API_V1}/institute/generate-questions`,
    payload,
  );
  return (response.data ?? { questions: [] }) as { questions: InstituteQuestion[] };
}

export async function createInstituteExam(payload: Record<string, unknown>): Promise<InstituteExam> {
  const response = await post<Envelope<InstituteExam>>(`${API_V1}/institute/exams`, payload);
  return response.data as InstituteExam;
}

export async function getMyInstituteExams(): Promise<InstituteExam[]> {
  const response = await get<Envelope<InstituteExam[]>>(`${API_V1}/institute/exams`);
  return response.data ?? [];
}

export async function getInstituteExamAttempts(examId: string): Promise<InstituteExamAnalytics> {
  const response = await get<Envelope<InstituteExamAnalytics>>(`${API_V1}/institute/exams/${examId}/attempts`);
  return response.data as InstituteExamAnalytics;
}

export async function searchInstituteExams(q: string): Promise<InstituteExamSummary[]> {
  const response = await get<Envelope<InstituteExamSummary[]>>(
    `${API_V1}/institute/search?q=${encodeURIComponent(q)}`,
  );
  return response.data ?? [];
}

export async function getMyInstituteAttempts(): Promise<InstituteAttemptSummary[]> {
  const response = await get<Envelope<InstituteAttemptSummary[]>>(`${API_V1}/institute/my-attempts`);
  return response.data ?? [];
}

export async function getInstituteExamToTake(examCode: string): Promise<InstituteExamToTake> {
  const response = await get<Envelope<InstituteExamToTake>>(`${API_V1}/institute/take/${examCode}`);
  return response.data as InstituteExamToTake;
}

export async function startInstituteAttempt(examCode: string, payload: Record<string, unknown>): Promise<{ attempt_id: string }> {
  const response = await post<Envelope<{ attempt_id: string }>>(
    `${API_V1}/institute/take/${examCode}/start`,
    payload,
  );
  return response.data as { attempt_id: string };
}

export async function submitInstituteAttempt(attemptId: string, payload: Record<string, unknown>): Promise<InstituteReport> {
  const response = await post<Envelope<InstituteReport>>(
    `${API_V1}/institute/attempts/${attemptId}/submit`,
    payload,
  );
  return response.data as InstituteReport;
}

export async function getInstituteAttemptReport(attemptId: string): Promise<{ exam_code: string; student_name: string; time_taken_seconds: number; report: InstituteReport }> {
  const response = await get<Envelope<{ exam_code: string; student_name: string; time_taken_seconds: number; report: InstituteReport }>>(
    `${API_V1}/institute/attempts/${attemptId}/report`,
  );
  return response.data as { exam_code: string; student_name: string; time_taken_seconds: number; report: InstituteReport };
}

// ============================================ PROCTORING
export async function logProctorEvents(payload: {
  session_id: string;
  context?: string;
  events: { type: string; detail?: string; at?: string }[];
}): Promise<void> {
  await post(`${API_V1}/proctor/events`, payload);
}

// ============================================ CONTENT + META-LEARNING
export async function getContentRecommendations(payload: Record<string, unknown>): Promise<ContentRecommendations> {
  const response = await post<Envelope<ContentRecommendations>>(`${API_V1}/content/recommendations`, payload);
  return response.data as ContentRecommendations;
}

// ============================================ HEAT MAP
export async function getStudentHeatmap(studentId: string): Promise<HeatmapData> {
  const response = await get<Envelope<HeatmapData>>(`${API_V1}/students/${studentId}/heatmap`);
  return response.data as HeatmapData;
}

// ============================================ GRADING (essay + similarity)
export async function gradeEssay(payload: Record<string, unknown>): Promise<EssayGradeResult> {
  const response = await post<Envelope<EssayGradeResult>>(`${API_V1}/grading/essay`, payload);
  return response.data as EssayGradeResult;
}

export async function checkSimilarity(payload: Record<string, unknown>): Promise<SimilarityResult> {
  const response = await post<Envelope<SimilarityResult>>(`${API_V1}/grading/similarity`, payload);
  return response.data as SimilarityResult;
}

// ============================================ HELPERS
export function triggerPDFDownload(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export function formatDate(dateString?: string): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
