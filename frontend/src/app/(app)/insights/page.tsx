"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuTriangleAlert,
  LuTrendingDown,
  LuTrendingUp,
  LuActivity,
  LuShieldCheck,
} from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { useStudentWorkspace } from "@/hooks/useStudentWorkspace";
import { getStudentInsights } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { StudentSelector } from "@/components/StudentSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";

type RiskLevel = "high" | "medium" | "low";

const RISK_LABEL: Record<RiskLevel, string> = {
  high: "High risk",
  medium: "Watch",
  low: "On track",
};

const RISK_VARIANT: Record<RiskLevel, "danger" | "warning" | "success"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

interface SubjectInsight {
  subject: string;
  latest_percentage: number;
  average_percentage: number;
  trend: number;
  risk_level: RiskLevel;
  predicted_next_percentage: number;
  exam_count: number;
}

interface AtRiskTopic {
  topic: string;
  occurrences: number;
  priority: "high" | "medium";
}

interface InsightAlert {
  severity: "high" | "medium" | "low";
  subject: string | null;
  message: string;
}

interface InsightsData {
  overall_risk: RiskLevel;
  subjects: SubjectInsight[];
  at_risk_topics: AtRiskTopic[];
  alerts: InsightAlert[];
  recommended_actions: string[];
}

const ALERT_VARIANT: Record<InsightAlert["severity"], "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

export default function InsightsPage() {
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

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentId = currentStudent?.id;

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!studentId) {
        if (!ignore) {
          setInsights(null);
          setError(null);
          setLoading(false);
        }
        return;
      }
      try {
        setLoading(true);
        const data = (await getStudentInsights(studentId)) as unknown as InsightsData;
        if (!ignore) {
          setInsights(data);
          setError(null);
        }
      } catch (fetchError) {
        if (!ignore) {
          setInsights(null);
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load insights");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [studentId]);

  return (
    <div>
      <PageHeader
        title="Predictive Insights"
        description="AI-driven risk prediction and early-warning alerts based on performance trends."
      />

      <div className="space-y-6">
        {userRole === "teacher" && (
          <StudentSelector
            students={students}
            loading={studentLoading}
            creating={creating}
            error={studentError}
            currentStudent={currentStudent}
            onSelectStudent={selectStudent}
            onCreateStudent={createStudentProfile}
          />
        )}

        {!currentStudent && (
          <EmptyState
            icon={LuActivity}
            title="No active student"
            description="Select a student to view their predictive insights."
          />
        )}

        {loading && <PageLoader label="Analyzing performance…" />}

        {error && <Alert variant="danger">{error}</Alert>}

        {insights && !loading && (
          <>
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                    insights.overall_risk === "low"
                      ? "bg-success-soft text-success"
                      : insights.overall_risk === "medium"
                        ? "bg-warning-soft text-warning"
                        : "bg-danger-soft text-danger"
                  }`}
                >
                  {insights.overall_risk === "low" ? (
                    <LuShieldCheck className="h-6 w-6" />
                  ) : (
                    <LuTriangleAlert className="h-6 w-6" />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight text-fg">
                    Overall: {RISK_LABEL[insights.overall_risk]}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {insights.alerts[0]?.message || "Keep practicing consistently to stay on track."}
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <LuActivity className="h-4 w-4 text-muted" /> Subject risk &amp; forecast
                    </span>
                  }
                />
                <CardBody className="space-y-4">
                  {insights.subjects.length === 0 && <p className="text-sm text-muted">No exam data yet.</p>}
                  {insights.subjects.map((subject) => (
                    <div
                      key={subject.subject}
                      className="rounded-lg border border-border-default px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-fg">{subject.subject}</span>
                        <Badge variant={RISK_VARIANT[subject.risk_level]}>{RISK_LABEL[subject.risk_level]}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                        <span>Latest {subject.latest_percentage}%</span>
                        <span className={`flex items-center gap-1 ${subject.trend < 0 ? "text-danger" : "text-success"}`}>
                          {subject.trend < 0 ? (
                            <LuTrendingDown className="h-3.5 w-3.5" />
                          ) : (
                            <LuTrendingUp className="h-3.5 w-3.5" />
                          )}
                          {subject.trend > 0 ? "+" : ""}
                          {subject.trend} pts
                        </span>
                        <span>Predicted next ~{subject.predicted_next_percentage}%</span>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <LuTriangleAlert className="h-4 w-4 text-muted" /> At-risk topics
                    </span>
                  }
                />
                <CardBody className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    {insights.at_risk_topics.length === 0 ? (
                      <p className="text-sm text-muted">No recurring weak topics detected.</p>
                    ) : (
                      insights.at_risk_topics.map((topic) => (
                        <Badge key={topic.topic} variant={topic.priority === "high" ? "warning" : "default"}>
                          {topic.topic} · {topic.occurrences}&times;
                        </Badge>
                      ))
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-fg">Recommended actions</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                      {insights.recommended_actions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => router.push("/quiz")}>Practice weak topics</Button>
                    <Button variant="secondary" onClick={() => router.push("/tutor")}>
                      Ask the AI Tutor
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>

            {insights.alerts.length > 0 && (
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <LuTriangleAlert className="h-4 w-4 text-muted" /> Alerts
                    </span>
                  }
                />
                <CardBody className="space-y-2">
                  {insights.alerts.map((alert, index) => (
                    <Alert key={index} variant={ALERT_VARIANT[alert.severity]}>
                      {alert.message}
                    </Alert>
                  ))}
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
