"use client";

import { useEffect, useState } from "react";
import { LuTrophy, LuMedal } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { getLeaderboard } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar, Alert, EmptyState } from "@/components/ui/Misc";
import { PageLoader } from "@/components/ui/Spinner";
import { Label, Select } from "@/components/ui/Field";

const CLASS_OPTIONS = [
  "",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
];

interface LeaderboardRow extends LeaderboardEntry {
  id?: string | number;
  rank?: number;
  exam_count?: number;
  average_percentage?: number;
}

function rankLabel(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

export default function LeaderboardPage() {
  const { currentStudent, userRole } = useAppContext();
  const [classFilter, setClassFilter] = useState("");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const data = (await getLeaderboard(classFilter)) as LeaderboardRow[];
        if (!ignore) {
          setRows(data);
          setError(null);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load leaderboard");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [classFilter]);

  const description =
    userRole === "teacher"
      ? "Top performers across your classes, ranked by average exam score."
      : "Top performers ranked by average exam score.";

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        description={description}
        actions={
          <div>
            <Label htmlFor="lb-class">Filter by class</Label>
            <Select
              id="lb-class"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c || "all"} value={c}>
                  {c || "All classes"}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <Card>
        {loading ? (
          <PageLoader label="Loading rankings…" />
        ) : error ? (
          <div className="p-5">
            <Alert variant="danger">{error}</Alert>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={LuTrophy}
              title="No ranked students yet"
              description="Analyze some exams to populate the leaderboard."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs uppercase tracking-wider text-subtle">
                  <th className="px-5 py-3 font-medium">Rank</th>
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-5 py-3 font-medium">Class</th>
                  <th className="px-5 py-3 font-medium">Exams</th>
                  <th className="px-5 py-3 text-right font-medium">Avg %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {rows.map((row) => {
                  const rank = row.rank ?? 0;
                  const isTop = rank > 0 && rank <= 3;
                  const isMe =
                    currentStudent?.id != null &&
                    String(currentStudent.id) === String(row.id ?? "");
                  return (
                    <tr
                      key={String(row.id ?? rank)}
                      className={`transition-colors hover:bg-surface-2 ${isMe ? "bg-accent-soft" : ""}`}
                    >
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 font-medium text-fg">
                          {isTop && <LuMedal className="h-4 w-4 text-warning" />}
                          {rankLabel(rank)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={row.name} color={row.avatar_color} size={32} />
                          <span className="font-medium text-fg">{row.name}</span>
                          {isMe && <Badge variant="accent">You</Badge>}
                          {isTop && <Badge variant="warning">Top {rank}</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted">{row.class ?? "—"}</td>
                      <td className="px-5 py-3 text-muted">{row.exam_count ?? 0}</td>
                      <td className="px-5 py-3 text-right font-semibold text-fg">
                        {row.average_percentage ?? 0}%
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
