"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import type { UserRole } from "@/lib/types";
import Button from "@/components/ui/Button";
import { FieldGroup, Input, Label } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Misc";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const { register } = useAppContext();
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("student");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    class: "",
    school: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ ...form, role });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Get started in under a minute.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border-default bg-surface-2 p-1">
          {(["student", "teacher"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                "cursor-pointer rounded-md py-2 text-sm font-medium capitalize transition-colors",
                role === r ? "bg-surface text-fg shadow-[var(--shadow-sm)]" : "text-muted hover:text-fg",
              )}
            >
              I&apos;m a {r}
            </button>
          ))}
        </div>

        <FieldGroup>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={form.name} onChange={update("name")} required />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={update("email")} autoComplete="email" required />
        </FieldGroup>

        <FieldGroup>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={update("password")}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            required
          />
        </FieldGroup>

        {role === "student" && (
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label htmlFor="class">Class</Label>
              <Input id="class" value={form.class} onChange={update("class")} placeholder="e.g. Class 10" />
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="school">School</Label>
              <Input id="school" value={form.school} onChange={update("school")} placeholder="School name" />
            </FieldGroup>
          </div>
        )}

        <Button type="submit" fullWidth loading={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
