"use client";

import { useRouter } from "next/navigation";
import { LuTarget, LuListChecks, LuTriangleAlert } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useStudentWorkspace } from "@/hooks/useStudentWorkspace";
import { useStudentOverview } from "@/hooks/useStudentOverview";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import { StudentSelector } from "@/components/StudentSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";
import { SmartContent } from "@/components/SmartContent";

interface SubTopic {
  status?: string;
}

interface ChapterHealth {
  chapter_name: string;
  sub_topics?: SubTopic[];
}

interface SubjectTopicHealth {
  subject: string;
  topic_health?: ChapterHealth[];
}

export default function RecommendationsPage() {
  const router = useRouter();
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
  const { overview, loading: overviewLoading, error: overviewError } = useStudentOverview(currentStudent?.id);

  if (userRole !== "student") {
    return (
      <div>
        <PageHeader title="Recommendations" description="View AI recommendations and focus topics." />
        <EmptyState
          icon={LuTarget}
          title="Student access only"
          description="Switch to student mode to view AI recommendations and focus topics."
        />
      </div>
    );
  }

  const ov = (overview ?? {}) as Record<string, unknown>;
  const recommendations = (ov.recommendations as {
    suggested_goal?: string;
    history_feedback?: string;
    priority_topics?: string[];
    weak_topics?: string[];
  }) ?? {};
  const topicHealth = (ov.topic_health as SubjectTopicHealth[]) ?? [];
  const subjects = ((ov.summary as { subjects?: string[] } | undefined)?.subjects ?? []) as string[];

  return (
    <div>
      <PageHeader
        title="Recommendations"
        description="Use AI-generated focus areas, goal suggestions, and topic health signals to guide the next revision session."
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
          <PageLoader label="Loading recommendations…" />
        ) : overviewError ? (
          <Alert variant="danger">{overviewError}</Alert>
        ) : !currentStudent ? (
          <EmptyState
            icon={LuTarget}
            title="No active student yet"
            description="Your student profile appears automatically after the first analyzed answer sheet. AI recommendations will unlock after that analysis is saved."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Suggested goal"
                value={recommendations.suggested_goal || "N/A"}
                icon={LuTarget}
                tone="accent"
                hint="Based on the most recent analyzed exam"
              />
              <StatCard
                title="Priority topics"
                value={(recommendations.priority_topics || []).length}
                icon={LuListChecks}
                tone="warning"
                hint="Topics to revise first before the next exam"
              />
              <StatCard
                title="Weak topics"
                value={(recommendations.weak_topics || []).length}
                icon={LuTriangleAlert}
                tone="danger"
                hint="Derived from analyzed chapter-level performance"
              />
            </div>

            <Card className="p-6">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <LuTarget className="h-5 w-5" />
                </span>
                <h3 className="text-base font-semibold text-fg">AI guidance</h3>
              </div>
              <p className="mt-3 text-sm text-muted">
                {recommendations.history_feedback ||
                  "Analyze an exam to unlock personalized guidance for this student."}
              </p>
              <div className="mt-4">
                <Button onClick={() => router.push("/quiz")}>Open revision quiz</Button>
              </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Priority topics" />
                <CardBody>
                  <div className="flex flex-wrap gap-2">
                    {(recommendations.priority_topics || []).length === 0 ? (
                      <Badge>No priority topics yet</Badge>
                    ) : (
                      recommendations.priority_topics!.map((topic) => (
                        <Badge key={topic} variant="warning">
                          {topic}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Weak topics" />
                <CardBody>
                  <div className="flex flex-wrap gap-2">
                    {(recommendations.weak_topics || []).length === 0 ? (
                      <Badge>No weak topics yet</Badge>
                    ) : (
                      recommendations.weak_topics!.map((topic) => (
                        <Badge key={topic} variant="warning">
                          {topic}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>

            <SmartContent studentId={currentStudent.id} subjects={subjects} />

            <Card>
              <CardHeader title="Topic health" />
              <CardBody className="space-y-2">
                {topicHealth.length === 0 ? (
                  <p className="text-sm text-muted">
                    Topic health data will appear here after analyzed exams are processed.
                  </p>
                ) : (
                  topicHealth.flatMap((subjectEntry) =>
                    (subjectEntry.topic_health || []).map((chapter) => {
                      const crystalClearCount = (chapter.sub_topics || []).filter(
                        (subTopic) => subTopic.status === "crystal_clear",
                      ).length;
                      const partialCount = (chapter.sub_topics || []).filter(
                        (subTopic) => subTopic.status === "partial_understanding",
                      ).length;
                      const noKnowledgeCount = (chapter.sub_topics || []).filter(
                        (subTopic) => subTopic.status === "no_knowledge",
                      ).length;

                      return (
                        <div
                          key={`${subjectEntry.subject}-${chapter.chapter_name}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-3"
                        >
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-medium text-fg">
                              {subjectEntry.subject} | {chapter.chapter_name}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {crystalClearCount} clear, {partialCount} partial, {noKnowledgeCount} gaps
                            </span>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-2">
                            {noKnowledgeCount > 0 && (
                              <Badge variant="warning">{noKnowledgeCount} needs attention</Badge>
                            )}
                            {partialCount > 0 && <Badge>{partialCount} building</Badge>}
                            {crystalClearCount > 0 && (
                              <Badge variant="success">{crystalClearCount} strong</Badge>
                            )}
                          </div>
                        </div>
                      );
                    }),
                  )
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
