"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { LuGraduationCap, LuZap, LuSave, LuPause } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useStudentWorkspace } from "@/hooks/useStudentWorkspace";
import { useStudentOverview } from "@/hooks/useStudentOverview";
import {
  generatePracticeQuiz,
  submitQuizAttempt,
  saveQuizProgress,
  getQuizAttempt,
} from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StudentSelector } from "@/components/StudentSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";
import { FieldGroup, Label, Select } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

const PREFERRED_SUBJECT_KEY = "edtech_quiz_preferred_subject";
const OPTION_LABELS = ["A", "B", "C", "D"];

interface QuizQuestion {
  question_no: number;
  question_text?: string;
  options?: string[];
  correct_option?: string;
  focus_chapter?: string;
  explanation?: string;
}

interface QuizChapter {
  chapter_name?: string;
  sub_topics?: string[];
}

interface QuizInfo {
  title?: string;
  subject?: string;
  class?: string;
  difficulty?: string;
  based_on_weak_chapters?: QuizChapter[];
}

interface PracticeQuizResult {
  quiz_info?: QuizInfo;
  questions?: QuizQuestion[];
}

function optionLabelToIndex(optionLabel?: string): number {
  return OPTION_LABELS.indexOf(optionLabel ?? "");
}

function getQuizOptionState(
  optionLabel: string,
  selectedOption: string | null,
  correctOption?: string,
): "idle" | "correct" | "incorrect" {
  if (!selectedOption) return "idle";
  if (optionLabel === correctOption) return "correct";
  if (optionLabel === selectedOption) return "incorrect";
  return "idle";
}

