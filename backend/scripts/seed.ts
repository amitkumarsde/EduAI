/**
 * Database seed script.
 * Populates the database with demo users, students, exams, topic health and a
 * sample generated paper so the app shows meaningful data out of the box.
 *
 * Usage:  npm run seed   (from the backend/ folder)
 *
 * WARNING: this clears the users, students, exams, topichealths and
 * generatedpapers collections before inserting fresh demo data.
 */
import mongoose from "mongoose";
import "../utils/loadEnv.js";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Student from "../models/Student.js";
import Exam from "../models/Exam.js";
import TopicHealth from "../models/TopicHealth.js";
import GeneratedPaper from "../models/GeneratedPaper.js";

function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

async function seed(): Promise<void> {
  await connectDB();

  console.log("🧹 Clearing existing demo data...");
  await Promise.all([
    User.deleteMany({}),
    Student.deleteMany({}),
    Exam.deleteMany({}),
    TopicHealth.deleteMany({}),
    GeneratedPaper.deleteMany({}),
  ]);

  console.log("👩‍🎓 Creating students...");
  const [aarav, isha, rohan] = await Student.create([
    { name: "Aarav Sharma", class: "Class 10", school: "Delhi Public School" },
    { name: "Isha Verma", class: "Class 10", school: "Delhi Public School" },
    { name: "Rohan Gupta", class: "Class 10", school: "Delhi Public School" },
  ]);

  console.log("📝 Creating exams...");
  const weakMath = [
    { chapter_name: "Quadratic Equations", sub_topics: ["A2", "A3"] },
    { chapter_name: "Trigonometry", sub_topics: ["T1"] },
  ];
  const strongMath = [{ chapter_name: "Real Numbers", sub_topics: ["R1", "R2"] }];

  await Exam.create([
    // Aarav - a downward trend in Maths (high risk) + improving Science
    {
      student_id: aarav._id, exam_type: "UT-1", subject: "Mathematics",
      total_marks: 25, scored_marks: 18, percentage: 72, exam_date: daysAgo(60),
      weak_chapters: weakMath, strong_chapters: strongMath,
      priority_topics: ["Quadratic Equations", "Trigonometry"],
    },
    {
      student_id: aarav._id, exam_type: "UT-2", subject: "Mathematics",
      total_marks: 25, scored_marks: 13, percentage: 52, exam_date: daysAgo(30),
      weak_chapters: weakMath, strong_chapters: strongMath,
      priority_topics: ["Quadratic Equations"],
    },
    {
      student_id: aarav._id, exam_type: "Mid-Term", subject: "Mathematics",
      total_marks: 80, scored_marks: 31, percentage: 39, exam_date: daysAgo(7),
      weak_chapters: weakMath, strong_chapters: [],
      priority_topics: ["Quadratic Equations", "Trigonometry"],
    },
    {
      student_id: aarav._id, exam_type: "UT-1", subject: "Science",
      total_marks: 25, scored_marks: 19, percentage: 76, exam_date: daysAgo(55),
      weak_chapters: [{ chapter_name: "Electricity", sub_topics: ["E1"] }],
      strong_chapters: [{ chapter_name: "Life Processes", sub_topics: ["L1"] }],
      priority_topics: ["Electricity"],
    },
    {
      student_id: aarav._id, exam_type: "Mid-Term", subject: "Science",
      total_marks: 80, scored_marks: 68, percentage: 85, exam_date: daysAgo(7),
      weak_chapters: [], strong_chapters: [{ chapter_name: "Life Processes", sub_topics: ["L1", "L2"] }],
      priority_topics: [],
    },
    // Isha - top performer
    {
      student_id: isha._id, exam_type: "UT-1", subject: "Mathematics",
      total_marks: 25, scored_marks: 23, percentage: 92, exam_date: daysAgo(60),
      weak_chapters: [], strong_chapters: strongMath, priority_topics: [],
    },
    {
      student_id: isha._id, exam_type: "Mid-Term", subject: "Mathematics",
      total_marks: 80, scored_marks: 75, percentage: 94, exam_date: daysAgo(7),
      weak_chapters: [], strong_chapters: strongMath, priority_topics: [],
    },
    // Rohan - average
    {
      student_id: rohan._id, exam_type: "UT-1", subject: "Mathematics",
      total_marks: 25, scored_marks: 16, percentage: 64, exam_date: daysAgo(60),
      weak_chapters: [{ chapter_name: "Polynomials", sub_topics: ["P1"] }],
      strong_chapters: [], priority_topics: ["Polynomials"],
    },
    {
      student_id: rohan._id, exam_type: "Mid-Term", subject: "Mathematics",
      total_marks: 80, scored_marks: 56, percentage: 70, exam_date: daysAgo(7),
      weak_chapters: [{ chapter_name: "Polynomials", sub_topics: ["P1"] }],
      strong_chapters: [], priority_topics: ["Polynomials"],
    },
  ]);

  console.log("🧠 Creating topic health...");
  await TopicHealth.create({
    student_id: aarav._id,
    subject: "Mathematics",
    topic_health: [
      {
        chapter: "Ch-3", chapter_name: "Quadratic Equations",
        sub_topics: [
          { code: "A2", status: "no_knowledge" },
          { code: "A3", status: "partial_understanding" },
        ],
      },
      {
        chapter: "Ch-8", chapter_name: "Trigonometry",
        sub_topics: [{ code: "T1", status: "no_knowledge" }],
      },
      {
        chapter: "Ch-1", chapter_name: "Real Numbers",
        sub_topics: [{ code: "R1", status: "crystal_clear" }],
      },
    ],
  });

  console.log("📄 Creating a sample generated paper...");
  await GeneratedPaper.create({
    title: "Mathematics UT-1 - Class 10",
    subject: "Mathematics",
    exam_type: "UT-1",
    class: "Class 10",
    chapters: ["Real Numbers", "Polynomials", "Quadratic Equations"],
    total_marks: 25,
    num_questions: 8,
    duration: "1 hour",
    format: "pdf",
    created_by: "Demo Teacher",
    questions: [
      { question_no: 1, marks: 1, question_type: "MCQ", question_text: "The HCF of 12 and 18 is?", options: ["2", "6", "3", "9"] },
      { question_no: 2, marks: 2, question_type: "short", question_text: "Find the zeroes of x^2 - 5x + 6.", options: null },
      { question_no: 3, marks: 3, question_type: "short", question_text: "Solve 2x^2 - 7x + 3 = 0 using the quadratic formula.", options: null },
    ],
  });

  console.log("🔐 Creating demo users...");
  const teacher = new User({
    name: "Demo Teacher", email: "teacher@edu.ai", role: "teacher",
  });
  teacher.password = "password123";
  await teacher.save();

  const studentUser = new User({
    name: "Aarav Sharma", email: "student@edu.ai", role: "student",
    class: "Class 10", school: "Delhi Public School", student_id: aarav._id,
  });
  studentUser.password = "password123";
  await studentUser.save();

  console.log("\n✅ Seed complete!");
  console.log("   Teacher login:  teacher@edu.ai / password123");
  console.log("   Student login:  student@edu.ai / password123");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
