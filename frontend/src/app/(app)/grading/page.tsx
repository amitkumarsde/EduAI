"use client";

import { useState, type FormEvent } from "react";
import { LuPenLine, LuCopyCheck, LuPlus, LuTrash2 } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useLanguage } from "@/context/LanguageContext";
import { gradeEssay, checkSimilarity } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, EmptyState, ProgressBar } from "@/components/ui/Misc";
import { FieldGroup, Input, Label, Textarea } from "@/components/ui/Field";
import type { EssayGradeResult, SimilarityResult } from "@/lib/types";

export default function GradingPage() {
  const { userRole } = useAppContext();
  const { language } = useLanguage();
  const [tab, setTab] = useState<"essay" | "similarity">("essay");

  if (userRole !== "teacher") {
    return (
      <div>
        <PageHeader title="Essay Grader" description="AI essay grading and similarity checks." />
        <EmptyState icon={LuPenLine} title="Teacher access only" description="These grading tools are available to teachers." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="AI Grading Tools"
        description="Auto-grade long answers with rubric feedback, and flag suspiciously similar submissions."
      />
      <div className="mb-6 flex gap-2">
        <Button variant={tab === "essay" ? "primary" : "secondary"} size="sm" onClick={() => setTab("essay")}>
          <LuPenLine className="h-4 w-4" /> Essay grading
        </Button>
        <Button variant={tab === "similarity" ? "primary" : "secondary"} size="sm" onClick={() => setTab("similarity")}>
          <LuCopyCheck className="h-4 w-4" /> Similarity check
        </Button>
      </div>

      {tab === "essay" ? <EssayGrader language={language} /> : <SimilarityChecker />}
    </div>
  );
}

function EssayGrader({ language }: { language: string }) {
  const [question, setQuestion] = useState("");
  const [essay, setEssay] = useState("");
  const [maxMarks, setMaxMarks] = useState("10");
  const [result, setResult] = useState<EssayGradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!essay.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await gradeEssay({
        question,
        essay,
        max_marks: Number(maxMarks) || 10,
        language,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to grade essay");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardBody>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FieldGroup>
              <Label htmlFor="essay-q">Question / prompt (optional)</Label>
              <Input id="essay-q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Explain the causes of the French Revolution" />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="essay-marks">Maximum marks</Label>
              <Input id="essay-marks" type="number" min={1} max={100} value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="essay-text">Student answer</Label>
              <Textarea id="essay-text" value={essay} onChange={(e) => setEssay(e.target.value)} className="min-h-[220px]" placeholder="Paste the student's essay / long answer here…" />
            </FieldGroup>
            {error && <Alert variant="danger">{error}</Alert>}
            <Button type="submit" loading={loading} disabled={!essay.trim() || loading}>
              Grade with AI
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Result" subtitle="Rubric-based AI grade and feedback" />
        <CardBody>
          {!result ? (
            <p className="text-sm text-muted">Grade an essay to see the rubric breakdown here.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-semibold text-fg">
                  {result.score}/{result.max_marks}
                </span>
                <Badge variant={result.percentage >= 50 ? "success" : "danger"}>{result.percentage}%</Badge>
              </div>
              <ProgressBar value={result.percentage} tone={result.percentage >= 50 ? "success" : "danger"} />
              <div className="space-y-2">
                {result.rubric.map((r) => (
                  <div key={r.criterion} className="rounded-lg border border-border-default px-3 py-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-fg">{r.criterion}</span>
                      <span className="text-muted">{r.score}/{r.max}</span>
                    </div>
                    {r.comment && <p className="mt-1 text-xs text-muted">{r.comment}</p>}
                  </div>
                ))}
              </div>
              {result.feedback && (
                <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">{result.feedback}</div>
              )}
              {result.improvements.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-fg">Improvements</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                    {result.improvements.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function SimilarityChecker() {
  const [submissions, setSubmissions] = useState<{ id: string; text: string }[]>([
    { id: "Student 1", text: "" },
    { id: "Student 2", text: "" },
  ]);
  const [result, setResult] = useState<SimilarityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(index: number, patch: Partial<{ id: string; text: string }>) {
    setSubmissions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function handleCheck() {
    const valid = submissions.filter((s) => s.text.trim());
    if (valid.length < 2) {
      setError("Add at least two non-empty submissions.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await checkSimilarity({ submissions: valid, threshold: 0.8 });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check similarity");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          {submissions.map((s, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={s.id}
                  onChange={(e) => update(index, { id: e.target.value })}
                  className="w-48"
                  placeholder={`Student ${index + 1}`}
                />
                {submissions.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSubmissions((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remove submission"
                  >
                    <LuTrash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Textarea
                value={s.text}
                onChange={(e) => update(index, { text: e.target.value })}
                placeholder="Paste this submission's text…"
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setSubmissions((prev) => [...prev, { id: `Student ${prev.length + 1}`, text: "" }])}>
              <LuPlus className="h-4 w-4" /> Add submission
            </Button>
            <Button onClick={handleCheck} loading={loading}>
              Check similarity
            </Button>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardHeader
            title="Similarity results"
            subtitle={`Pairs above ${(result.threshold * 100).toFixed(0)}% are flagged`}
          />
          <CardBody className="space-y-2">
            {result.flagged.length > 0 && (
              <Alert variant="warning">
                {result.flagged.length} pair{result.flagged.length > 1 ? "s" : ""} flagged as highly similar.
              </Alert>
            )}
            {result.pairs.map((p, idx) => {
              const pct = Math.round(p.similarity * 100);
              const flagged = p.similarity >= result.threshold;
              return (
                <div key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-2">
                  <span className="truncate text-sm text-fg">
                    {p.a} ↔ {p.b}
                  </span>
                  <Badge variant={flagged ? "danger" : pct >= 50 ? "warning" : "default"}>{pct}%</Badge>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
