import type { Request, Response } from "express";
import fs from "fs";
import { generateQuestionPaper } from "../services/paperService.js";
import { generatePaperPDF } from "../services/pdfService.js";
import GeneratedPaper, {
  type GeneratedPaperExamType,
} from "../models/GeneratedPaper.js";
import { buildClassMatcher, normalizeClassLabel } from "../utils/classUtils.js";

export async function generatePaper(req: Request, res: Response) {
  try {
    const {
      subject,
      class: rawStdClass,
      exam_type,
      chapters,
      total_marks,
      num_questions,
      duration,
    } = req.body;
    const stdClass = normalizeClassLabel(rawStdClass);

    if (!subject || !stdClass || !exam_type || !chapters) {
      return res.status(400).json({
        success: false,
        message: "subject, class, exam_type, chapters required",
      });
    }

    console.log(`Generating ${exam_type} paper - ${subject} ${stdClass}`);

    const paperData = await generateQuestionPaper({
      subject,
      class: stdClass,
      exam_type,
      chapters,
      total_marks: total_marks ? parseInt(total_marks, 10) : undefined,
      num_questions: num_questions ? parseInt(num_questions, 10) : undefined,
      duration,
    });

    const paperInfo = paperData.paper_info || {};
    const chaptersToStore = Array.isArray(paperInfo.chapters_covered)
      ? paperInfo.chapters_covered
      : Array.isArray(chapters)
        ? chapters
        : [];
    const effectiveTotalMarks =
      Number(paperInfo.total_marks) || (total_marks ? parseInt(total_marks, 10) : 0);
    const effectiveNumQuestions =
      Number(paperInfo.num_questions) ||
      (Array.isArray(paperData.questions) ? paperData.questions.length : 0) ||
      (num_questions ? parseInt(num_questions, 10) : 0);
    const effectiveFormat = "pdf" as const;

    const storedExamType = normalizeStoredPaperExamType(
      paperInfo.exam_type || exam_type,
    );
    const generatedPaper = new GeneratedPaper({
      title: `${paperInfo.subject || subject} - ${storedExamType}`,
      subject: paperInfo.subject || subject,
      exam_type: storedExamType,
      class: normalizeClassLabel(paperInfo.class || stdClass),
      chapters: chaptersToStore,
      total_marks: effectiveTotalMarks,
      num_questions: effectiveNumQuestions,
      duration: paperInfo.duration || duration,
      format: effectiveFormat,
      questions: paperData.questions || [],
      created_by: "teacher",
    });

    const savedPaper = await generatedPaper.save();
    console.log("Paper saved to database:", savedPaper._id);

    const responsePaperData = {
      ...paperData,
      paper_info: {
        ...paperInfo,
        subject: generatedPaper.subject,
        class: generatedPaper.class,
        exam_type: generatedPaper.exam_type,
        total_marks: generatedPaper.total_marks,
        num_questions: generatedPaper.num_questions,
        duration: generatedPaper.duration,
        format: generatedPaper.format,
        chapters_covered: generatedPaper.chapters,
      },
    };

    return res.status(200).json({
      success: true,
      format: generatedPaper.format,
      paperId: savedPaper._id,
      downloadUrl: `/api/papers/${savedPaper._id}/download`,
      data: responsePaperData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in generatePaper:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function getAllPapers(_req: Request, res: Response) {
  try {
    const papers = await GeneratedPaper.find()
      .sort({ created_at: -1 })
      .limit(20)
      .select(
        "_id title subject exam_type class total_marks num_questions duration format created_at",
      );

    return res.status(200).json({
      success: true,
      data: papers.map(serializePaperSummary),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching papers:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function getPaperById(req: Request, res: Response) {
  try {
    const { paperId } = req.params;

    const paper = await GeneratedPaper.findById(paperId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Paper not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...paper.toObject(),
        class: normalizeClassLabel(paper.class) || paper.class,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching paper:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function getPapersByClass(req: Request, res: Response) {
  try {
    const { stdClass } = req.params;
    const classMatcher = buildClassMatcher(stdClass);

    const papers = await GeneratedPaper.find(
      classMatcher ? { class: classMatcher } : {},
    )
      .sort({ created_at: -1 })
      .select(
        "_id title subject exam_type class total_marks num_questions duration format created_at",
      );

    return res.status(200).json({
      success: true,
      data: papers.map(serializePaperSummary),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching papers by class:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function downloadPaper(req: Request, res: Response) {
  try {
    const { paperId } = req.params;

    const paper = await GeneratedPaper.findById(paperId);

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: "Paper not found",
      });
    }

    const paperData = {
      paper_info: {
        exam_type: paper.exam_type,
        subject: paper.subject,
        class: normalizeClassLabel(paper.class) || paper.class,
        chapters: paper.chapters,
        total_marks: paper.total_marks,
        duration: paper.duration,
        chapters_covered: paper.chapters,
      },
      questions: paper.questions,
    };

    console.log(`Generating PDF for paper: ${paper.title}`);

    const { filePath, fileName } = await generatePaperPDF(paperData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("end", () => {
      try {
        fs.unlinkSync(filePath);
        console.log("Temp PDF deleted after download.");
      } catch (err) {
        console.error("Error deleting temp PDF:", err);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error downloading paper:", error);
    return res.status(500).json({
      success: false,
      message,
    });
  }
}

// Coerces any accepted exam_type input (canonical, raw UI label, or alias such
// as "Unit Test 1"/"Final") into a value allowed by the GeneratedPaper enum,
// so a valid request can never fail Mongoose validation on save.
function normalizeStoredPaperExamType(examType: unknown): GeneratedPaperExamType {
  const normalized = String(examType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  const aliasGroups: Record<string, string[]> = {
    "UT-2": ["ut-2", "ut 2", "ut2", "pt-2", "pt 2", "periodic test 2", "unit test 2", "unit test-2", "cycle test 2"],
    "UT-1": ["ut-1", "ut 1", "ut1", "pt-1", "pt 1", "periodic test 1", "unit test 1", "unit test-1", "cycle test 1"],
    "Mid-Term": ["mid-term", "mid term", "midterm", "half yearly", "half-yearly"],
    "Final Exam": ["final", "final exam", "annual", "annual exam"],
  };

  for (const [canonical, aliases] of Object.entries(aliasGroups)) {
    if (aliases.includes(normalized)) {
      return canonical as GeneratedPaperExamType;
    }
  }

  // Already a valid enum value (e.g. "Mid-Term")? Keep it; otherwise fall back.
  const validValues: GeneratedPaperExamType[] = [
    "UT-1",
    "UT-2",
    "Mid-Term",
    "Final Exam",
    "Seasonal Exam",
  ];
  return validValues.includes(examType as GeneratedPaperExamType)
    ? (examType as GeneratedPaperExamType)
    : "UT-1";
}

function serializePaperSummary(paper: any) {
  const serializedPaper = typeof paper.toObject === "function" ? paper.toObject() : paper;

  return {
    ...serializedPaper,
    class: normalizeClassLabel(paper.class) || paper.class,
  };
}
