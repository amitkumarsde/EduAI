import mongoose from "mongoose";
import "../utils/loadEnv.js";
import Student from "../models/Student.js";
import Exam from "../models/Exam.js";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/edtech_db";

async function migrate(): Promise<void> {
  await mongoose.connect(MONGO_URI);

  const legacyStudents = await Student.collection
    .find({
      exam_reports: { $exists: true, $type: "array", $ne: [] },
    })
    .toArray();

  let migratedReports = 0;
  let createdExamDocs = 0;

  for (const legacyStudent of legacyStudents) {
    const reports: any[] = Array.isArray(legacyStudent.exam_reports)
      ? legacyStudent.exam_reports
      : [];

    for (const report of reports) {
      const payload: Record<string, unknown> = {
        student_id: legacyStudent._id,
        exam_type: report.exam_type,
        subject: report.subject,
        total_marks: report.total_marks,
        scored_marks: report.scored_marks,
        percentage: report.percentage,
        exam_date: report.exam_date || new Date(),
        suggested_goal: report.suggested_goal || null,
        goal_set_by: report.suggested_goal ? "ai_suggested" : null,
        weak_chapters: report.weak_chapters || [],
        strong_chapters: report.strong_chapters || [],
        priority_topics: report.priority_topics || [],
        ai_processed: true,
      };

      if (report.exam_id) {
        const existingExam = await Exam.findById(report.exam_id);

        if (existingExam) {
          await Exam.updateOne({ _id: report.exam_id }, { $set: payload });
        } else {
          await Exam.create({
            _id: report.exam_id,
            ...payload,
          } as never);
          createdExamDocs += 1;
        }
      } else {
        await Exam.create(payload as never);
        createdExamDocs += 1;
      }

      migratedReports += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        students_processed: legacyStudents.length,
        reports_migrated: migratedReports,
        exam_docs_created: createdExamDocs,
        note: "Student.exam_reports fields were not deleted automatically.",
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.disconnect();
  process.exit(1);
});
