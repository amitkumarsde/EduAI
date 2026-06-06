"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { LuCircleCheck, LuDownload, LuShare2, LuRotateCcw, LuFileText } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { downloadPaperPDF, triggerPDFDownload } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Misc";
import { PageHeader } from "@/components/layout/PageHeader";

interface PaperInfo {
  exam_type?: string;
  subject?: string;
  class?: string;
  title?: string;
  total_marks?: number | string;
  duration?: string;
  num_questions?: number | string;
  chapters_covered?: string[];
}

interface PaperQuestion {
  question_no?: number | string;
  marks?: number | string;
  question_text?: string;
  options?: string[];
}

interface PaperPayload {
  paperId?: string;
  downloadUrl?: string;
  paper_info?: PaperInfo;
  questions?: PaperQuestion[];
  data?: PaperPayload;
}

export default function PaperGeneratedPage() {
  const router = useRouter();
  const { currentPaper } = useAppContext();

  const paperData = currentPaper as PaperPayload | null;

  if (!paperData) {
    return (
      <div>
        <PageHeader title="Paper Generated" description="Review and share your generated exam paper" />
        <EmptyState
          icon={LuFileText}
          title="No paper data found"
          description="Generate a paper first and it will appear here, ready to download and share."
          action={
            <Link href="/generate-paper">
              <Button variant="primary">Go to Generate Paper</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const paperId = paperData.paperId || paperData.data?.paperId || null;
  const downloadUrl =
    paperData.downloadUrl ||
    paperData.data?.downloadUrl ||
    (paperId ? `/api/papers/${paperId}/download` : null);

  const paper: PaperInfo = paperData.data?.paper_info || paperData.paper_info || {};
  const questions: PaperQuestion[] = paperData.data?.questions || paperData.questions || [];

  async function handleDownload() {
    if (!paperId) {
      if (downloadUrl) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }
      alert("Paper download link is not available yet.");
      return;
    }

    try {
      const blob = await downloadPaperPDF(paperId);
      const fileName =
        [paper.exam_type, paper.subject, paper.class].filter(Boolean).join("_") || "paper";
      triggerPDFDownload(blob, fileName);
    } catch (error) {
      console.error("Error downloading paper:", error);
      alert("Failed to download paper. Please try again.");
    }
  }

  async function handleShare() {
    const shareUrl = downloadUrl ? `${window.location.origin}${downloadUrl}` : window.location.href;
    const shareText = `${paper.exam_type || "Exam"} - ${paper.subject || "Paper"}${
      downloadUrl ? `\nDownload: ${shareUrl}` : ""
    }`;

    try {
      if (navigator.share) {
        await navigator.share({ title: paper.title || "Generated Paper", text: shareText, url: shareUrl });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        alert("Paper details copied to clipboard.");
        return;
      }
      alert(shareText);
    } catch (error) {
      console.error("Error sharing paper:", error);
      alert("Unable to share this paper right now.");
    }
  }

  function handleRegenerate() {
    router.push("/generate-paper");
  }

  const metadata = [
    { label: "Total Marks", value: paper.total_marks != null ? `${paper.total_marks} marks` : "—" },
    { label: "Duration", value: paper.duration || "—" },
    { label: "Number of Questions", value: String(questions.length || paper.num_questions || "—") },
    { label: "Format", value: "PDF" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Paper Generated" description="Review and share your generated exam paper" />

      {/* Success banner */}
      <Card className="relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 blur-3xl"
          style={{ background: "radial-gradient(40% 80% at 90% 0%, var(--success-soft), transparent)" }}
        />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <LuCircleCheck className="h-9 w-9" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-fg">Paper generated successfully</h2>
          <p className="text-sm text-muted">Your PDF exam paper has been created and is ready to use.</p>
        </div>
      </Card>

      {/* Paper preview */}
      <Card>
        <CardHeader
          title={[paper.exam_type, paper.subject, paper.class].filter(Boolean).join(" — ") || "Generated Paper"}
          action={<Badge variant="success">Generated</Badge>}
        />
        <CardBody className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metadata.map((item) => (
              <div key={item.label} className="rounded-lg border border-border-default bg-surface-2 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-subtle">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-fg">{item.value}</p>
              </div>
            ))}
          </div>

          {paper.chapters_covered && paper.chapters_covered.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-fg">Chapters Covered</h4>
              <div className="flex flex-wrap gap-2">
                {paper.chapters_covered.map((chapter) => (
                  <Badge key={chapter} variant="accent">
                    {chapter}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" size="lg" onClick={handleDownload} className="gap-2">
              <LuDownload className="h-5 w-5" /> Download PDF
            </Button>
            <Button variant="secondary" size="lg" onClick={handleShare} className="gap-2">
              <LuShare2 className="h-5 w-5" /> Share with Students
            </Button>
            <Button variant="outline" size="lg" onClick={handleRegenerate} className="gap-2">
              <LuRotateCcw className="h-5 w-5" /> Regenerate
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Questions preview */}
      {questions.length > 0 && (
        <Card>
          <CardHeader title="Paper preview" subtitle="First 3 questions" />
          <CardBody className="space-y-4">
            {questions.slice(0, 3).map((question, index) => (
              <div key={index} className="rounded-lg border border-border-default bg-surface-2 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-fg">Q{question.question_no ?? index + 1}</span>
                  {question.marks != null && (
                    <span className="text-xs font-medium text-subtle">[{question.marks} marks]</span>
                  )}
                </div>
                <p className="text-sm text-fg">{question.question_text}</p>
                {question.options && question.options.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {question.options.map((option, idx) => (
                      <div key={idx} className="text-sm text-muted">
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Info section */}
      <Card>
        <CardBody>
          <h4 className="text-sm font-semibold text-fg">Paper added successfully</h4>
          <p className="mt-1 text-sm text-muted">
            This exam has been added to the Student Dashboard as a new exam. Students can now download the
            paper and submit their answer sheet for checking.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
