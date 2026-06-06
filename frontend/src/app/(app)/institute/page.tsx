"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  LuBuilding2,
  LuSparkles,
  LuPlus,
  LuTrash2,
  LuCopy,
  LuChartBar,
} from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  generateInstituteQuestions,
  createInstituteExam,
  getMyInstituteExams,
  getInstituteExamAttempts,
} from "@/lib/api";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, EmptyState } from "@/components/ui/Misc";
import { FieldGroup, Input, Label, Select, Textarea } from "@/components/ui/Field";
import { PageLoader } from "@/components/ui/Spinner";
import { formatDate } from "@/lib/api";
import type {
  InstituteExam,
  InstituteExamAnalytics,
  InstituteQuestion,
} from "@/lib/types";

const OPTION_LABELS = ["A", "B", "C", "D"];
let qidCounter = 0;
function nextQid() {
  qidCounter += 1;
  return `q${Date.now().toString(36)}${qidCounter}`;
}

export default function InstitutePage() {
  const { userRole, user } = useAppContext();
  const { language } = useLanguage();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [stdClass, setStdClass] = useState("");
  const [duration, setDuration] = useState("30");
  const [difficulty, setDifficulty] = useState("medium");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<InstituteQuestion[]>([]);

  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState("5");
  const [aiType, setAiType] = useState<"mcq" | "descriptive" | "mixed">("mcq");
  const [generating, setGenerating] = useState(false);

  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<InstituteExam | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [myExams, setMyExams] = useState<InstituteExam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [analytics, setAnalytics] = useState<InstituteExamAnalytics | null>(null);

  function loadExams() {
    setLoadingExams(true);
    getMyInstituteExams()
      .then(setMyExams)
      .catch(() => undefined)
      .finally(() => setLoadingExams(false));
  }

  useEffect(() => {
    void (async () => {
      if (userRole === "teacher") loadExams();
    })();
  }, [userRole]);

  if (userRole !== "teacher") {
    return (
      <div>
        <PageHeader title="Institute Exams" description="Create and manage branded exams." />
        <EmptyState icon={LuBuilding2} title="Teacher access only" description="Switch to a teacher account to author institute exams." />
      </div>
    );
  }

  async function handleGenerate() {
    if (!aiTopic.trim()) {
      setError("Enter a topic/description for AI generation.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const { questions: generated } = await generateInstituteQuestions({
        description: aiTopic,
        count: Number(aiCount) || 5,
        type: aiType,
        difficulty,
        subject: subject || "General",
        language,
      });
      setQuestions((prev) => [
        ...prev,
        ...generated.map((q) => ({ ...q, qid: nextQid() })),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  }

  function addManual(type: "mcq" | "descriptive") {
    setQuestions((prev) => [
      ...prev,
      type === "mcq"
        ? {
            qid: nextQid(),
            type: "mcq",
            question_text: "",
            options: ["", "", "", ""],
            correct_option: "A",
            marks: 1,
          }
        : {
            qid: nextQid(),
            type: "descriptive",
            question_text: "",
            options: [],
            correct_option: null,
            model_answer: "",
            marks: 5,
          },
    ]);
  }

  function updateQuestion(qid: string, patch: Partial<InstituteQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.qid === qid ? { ...q, ...patch } : q)));
  }

  function updateOption(qid: string, index: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.qid === qid ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) } : q,
      ),
    );
  }

  const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || questions.length === 0) {
      setError("Add a title and at least one question.");
      return;
    }
    if (questions.some((q) => !q.question_text.trim())) {
      setError("Every question needs question text.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const exam = await createInstituteExam({
        title,
        institute_name: user?.school || "My Institute",
        subject: subject || "General",
        class: stdClass || null,
        description,
        duration_minutes: Number(duration) || 30,
        difficulty,
        questions,
      });
      setCreated(exam);
      setTitle("");
      setQuestions([]);
      setDescription("");
      loadExams();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create exam");
    } finally {
      setCreating(false);
    }
  }

  async function viewResults(examId: string) {
    setAnalytics(null);
    try {
      const data = await getInstituteExamAttempts(examId);
      setAnalytics(data);
    } catch {
      setError("Could not load results for that exam.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Institute Exams"
        description="Author branded exams with AI-generated or manual questions, share a code, and track results."
        actions={<LanguageSelect />}
      />

      <div className="space-y-6">
        {created && (
          <Alert variant="success">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Exam published. Share this code with students: <strong>{created.exam_code}</strong>
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigator.clipboard?.writeText(created.exam_code)}
              >
                <LuCopy className="h-4 w-4" /> Copy code
              </Button>
            </div>
          </Alert>
        )}

        <form onSubmit={handleCreate} className="space-y-6">
          <Card>
            <CardHeader title="Exam details" />
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup>
                  <Label htmlFor="ie-title">Title</Label>
                  <Input id="ie-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Class 10 Algebra Test" />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="ie-subject">Subject</Label>
                  <Input id="ie-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="ie-class">Class (optional)</Label>
                  <Input id="ie-class" value={stdClass} onChange={(e) => setStdClass(e.target.value)} placeholder="Class 10" />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="ie-duration">Duration (minutes)</Label>
                  <Input id="ie-duration" type="number" min={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
                </FieldGroup>
                <FieldGroup>
                  <Label htmlFor="ie-difficulty">Difficulty</Label>
                  <Select id="ie-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    {["easy", "medium", "hard"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </FieldGroup>
                <FieldGroup className="sm:col-span-2">
                  <Label htmlFor="ie-desc">Description (optional)</Label>
                  <Textarea id="ie-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[64px]" />
                </FieldGroup>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Questions"
              subtitle={`${questions.length} question(s) · ${totalMarks} marks`}
              action={<Badge variant="accent">{totalMarks} marks</Badge>}
            />
            <CardBody className="space-y-4">
              {/* AI generation */}
              <div className="rounded-lg border border-dashed border-border-strong p-4">
                <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-fg">
                  <LuSparkles className="h-4 w-4 text-accent" /> Generate with AI
                </p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <FieldGroup className="sm:col-span-2">
                    <Label htmlFor="ai-topic">Topic / description</Label>
                    <Input id="ai-topic" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="Quadratic equations, factorization…" />
                  </FieldGroup>
                  <FieldGroup>
                    <Label htmlFor="ai-count">Count</Label>
                    <Input id="ai-count" type="number" min={1} max={20} value={aiCount} onChange={(e) => setAiCount(e.target.value)} />
                  </FieldGroup>
                  <FieldGroup>
                    <Label htmlFor="ai-type">Type</Label>
                    <Select id="ai-type" value={aiType} onChange={(e) => setAiType(e.target.value as typeof aiType)}>
                      <option value="mcq">MCQ</option>
                      <option value="descriptive">Descriptive</option>
                      <option value="mixed">Mixed</option>
                    </Select>
                  </FieldGroup>
                </div>
                <Button type="button" className="mt-3" size="sm" onClick={handleGenerate} loading={generating}>
                  <LuSparkles className="h-4 w-4" /> Generate questions
                </Button>
              </div>

              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => addManual("mcq")}>
                  <LuPlus className="h-4 w-4" /> Add MCQ
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => addManual("descriptive")}>
                  <LuPlus className="h-4 w-4" /> Add descriptive
                </Button>
              </div>

              {questions.map((q, index) => (
                <div key={q.qid} className="rounded-lg border border-border-default p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant={q.type === "mcq" ? "info" : "accent"}>
                      Q{index + 1} · {q.type === "mcq" ? "MCQ" : "Descriptive"}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={q.marks}
                        onChange={(e) => updateQuestion(q.qid, { marks: Number(e.target.value) || 1 })}
                        className="h-8 w-16 rounded-lg border border-border-default bg-surface px-2 text-sm text-fg"
                        aria-label="Marks"
                      />
                      <span className="text-xs text-muted">marks</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setQuestions((prev) => prev.filter((x) => x.qid !== q.qid))} aria-label="Remove question">
                        <LuTrash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={q.question_text}
                    onChange={(e) => updateQuestion(q.qid, { question_text: e.target.value })}
                    className="min-h-[56px]"
                    placeholder="Question text"
                  />
                  {q.type === "mcq" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct-${q.qid}`}
                            checked={q.correct_option === OPTION_LABELS[oi]}
                            onChange={() => updateQuestion(q.qid, { correct_option: OPTION_LABELS[oi] })}
                            aria-label={`Mark option ${OPTION_LABELS[oi]} correct`}
                          />
                          <span className="text-sm font-medium text-muted">{OPTION_LABELS[oi]}.</span>
                          <Input value={opt} onChange={(e) => updateOption(q.qid, oi, e.target.value)} className="h-9" />
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "descriptive" && (
                    <Textarea
                      value={q.model_answer ?? ""}
                      onChange={(e) => updateQuestion(q.qid, { model_answer: e.target.value })}
                      className="mt-3 min-h-[48px]"
                      placeholder="Model answer (optional — improves AI grading)"
                    />
                  )}
                </div>
              ))}

              {error && <Alert variant="danger">{error}</Alert>}

              <Button type="submit" loading={creating} disabled={questions.length === 0}>
                Publish exam
              </Button>
            </CardBody>
          </Card>
        </form>

        <Card>
          <CardHeader title="My institute exams" subtitle="Share the code; click to view results" />
          <CardBody className="space-y-2">
            {loadingExams ? (
              <PageLoader label="Loading exams…" />
            ) : myExams.length === 0 ? (
              <p className="text-sm text-muted">No institute exams yet.</p>
            ) : (
              myExams.map((exam) => (
                <div key={exam._id} className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{exam.title}</p>
                    <p className="text-xs text-muted">
                      Code <strong>{exam.exam_code}</strong> · {exam.questions?.length ?? 0} Q · {exam.total_marks} marks · {formatDate(exam.createdAt)}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => viewResults(exam._id!)}>
                    <LuChartBar className="h-4 w-4" /> Results
                  </Button>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {analytics && (
          <Card>
            <CardHeader
              title={`Results — ${analytics.exam.title}`}
              subtitle={`${analytics.summary.submitted} submitted · avg ${analytics.summary.average_percentage}% · pass rate ${analytics.summary.pass_rate}%`}
            />
            <CardBody className="space-y-2">
              {analytics.attempts.length === 0 ? (
                <p className="text-sm text-muted">No submissions yet.</p>
              ) : (
                analytics.attempts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{a.student_name}</p>
                      <p className="text-xs text-muted">{a.student_email} · {formatDate(a.submitted_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.passed ? "success" : "danger"}>{a.grade}</Badge>
                      <span className="text-sm text-muted">{a.percentage}%</span>
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
