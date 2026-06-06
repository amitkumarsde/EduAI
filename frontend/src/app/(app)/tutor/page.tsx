"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { LuBot, LuSend, LuUser } from "react-icons/lu";
import { askTutor } from "@/lib/api";
import type { TutorMessage } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/Misc";
import { FieldGroup, Input, Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

const SUBJECTS = ["", "Mathematics", "Science", "English", "Social Science"];

const INITIAL_MESSAGES: TutorMessage[] = [
  {
    role: "assistant",
    content:
      "Hi! I'm your EduAI Tutor. Ask me to explain any concept, walk through a problem step by step, or help with your weak topics.",
  },
];

export default function TutorPage() {
  const { language } = useLanguage();
  const [subject, setSubject] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<TutorMessage[]>(INITIAL_MESSAGES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const history: TutorMessage[] = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const data = await askTutor({ message, subject, history, language });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? data.answer ?? "" },
      ]);
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "The tutor is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Tutor"
        description="Your 24/7 personal tutor. Step-by-step explanations powered by Gemini."
        actions={
          <div className="flex items-center gap-2">
            <LanguageSelect />
            <FieldGroup className="w-44">
              <Label htmlFor="tutor-subject" className="sr-only">
                Subject
              </Label>
              <Select
                id="tutor-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              >
                {SUBJECTS.map((s) => (
                  <option key={s || "any"} value={s}>
                    {s || "Any subject"}
                  </option>
                ))}
              </Select>
            </FieldGroup>
          </div>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
            {messages.map((msg, index) => (
              <MessageRow key={index} role={msg.role}>
                {msg.content}
              </MessageRow>
            ))}
            {loading && (
              <MessageRow role="assistant">
                <span className="inline-flex items-center gap-2 text-muted">
                  <Spinner className="h-4 w-4" /> Thinking…
                </span>
              </MessageRow>
            )}
            <div ref={endRef} />
          </div>

          {error && <Alert variant="danger">{error}</Alert>}

          <form className="flex items-center gap-2 border-t border-border-default pt-4" onSubmit={handleSend}>
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask anything… e.g. Explain quadratic equations with an example"
            />
            <Button type="submit" loading={loading} disabled={loading || !input.trim()} aria-label="Send message">
              <LuSend className="h-4 w-4" />
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function MessageRow({
  role,
  children,
}: {
  role: TutorMessage["role"];
  children: React.ReactNode;
}) {
  const isAssistant = role === "assistant";
  return (
    <div className={cn("flex items-start gap-3", !isAssistant && "flex-row-reverse")}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isAssistant ? "bg-accent-soft text-accent" : "bg-surface-3 text-muted",
        )}
      >
        {isAssistant ? <LuBot className="h-4 w-4" /> : <LuUser className="h-4 w-4" />}
      </span>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm",
          isAssistant
            ? "border border-border-default bg-surface-2 text-fg"
            : "bg-accent text-accent-fg",
        )}
      >
        {children}
      </div>
    </div>
  );
}