export default function QuizPage() {
  const { userRole } = useAppContext();
  const {
    students,
    loading: studentLoading,
    error: studentError,
    creating,
    currentStudent,
    selectStudent,
    createStudentProfile,
  } = useStudentWorkspace();
  const {
    overview,
    loading: overviewLoading,
    error: overviewError,
  } = useStudentOverview(currentStudent?.id);

  // Read the cross-page "preferred subject" once, lazily, then clear it.
  const [preferredSubject] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const stored = sessionStorage.getItem(PREFERRED_SUBJECT_KEY);
    if (stored) sessionStorage.removeItem(PREFERRED_SUBJECT_KEY);
    return stored ?? "";
  });

  const [subject, setSubject] = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState("adaptive");
  const [quiz, setQuiz] = useState<PracticeQuizResult | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizSelections, setQuizSelections] = useState<Record<number, string>>({});

  const { language } = useLanguage();
  const [resumeId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("resume"),
  );
  const startedAtRef = useRef<number>(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "paused" | "error">("idle");
  const resumeLoadedRef = useRef<string | null>(null);

  // Resume a paused attempt: load its questions + selections back into the page.
  useEffect(() => {
    if (!resumeId || !currentStudent?.id || resumeLoadedRef.current === resumeId) return;
    resumeLoadedRef.current = resumeId;
    void (async () => {
      try {
        const attempt = await getQuizAttempt(resumeId, currentStudent.id);
        const restored: PracticeQuizResult = {
          quiz_info: {
            title: attempt.title,
            subject: attempt.subject,
            class: undefined,
            difficulty: attempt.difficulty,
          },
          questions: (attempt.questions ?? []).map((q) => ({
            question_no: q.question_no,
            question_text: q.question_text,
            options: q.options,
            correct_option: q.correct_option,
            focus_chapter: q.focus_chapter ?? undefined,
            explanation: q.explanation ?? undefined,
          })),
        };
        const selections: Record<number, string> = {};
        for (const r of attempt.responses ?? []) {
          if (r.selected_option) selections[r.question_no] = r.selected_option;
        }
        setQuiz(restored);
        setQuizSelections(selections);
        startedAtRef.current = Date.now() - (attempt.time_spent_seconds ?? 0) * 1000;
      } catch (error) {
        console.error("Failed to resume attempt:", error);
      }
    })();
  }, [resumeId, currentStudent?.id]);

  // Reset quiz state when the active student changes (adjust during render —
  // the recommended pattern instead of setState inside an effect).
  const [trackedStudentId, setTrackedStudentId] = useState(currentStudent?.id);
  if (trackedStudentId !== currentStudent?.id) {
    setTrackedStudentId(currentStudent?.id);
    setQuiz(null);
    setQuizError(null);
    setQuizSelections({});
  }

  const availableSubjects = useMemo<string[]>(
    () => ((overview?.summary as { subjects?: string[] } | undefined)?.subjects ?? []),
    [overview],
  );

  const quizQuestions = useMemo<QuizQuestion[]>(() => quiz?.questions ?? [], [quiz]);

  const answeredCount = useMemo(() => Object.keys(quizSelections).length, [quizSelections]);

  const correctCount = useMemo(
    () =>
      quizQuestions.reduce((count, question) => {
        if (quizSelections[question.question_no] === question.correct_option) {
          return count + 1;
        }
        return count;
      }, 0),
    [quizQuestions, quizSelections],
  );

  // Keep the selected subject valid against available subjects (derived during
  // render to avoid setState inside an effect).
  const desiredSubject = useMemo(() => {
    if (!availableSubjects.length) return "";
    if (preferredSubject && availableSubjects.includes(preferredSubject)) return preferredSubject;
    return availableSubjects.includes(subject) ? subject : availableSubjects[0];
  }, [availableSubjects, preferredSubject, subject]);

  if (subject !== desiredSubject) {
    setSubject(desiredSubject);
  }

  async function handleGenerateQuiz(event: FormEvent) {
    event.preventDefault();

    if (!currentStudent?.id || !subject) {
      setQuizError("Select a student and subject before generating a quiz.");
      return;
    }

    try {
      setLoadingQuiz(true);
      const response = await generatePracticeQuiz({
        student_id: currentStudent.id,
        subject,
        question_count: Number(questionCount),
        difficulty,
        language,
      });
      setQuiz((response.data ?? response) as PracticeQuizResult);
      setQuizSelections({});
      setQuizError(null);
      setSaveState("idle");
      startedAtRef.current = Date.now();
    } catch (error) {
      console.error("Error generating practice quiz:", error);
      setQuiz(null);
      setQuizSelections({});
      setQuizError(error instanceof Error ? error.message : "Failed to generate practice quiz");
    } finally {
      setLoadingQuiz(false);
    }
  }

  function handleSelectOption(questionNumber: number, optionLabel: string) {
    setQuizSelections((previous) => {
      if (previous[questionNumber]) return previous;
      return { ...previous, [questionNumber]: optionLabel };
    });
  }

  function buildAttemptPayload() {
    const questions = quizQuestions.map((q) => ({
      question_no: q.question_no,
      question_text: q.question_text,
      options: q.options,
      correct_option: q.correct_option,
      focus_chapter: q.focus_chapter,
      explanation: q.explanation,
      marks: 1,
    }));
    const selections = quizQuestions.map((q) => ({
      question_no: q.question_no,
      selected_option: quizSelections[q.question_no] ?? null,
    }));
    return {
      student_id: currentStudent?.id,
      subject,
      source: "practice" as const,
      title: quiz?.quiz_info?.title || "Practice Quiz",
      difficulty,
      language,
      questions,
      selections,
      time_spent_seconds: Math.round((Date.now() - startedAtRef.current) / 1000),
    };
  }

  async function handleFinishAndSave() {
    if (!currentStudent?.id || !quizQuestions.length) return;
    try {
      setSaveState("saving");
      await submitQuizAttempt(buildAttemptPayload());
      setSaveState("saved");
    } catch (error) {
      console.error("Failed to save attempt:", error);
      setSaveState("error");
    }
  }

  async function handlePause() {
    if (!currentStudent?.id || !quizQuestions.length) return;
    try {
      setSaveState("saving");
      await saveQuizProgress({
        ...buildAttemptPayload(),
        attempt_id: resumeId ?? undefined,
        current_index: answeredCount,
        status: "paused",
      });
      setSaveState("paused");
    } catch (error) {
      console.error("Failed to pause attempt:", error);
      setSaveState("error");
    }
  }

  if (userRole !== "student") {
    return (
      <div>
        <PageHeader
          title="Revision Quiz"
          description="Generate a remedial quiz from a student&apos;s weak chapters and recent exam history."
        />
        <EmptyState
          icon={LuGraduationCap}
          title="Student access only"
          description="Switch to student mode to generate practice quizzes from weak topics."
        />
      </div>
    );
  }

  const weakTopics = (quiz?.quiz_info?.based_on_weak_chapters ?? [])
    .flatMap((chapter) => chapter.sub_topics ?? (chapter.chapter_name ? [chapter.chapter_name] : []))
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Revision Quiz"
        description="Generate a remedial quiz from the student&apos;s weak chapters and recent exam history."
      />

      <div className="space-y-6">
        <StudentSelector
          students={students}
          loading={studentLoading}
          creating={creating}
          error={studentError}
          currentStudent={currentStudent}
          onSelectStudent={selectStudent}
          onCreateStudent={createStudentProfile}
        />

        {studentLoading && !currentStudent ? (
          <PageLoader label="Loading student profiles…" />
        ) : overviewLoading ? (
          <PageLoader label="Loading student quiz context…" />
        ) : overviewError ? (
          <Alert variant="danger">{overviewError}</Alert>
        ) : !currentStudent ? (
          <EmptyState
            icon={LuGraduationCap}
            title="No student selected"
            description="Your student profile appears automatically after the first analyzed answer sheet. Manual creation is only a fallback if extraction is unavailable."
          />
        ) : (
          <>
            <Card>
              <CardBody>
                <form className="space-y-4" onSubmit={handleGenerateQuiz}>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FieldGroup>
                      <Label htmlFor="quiz-subject">Subject</Label>
                      <Select
                        id="quiz-subject"
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        disabled={availableSubjects.length === 0}
                      >
                        {availableSubjects.length === 0 ? (
                          <option value="">No analyzed subjects available yet</option>
                        ) : (
                          availableSubjects.map((subjectOption) => (
                            <option key={subjectOption} value={subjectOption}>
                              {subjectOption}
                            </option>
                          ))
                        )}
                      </Select>
                    </FieldGroup>

                    <FieldGroup>
                      <Label htmlFor="quiz-count">Questions</Label>
                      <Select
                        id="quiz-count"
                        value={questionCount}
                        onChange={(event) => setQuestionCount(event.target.value)}
                      >
                        {["5", "10", "15", "20"].map((count) => (
                          <option key={count} value={count}>
                            {count} questions
                          </option>
                        ))}
                      </Select>
                    </FieldGroup>

                    <FieldGroup>
                      <Label htmlFor="quiz-difficulty">Difficulty</Label>
                      <Select
                        id="quiz-difficulty"
                        value={difficulty}
                        onChange={(event) => setDifficulty(event.target.value)}
                      >
                        {["adaptive", "easy", "medium", "hard"].map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </Select>
                    </FieldGroup>
                  </div>

                  {(quizError || studentError) && (
                    <Alert variant="danger">{quizError || studentError}</Alert>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="submit"
                      loading={loadingQuiz}
                      disabled={loadingQuiz || availableSubjects.length === 0}
                    >
                      <LuZap className="h-4 w-4" />
                      {loadingQuiz ? "Generating Quiz…" : "Generate Quiz"}
                    </Button>
                    <LanguageSelect />
                  </div>
                </form>
              </CardBody>
            </Card>

            {quiz && (
              <Card>
                <CardBody className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-fg">
                      {quiz.quiz_info?.title || "Practice Quiz"}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {[quiz.quiz_info?.subject, quiz.quiz_info?.class, quiz.quiz_info?.difficulty]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="accent">
                      Answered {answeredCount}/{quizQuestions.length}
                    </Badge>
                    <Badge variant="success">Correct {correctCount}</Badge>
                    {answeredCount === quizQuestions.length && quizQuestions.length > 0 && (
                      <Badge variant="info">Quiz Completed</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      onClick={handleFinishAndSave}
                      loading={saveState === "saving"}
                      disabled={answeredCount === 0 || saveState === "saved"}
                    >
                      <LuSave className="h-4 w-4" />
                      {saveState === "saved" ? "Saved to history" : "Finish & save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handlePause}
                      disabled={answeredCount === 0 || saveState === "saving"}
                    >
                      <LuPause className="h-4 w-4" />
                      Pause &amp; resume later
                    </Button>
                    {saveState === "saved" && (
                      <span className="text-sm text-success">Attempt saved to your history.</span>
                    )}
                    {saveState === "paused" && (
                      <span className="text-sm text-info">Progress saved — resume from Quiz History.</span>
                    )}
                    {saveState === "error" && (
                      <span className="text-sm text-danger">Could not save. Try again.</span>
                    )}
                  </div>

                  {weakTopics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {weakTopics.map((topic) => (
                        <Badge key={topic} variant="warning">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    {quizQuestions.map((question) => {
                      const selectedOption = quizSelections[question.question_no] ?? null;
                      const isAnswered = Boolean(selectedOption);
                      const isCorrect = selectedOption === question.correct_option;
                      const correctOptionText =
                        question.options?.[optionLabelToIndex(question.correct_option)] ?? "";

                      return (
                        <div
                          key={question.question_no}
                          className={cn(
                            "rounded-xl border border-border-default p-4",
                            isAnswered && isCorrect && "border-success/40 bg-success-soft/40",
                            isAnswered && !isCorrect && "border-danger/40 bg-danger-soft/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-fg">
                                Question {question.question_no}
                              </h4>
                              {question.focus_chapter && (
                                <Badge variant="info">{question.focus_chapter}</Badge>
                              )}
                            </div>
                            <Badge variant={isAnswered ? (isCorrect ? "success" : "danger") : "default"}>
                              {isAnswered ? (isCorrect ? "Correct" : "Incorrect") : "Select an answer"}
                            </Badge>
                          </div>

                          <p className="mt-2 text-sm text-fg">{question.question_text}</p>

                          <div className="mt-3 grid gap-2">
                            {(question.options ?? []).map((option, index) => {
                              const optionLabel = OPTION_LABELS[index];
                              const optionState = getQuizOptionState(
                                optionLabel,
                                selectedOption,
                                question.correct_option,
                              );

                              return (
                                <button
                                  key={`${question.question_no}-${optionLabel}`}
                                  type="button"
                                  onClick={() => handleSelectOption(question.question_no, optionLabel)}
                                  disabled={isAnswered}
                                  aria-pressed={selectedOption === optionLabel}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                    "disabled:cursor-not-allowed",
                                    optionState === "idle" &&
                                      "border-border-default text-fg enabled:hover:bg-surface-2",
                                    optionState === "correct" &&
                                      "border-success/50 bg-success-soft text-success",
                                    optionState === "incorrect" &&
                                      "border-danger/50 bg-danger-soft text-danger",
                                  )}
                                >
                                  <span className="font-semibold">{optionLabel}.</span>
                                  <span>{option}</span>
                                </button>
                              );
                            })}
                          </div>

                          {isAnswered && (
                            <div
                              className={cn(
                                "mt-3 rounded-lg px-3 py-2 text-sm",
                                isCorrect
                                  ? "bg-success-soft text-success"
                                  : "bg-danger-soft text-danger",
                              )}
                            >
                              <p className="font-medium">
                                {isCorrect
                                  ? "Correct choice. Well done."
                                  : `Not quite. The correct answer is ${question.correct_option}. ${correctOptionText}`}
                              </p>
                              {question.explanation && (
                                <p className="mt-1 text-muted">Explanation: {question.explanation}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
