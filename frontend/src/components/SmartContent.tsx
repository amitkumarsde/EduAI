"use client";

import { useState } from "react";
import {
  LuVideo,
  LuFileText,
  LuLayers,
  LuDumbbell,
  LuExternalLink,
  LuBrain,
  LuSparkles,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { getContentRecommendations } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Misc";
import { FieldGroup, Label, Select } from "@/components/ui/Field";
import type { ContentRecommendations, ContentResource } from "@/lib/types";

const TYPE_ICON: Record<ContentResource["type"], IconType> = {
  video: LuVideo,
  article: LuFileText,
  flashcards: LuLayers,
  practice: LuDumbbell,
};

function resourceLink(resource: ContentResource): string {
  const query = encodeURIComponent(resource.search_query);
  return resource.type === "video"
    ? `https://www.youtube.com/results?search_query=${query}`
    : `https://www.google.com/search?q=${query}`;
}

/**
 * AI-powered smart content recommendations (#11) and meta-learning study
 * strategies (#12) for a student in a chosen subject.
 */
export function SmartContent({
  studentId,
  subjects,
}: {
  studentId?: string;
  subjects: string[];
}) {
  const { language } = useLanguage();
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [data, setData] = useState<ContentRecommendations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    const chosen = subject || subjects[0];
    if (!chosen) {
      setError("Add an analyzed subject first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getContentRecommendations({
        student_id: studentId,
        subject: chosen,
        language,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <LuSparkles className="h-4 w-4 text-accent" /> Smart content & study strategies
          </span>
        }
        subtitle="AI-suggested videos, reading, flashcards, and meta-learning techniques for weak topics"
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <FieldGroup className="w-44">
            <Label htmlFor="content-subject">Subject</Label>
            <Select
              id="content-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={subjects.length === 0}
            >
              {subjects.length === 0 ? (
                <option value="">No subjects yet</option>
              ) : (
                subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              )}
            </Select>
          </FieldGroup>
          <LanguageSelect />
          <Button onClick={handleFetch} loading={loading} disabled={subjects.length === 0}>
            Get recommendations
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {data && (
          <div className="space-y-5">
            {data.weak_topics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.weak_topics.map((t) => (
                  <Badge key={t} variant="warning">
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-fg">Recommended resources</p>
              {data.resources.length === 0 ? (
                <p className="text-sm text-muted">No resources returned. Try again.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.resources.map((r, idx) => {
                    const Icon = TYPE_ICON[r.type] ?? LuFileText;
                    return (
                      <a
                        key={idx}
                        href={resourceLink(r)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 rounded-lg border border-border-default p-3 transition-colors hover:border-border-strong hover:bg-surface-2"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 text-sm font-medium text-fg">
                            {r.title}
                            <LuExternalLink className="h-3 w-3 text-subtle" />
                          </span>
                          <span className="block text-xs text-muted">{r.description}</span>
                          <span className="mt-1 block text-[11px] uppercase tracking-wide text-subtle">
                            {r.type} · {r.topic}
                          </span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-fg">
                <LuBrain className="h-4 w-4 text-accent" /> Meta-learning strategies
              </p>
              <div className="space-y-2">
                {data.strategies.map((s, idx) => (
                  <div key={idx} className="rounded-lg border border-border-default px-4 py-3">
                    <p className="text-sm font-medium text-fg">{s.name}</p>
                    <p className="mt-0.5 text-sm text-muted">{s.description}</p>
                    {s.when_to_use && (
                      <p className="mt-1 text-xs text-subtle">When to use: {s.when_to_use}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default SmartContent;
