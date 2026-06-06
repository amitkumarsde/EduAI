"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuBookOpen,
  LuFileText,
  LuUsers,
  LuTrendingUp,
  LuPlus,
  LuEye,
  LuDownload,
  LuShare2,
} from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import {
  downloadPaperPDF,
  formatDate,
  getAllPapers,
  getTeacherAnalytics,
  triggerPDFDownload,
} from "@/lib/api";
import type { GeneratedPaper, TeacherAnalytics } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";

export function TeacherDashboard() {
  const router = useRouter();
  const { user } = useAppContext();
  const [papers, setPapers] = useState<GeneratedPaper[]>([]);
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [papersData, analyticsData] = await Promise.all([
          getAllPapers(),
          getTeacherAnalytics(),
        ]);
        setPapers(papersData);
        setAnalytics(analyticsData);
        setError(null);
      } catch (err) {
        setPapers([]);
        setAnalytics(null);
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = (analytics?.summary as Record<string, number | string>) ?? {};
  const stats = [
    { title: "Total exams created", value: String(summary.total_papers ?? papers.length), icon: LuBookOpen, tone: "accent" as const },
    { title: "Papers generated", value: String(summary.total_papers ?? papers.length), icon: LuFileText, tone: "success" as const },
    { title: "Students enrolled", value: String(summary.total_students ?? 0), icon: LuUsers, tone: "info" as const },
    { title: "Avg class score", value: `${summary.average_score ?? 0}%`, icon: LuTrendingUp, tone: "warning" as const },
  ];

  const recentExams = papers.slice(0, 5);

  async function handleDownload(paperId: string, title?: string) {
    try {
      const blob = await downloadPaperPDF(paperId);
      triggerPDFDownload(blob, title || "paper");
    } catch {
      alert("Unable to download this paper right now.");
    }
  }

  async function handleShare(paper: GeneratedPaper) {
    const paperId = (paper._id || paper.id) as string;
    const title = paper.title || "Exam Paper";
    const shareText = `${title} | ${paper.subject} | ${paper.class}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: shareText, url: `${window.location.origin}/exam/${paperId}` });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        alert("Paper details copied to clipboard.");
      } else {
        alert(shareText);
      }
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <Card className="relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 blur-3xl"
          style={{ background: "radial-gradient(40% 80% at 90% 0%, var(--accent-soft), transparent)" }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-fg">
              Welcome back, {user?.profile?.display_name || user?.name || "Teacher"}!
            </h2>
            <p className="mt-1 text-sm text-muted">
              {loading ? "Loading your latest papers…" : `You have ${papers.length} generated papers ready to review.`}
            </p>
          </div>
          <Button size="lg" onClick={() => router.push("/generate-paper")} className="gap-2">
            <LuPlus className="h-5 w-5" /> Generate new paper
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} title={stat.title} value={loading ? "…" : stat.value} icon={stat.icon} tone={stat.tone} />
        ))}
      </div>

      {/* Recent exams */}
      <Card>
        <CardHeader title="Recent exams" subtitle="Your five most recently generated papers" />
        {loading ? (
          <PageLoader label="Loading recent papers…" />
        ) : error ? (
          <CardBody>
            <Alert variant="danger">{error}</Alert>
          </CardBody>
        ) : recentExams.length === 0 ? (
          <CardBody>
            <EmptyState icon={LuFileText} title="No papers yet" description="Generate your first paper to see it here." action={<Button onClick={() => router.push("/generate-paper")}>Generate paper</Button>} />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs uppercase tracking-wider text-subtle">
                  <th className="px-5 py-3 font-medium">Exam name</th>
                  <th className="px-5 py-3 font-medium">Class</th>
                  <th className="px-5 py-3 font-medium">Subject</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {recentExams.map((exam) => {
                  const id = (exam._id || exam.id) as string;
                  return (
                    <tr key={id} className="transition-colors hover:bg-surface-2">
                      <td className="px-5 py-3 font-medium text-fg">{exam.title}</td>
                      <td className="px-5 py-3 text-muted">{exam.class}</td>
                      <td className="px-5 py-3 text-muted">{exam.subject}</td>
                      <td className="px-5 py-3 text-muted">{formatDate(exam.createdAt ?? (exam.created_at as string))}</td>
                      <td className="px-5 py-3"><Badge variant="success">PDF</Badge></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton title="View" onClick={() => router.push("/paper-generated")}><LuEye className="h-4 w-4" /></IconButton>
                          <IconButton title="Download" onClick={() => handleDownload(id, exam.title)}><LuDownload className="h-4 w-4" /></IconButton>
                          <IconButton title="Share" onClick={() => handleShare(exam)}><LuShare2 className="h-4 w-4" /></IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function IconButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-fg"
    >
      {children}
    </button>
  );
}

export default TeacherDashboard;
