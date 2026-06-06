"use client";

import { useState, type FormEvent } from "react";
import type { Student } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { FieldGroup, Input, Label, Select } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Misc";

const CLASSES = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];

export function StudentSelector({
  students = [],
  loading = false,
  creating = false,
  error = null,
  currentStudent = null,
  onSelectStudent,
  onCreateStudent,
  title = "Student workspace",
  subtitle = "Profiles are created automatically after the first analyzed answer sheet. Select one to lock to an identity, or create one manually.",
}: {
  students?: Student[];
  loading?: boolean;
  creating?: boolean;
  error?: string | null;
  currentStudent?: Student | null;
  onSelectStudent: (id: string) => void;
  onCreateStudent: (data: { name: string; class: string; school: string }) => Promise<unknown>;
  title?: string;
  subtitle?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", class: "Class 10", school: "" });
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!formData.name.trim() || !formData.class.trim() || !formData.school.trim()) {
      setFormError("Name, class, and school are required.");
      return;
    }
    try {
      await onCreateStudent({
        name: formData.name.trim(),
        class: formData.class.trim(),
        school: formData.school.trim(),
      });
      setFormData({ name: "", class: formData.class, school: "" });
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create student.");
    }
  }

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button variant={showForm ? "secondary" : "primary"} size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Hide form" : "Create manually"}
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <FieldGroup>
          <Label htmlFor="student-selector">Active student (optional)</Label>
          <Select
            id="student-selector"
            value={currentStudent?.id || ""}
            onChange={(e) => onSelectStudent(e.target.value)}
            disabled={loading || students.length === 0}
          >
            {students.length === 0 ? (
              <option value="">{loading ? "Loading students…" : "No student profile yet"}</option>
            ) : (
              <>
                <option value="">No active student selected</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} · {student.class}
                  </option>
                ))}
              </>
            )}
          </Select>
        </FieldGroup>

        {(error || formError) && <Alert variant="danger">{formError || error}</Alert>}

        {showForm && (
          <form className="space-y-3 border-t border-border-default pt-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Student name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
              <Select
                value={formData.class}
                onChange={(e) => setFormData((p) => ({ ...p, class: e.target.value }))}
              >
                {CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Input
                placeholder="School name"
                value={formData.school}
                onChange={(e) => setFormData((p) => ({ ...p, school: e.target.value }))}
              />
            </div>
            <Button type="submit" loading={creating}>
              {creating ? "Creating…" : "Create student"}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

export default StudentSelector;
