"use client";

import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { LuZap, LuX } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { generatePaper } from "@/lib/api";
import type { GeneratedPaper, PaperFormData } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Misc";
import { PageHeader } from "@/components/layout/PageHeader";
import { Label, FieldGroup, Input, Select } from "@/components/ui/Field";

interface FormState {
  examType: string;
  subject: string;
  class: string;
  chapters: string[];
  totalMarks: string;
  numQuestions: string;
  duration: string;
}

const examTypes = ["UT-1", "UT-2", "Mid-Term", "Final Exam"];
const classes = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
const durations = ["1 Hour", "1.5 Hours", "2 Hours", "3 Hours"];

export default function GenerateTestPaperPage() {
  const router = useRouter();
  const { setCurrentPaper } = useAppContext();

  const [formData, setFormData] = useState<FormState>({
    examType: "",
    subject: "",
    class: "",
    chapters: [],
    totalMarks: "",
    numQuestions: "",
    duration: "",
  });
  const [chapterInput, setChapterInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleInputChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function addChapter() {
    const trimmed = chapterInput.trim();
    if (trimmed && !formData.chapters.includes(trimmed)) {
      setFormData((prev) => ({ ...prev, chapters: [...prev.chapters, trimmed] }));
      setChapterInput("");
    }
  }

  function removeChapter(chapter: string) {
    setFormData((prev) => ({ ...prev, chapters: prev.chapters.filter((c) => c !== chapter) }));
  }

  function handleKeyPress(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addChapter();
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (
      !formData.examType ||
      !formData.subject ||
      !formData.class ||
      !formData.chapters.length ||
      !formData.totalMarks ||
      !formData.duration
    ) {
      setError("Please fill all required fields");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        exam_type: formData.examType,
        subject: formData.subject,
        class: formData.class,
        chapters: formData.chapters,
        total_marks: parseInt(formData.totalMarks, 10),
        num_questions: formData.numQuestions ? parseInt(formData.numQuestions, 10) : undefined,
        duration: formData.duration,
      } satisfies Record<string, unknown>;

      const data = await generatePaper(payload as unknown as PaperFormData);

      setCurrentPaper(data as unknown as GeneratedPaper);
      router.push("/paper-generated");
    } catch (err) {
      console.error("Error generating paper:", err);
      setError(err instanceof Error ? err.message : "Failed to generate paper. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Generate Test Paper"
        description="Create a new PDF exam paper using AI assistance"
      />

      <Card>
        <CardBody className="space-y-6">
          {error && <Alert variant="danger">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="examType">
                  Exam Type <span className="text-danger">*</span>
                </Label>
                <Select id="examType" name="examType" value={formData.examType} onChange={handleInputChange} required>
                  <option value="">Select exam type...</option>
                  {examTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="subject">
                  Subject <span className="text-danger">*</span>
                </Label>
                <Input
                  id="subject"
                  type="text"
                  name="subject"
                  placeholder="e.g., Mathematics, Physics, Hindi"
                  value={formData.subject}
                  onChange={handleInputChange}
                  required
                />
              </FieldGroup>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="class">
                  Class / Standard <span className="text-danger">*</span>
                </Label>
                <Select id="class" name="class" value={formData.class} onChange={handleInputChange} required>
                  <option value="">Select class...</option>
                  {classes.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </Select>
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="duration">
                  Duration <span className="text-danger">*</span>
                </Label>
                <Select id="duration" name="duration" value={formData.duration} onChange={handleInputChange} required>
                  <option value="">Select duration...</option>
                  {durations.map((dur) => (
                    <option key={dur} value={dur}>
                      {dur}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
            </div>

            <FieldGroup>
              <Label>
                Chapters / Topics <span className="text-danger">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter chapter name and press Enter or click Add"
                  value={chapterInput}
                  onChange={(e) => setChapterInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
                <Button type="button" variant="secondary" size="md" onClick={addChapter}>
                  Add
                </Button>
              </div>
              {formData.chapters.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.chapters.map((chapter) => (
                    <Badge key={chapter} variant="accent" className="gap-1.5">
                      <span>{chapter}</span>
                      <button
                        type="button"
                        onClick={() => removeChapter(chapter)}
                        className="inline-flex cursor-pointer items-center justify-center rounded-full text-accent transition-colors hover:text-fg"
                        aria-label={`Remove ${chapter}`}
                      >
                        <LuX className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </FieldGroup>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="totalMarks">
                  Total Marks <span className="text-danger">*</span>
                </Label>
                <Input
                  id="totalMarks"
                  type="number"
                  name="totalMarks"
                  placeholder="e.g., 25, 80"
                  value={formData.totalMarks}
                  onChange={handleInputChange}
                  min="1"
                  max="80"
                  required
                />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="numQuestions">Number of Questions</Label>
                <Input
                  id="numQuestions"
                  type="number"
                  name="numQuestions"
                  placeholder="Leave empty for auto (optional)"
                  value={formData.numQuestions}
                  onChange={handleInputChange}
                  min="1"
                  max="40"
                />
              </FieldGroup>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
              <LuZap className="h-4 w-4 shrink-0 text-accent" />
              <span>Paper will be generated as a PDF using AI based on CBSE/NCERT curriculum</span>
            </div>

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} disabled={loading}>
              {loading ? "Generating Paper..." : "Generate Paper with AI"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
