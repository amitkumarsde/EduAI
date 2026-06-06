import type { Request, Response } from "express";
import InstituteExam, { type InstituteQuestion } from "../models/InstituteExam.js";
import InstituteAttempt from "../models/InstituteAttempt.js";
import {
  generateInstituteQuestions,
  normalizeAuthoredQuestions,
  generateExamCode,
  gradeInstituteAttempt,
} from "../services/instituteService.js";

/** Remove answer keys before sending an exam to a student taking it. */
function stripAnswers(questions: InstituteQuestion[]) {
  return questions.map((q) => ({
    qid: q.qid,
    type: q.type,
    question_text: q.question_text,
    options: q.options,
    marks: q.marks,
  }));
}

// ---------------------------------------------------------------- AUTHORING

/** POST /api/v1/institute/generate-questions */
export async function generateQuestions(req: Request, res: Response) {
  try {
    const description = String(req.body?.description || "").trim();
    if (!description) {
      return res
        .status(400)
        .json({ success: false, message: "A topic/description is required." });
    }
    const questions = await generateInstituteQuestions({
      description,
      count: Number(req.body?.count) || 5,
      type: req.body?.type || "mcq",
      difficulty: req.body?.difficulty || "medium",
      subject: req.body?.subject || "General",
      language: req.body?.language || "English",
    });
    return res.status(200).json({ success: true, data: { questions } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("generateQuestions error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/** POST /api/v1/institute/exams */
export async function createExam(req: Request, res: Response) {
  try {
    const title = String(req.body?.title || "").trim();
    const instituteName = String(req.body?.institute_name || req.user?.school || "").trim();
    if (!title || !instituteName) {
      return res.status(400).json({
        success: false,
        message: "title and institute_name are required.",
      });
    }

    const questions = normalizeAuthoredQuestions(req.body?.questions || []);
    if (!questions.length) {
      return res
        .status(400)
        .json({ success: false, message: "At least one question is required." });
    }

    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
    const passingMarks = Number(req.body?.passing_marks) >= 0
      ? Math.min(Number(req.body.passing_marks), totalMarks)
      : Math.round(totalMarks * 0.4);

    const exam = await InstituteExam.create({
      exam_code: req.body?.exam_code ? String(req.body.exam_code) : generateExamCode(),
      title,
      institute_name: instituteName,
      created_by: req.user!._id,
      subject: String(req.body?.subject || "General"),
      class: req.body?.class ? String(req.body.class) : null,
      description: String(req.body?.description || ""),
      duration_minutes: Number(req.body?.duration_minutes) || 30,
      difficulty: String(req.body?.difficulty || "medium"),
      total_marks: totalMarks,
      passing_marks: passingMarks,
      questions,
      published: req.body?.published !== false,
    });

    return res.status(201).json({ success: true, data: exam });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "An exam with that code already exists." });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("createExam error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/** GET /api/v1/institute/exams — exams created by the current teacher */
export async function listMyExams(req: Request, res: Response) {
  try {
    const exams = await InstituteExam.find({ created_by: req.user!._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message });
  }
}

/** GET /api/v1/institute/exams/:examId — full exam (author view, with answers) */
export async function getExamForAuthor(req: Request, res: Response) {
  try {
    const exam = await InstituteExam.findOne({
      _id: req.params.examId,
      created_by: req.user!._id,
    }).lean();
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found." });
    }
    return res.status(200).json({ success: true, data: exam });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message });
  }
}

/** GET /api/v1/institute/exams/:examId/attempts — institute analytics */
export async function listExamAttempts(req: Request, res: Response) {
  try {
    const exam = await InstituteExam.findOne({
      _id: req.params.examId,
      created_by: req.user!._id,
    }).lean();
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found." });
    }
    const attempts = await InstituteAttempt.find({
      exam_id: exam._id,
      status: "submitted",
    })
      .sort({ submitted_at: -1 })
      .lean();

    const submitted = attempts.length;
    const avg =
      submitted > 0
        ? Math.round(
            (attempts.reduce((s, a) => s + (a.report?.percentage || 0), 0) / submitted) * 10,
          ) / 10
        : 0;
    const passRate =
      submitted > 0
        ? Math.round((attempts.filter((a) => a.report?.passed).length / submitted) * 100)
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        exam: { id: exam._id, title: exam.title, exam_code: exam.exam_code, total_marks: exam.total_marks },
        summary: { submitted, average_percentage: avg, pass_rate: passRate },
        attempts: attempts.map((a) => ({
          id: a._id,
          student_name: a.student_name,
          student_email: a.student_email,
          percentage: a.report?.percentage ?? 0,
          grade: a.report?.grade ?? "—",
          passed: a.report?.passed ?? false,
          submitted_at: a.submitted_at,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message });
  }
}

// ---------------------------------------------------------------- TAKING

/** GET /api/v1/institute/search?q= — find published exams */
export async function searchExams(req: Request, res: Response) {
  try {
    const q = String(req.query?.q || "").trim();
    const filter: Record<string, unknown> = { published: true };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ institute_name: rx }, { exam_code: rx }, { title: rx }];
    }
    const exams = await InstituteExam.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("exam_code title institute_name subject class difficulty duration_minutes total_marks questions")
      .lean();

    return res.status(200).json({
      success: true,
      data: exams.map((e) => ({
        id: e._id,
        exam_code: e.exam_code,
        title: e.title,
        institute_name: e.institute_name,
        subject: e.subject,
        class: e.class,
        difficulty: e.difficulty,
        duration_minutes: e.duration_minutes,
        total_marks: e.total_marks,
        question_count: e.questions?.length || 0,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message });
  }
}

/** GET /api/v1/institute/take/:examCode — exam questions without answers */
export async function getExamToTake(req: Request, res: Response) {
  try {
    const exam = await InstituteExam.findOne({
      exam_code: req.params.examCode,
      published: true,
    }).lean();
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found." });
    }
    return res.status(200).json({
      success: true,
      data: {
        id: exam._id,
        exam_code: exam.exam_code,
        title: exam.title,
        institute_name: exam.institute_name,
        subject: exam.subject,
        difficulty: exam.difficulty,
        duration_minutes: exam.duration_minutes,
        total_marks: exam.total_marks,
        questions: stripAnswers(exam.questions),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message });
  }
}

/** POST /api/v1/institute/take/:examCode/start */
export async function startAttempt(req: Request, res: Response) {
  try {
    const exam = await InstituteExam.findOne({
      exam_code: req.params.examCode,
      published: true,
    }).lean();
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found." });
    }

    const attempt = await InstituteAttempt.create({
      exam_id: exam._id,
      exam_code: exam.exam_code,
      user_id: req.user?._id ?? null,
      student_id: req.user?.student_id ?? null,
      student_name: String(req.body?.student_name || req.user?.name || "Student"),
      student_email: String(req.body?.student_email || req.user?.email || ""),
      status: "in_progress",
      started_at: new Date(),
    });

    return res.status(201).json({ success: true, data: { attempt_id: attempt._id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("startAttempt error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/** POST /api/v1/institute/attempts/:attemptId/submit */
export async function submitAttempt(req: Request, res: Response) {
  try {
    const attempt = await InstituteAttempt.findById(req.params.attemptId);
    if (!attempt) {
      return res.status(404).json({ success: false, message: "Attempt not found." });
    }
    if (attempt.status === "submitted" && attempt.report) {
      return res.status(200).json({ success: true, data: attempt.report });
    }

    const exam = await InstituteExam.findById(attempt.exam_id).lean();
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found." });
    }

    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    attempt.answers = answers.map((a: any) => ({
      qid: String(a?.qid || ""),
      answer: String(a?.answer ?? ""),
    }));
    attempt.time_taken_seconds = Number(req.body?.time_taken_seconds || 0);

    const report = await gradeInstituteAttempt({
      exam,
      answers: attempt.answers,
      language: String(req.body?.language || "English"),
    });

    attempt.report = report;
    attempt.status = "submitted";
    attempt.submitted_at = new Date();
    await attempt.save();

    return res.status(200).json({ success: true, data: report, attempt_id: attempt._id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("submitAttempt error:", error);
    return res.status(500).json({ success: false, message });
  }
}

/** GET /api/v1/institute/attempts/:attemptId/report */
export async function getAttemptReport(req: Request, res: Response) {
  try {
    const attempt = await InstituteAttempt.findById(req.params.attemptId).lean();
    if (!attempt || !attempt.report) {
      return res.status(404).json({ success: false, message: "Report not found." });
    }
    return res.status(200).json({
      success: true,
      data: {
        exam_code: attempt.exam_code,
        student_name: attempt.student_name,
        time_taken_seconds: attempt.time_taken_seconds,
        report: attempt.report,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message });
  }
}

/** GET /api/v1/institute/my-attempts — current user's attempt history */
export async function listMyAttempts(req: Request, res: Response) {
  try {
    const attempts = await InstituteAttempt.find({
      user_id: req.user!._id,
      status: "submitted",
    })
      .sort({ submitted_at: -1 })
      .limit(50)
      .lean();
    return res.status(200).json({
      success: true,
      data: attempts.map((a) => ({
        id: a._id,
        exam_code: a.exam_code,
        percentage: a.report?.percentage ?? 0,
        grade: a.report?.grade ?? "—",
        passed: a.report?.passed ?? false,
        submitted_at: a.submitted_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message });
  }
}
