"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LuSearch, LuBuilding2, LuClock, LuArrowRight } from "react-icons/lu";
import { searchInstituteExams, getMyInstituteAttempts, formatDate } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { Alert, EmptyState } from "@/components/ui/Misc";
import { Input } from "@/components/ui/Field";
import type { InstituteAttemptSummary, InstituteExamSummary } from "@/lib/types";

export default function FindExamsPage() {
  const [query, setQuery] = useState("");
  const [exams, setExams] = useState<InstituteExamSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myAttempts, setMyAttempts] = useState<InstituteAttemptSummary[]>([]);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        const data = await getMyInstituteAttempts();
        if (!ignore) setMyAttempts(data);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // Debounced search (also runs once with empty query to show recent exams).
  useEffect(() => {
    let ignore = false;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchInstituteExams(query.trim())
        .then((data) => {
          if (!ignore) setExams(data);
        })
        .catch((e) => {
          if (!ignore) setError(e instanceof Error ? e.message : "Search failed");
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(handle);
    };
  }, [query]);

  return (
    <div>
      <PageHeader
        title="Find Exams"
        description="Search exams published by institutes by name, subject, or exam code, then attempt them online."
      />

      <div className="space-y-6">
        <Card>
          <CardBody>
            <div className="relative">
              <LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by institute, title, or exam code (e.g. EX-AB12C)"
                className="pl-9"
              />
            </div>
          </CardBody>
        </Card>

        {myAttempts.length > 0 && (
          <Card>
            <CardHeader title="Your recent results" subtitle="Institute exams you have submitted" />
            <CardBody className="space-y-2">
              {myAttempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-4 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{a.exam_code}</p>
                    <p className="text-xs text-muted">{formatDate(a.submitted_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.passed ? "success" : "danger"}>{a.grade}</Badge>
                    <span className="text-sm text-muted">{a.percentage}%</span>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : exams.length === 0 ? (
          <EmptyState icon={LuSearch} title="No exams found" description="Try a different institute name or exam code." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {exams.map((exam) => (
              <Card key={exam.id} hover>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-fg">{exam.title}</h3>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
                        <LuBuilding2 className="h-3.5 w-3.5" /> {exam.institute_name}
                      </p>
                    </div>
                    <Badge variant="accent">{exam.exam_code}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    {exam.subject && <Badge>{exam.subject}</Badge>}
                    {exam.class && <Badge>{exam.class}</Badge>}
                    <Badge>
                      <LuClock className="h-3 w-3" /> {exam.duration_minutes} min
                    </Badge>
                    <Badge>{exam.question_count} Q · {exam.total_marks} marks</Badge>
                  </div>
                  <Link href={`/exams/take/${exam.exam_code}`}>
                    <Button size="sm" fullWidth>
                      Start exam <LuArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
