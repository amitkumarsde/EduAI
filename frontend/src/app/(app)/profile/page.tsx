"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuCheck, LuSave, LuLogOut } from "react-icons/lu";
import { useAppContext } from "@/context/AppContext";
import { updateProfile } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar, Alert } from "@/components/ui/Misc";
import { Label, FieldGroup, Input, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

const COLORS = ["#4f46e5", "#0ea5e9", "#16a34a", "#f59e0b", "#ef4444", "#7c3aed"];

export default function ProfilePage() {
  const router = useRouter();
  const { user, updateUser, logout } = useAppContext();
  const [form, setForm] = useState({
    name: user?.name || "",
    display_name: user?.profile?.display_name || "",
    avatar_color: user?.profile?.avatar_color || "#4f46e5",
    bio: user?.profile?.bio || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update =
    (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const previewName = form.display_name || form.name;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { user: updated } = await updateProfile(form);
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Manage your account details."
        actions={
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LuLogOut className="h-4 w-4" /> Log out
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              <Avatar name={previewName} color={form.avatar_color} size={64} />
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-fg">{previewName}</h2>
                <p className="text-sm text-muted">{user?.email}</p>
                {user?.role && (
                  <span className="mt-2 inline-block">
                    <Badge variant={user.role === "teacher" ? "accent" : "info"}>{user.role}</Badge>
                  </span>
                )}
              </div>
            </div>
            {user?.class && (
              <p className="mt-4 text-sm text-muted">
                {user.class} &middot; {user.school || "—"}
              </p>
            )}
            {form.bio && <p className="mt-4 text-sm text-fg">{form.bio}</p>}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="danger">{error}</Alert>}

              <FieldGroup>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={form.name} onChange={update("name")} />
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  value={form.display_name}
                  onChange={update("display_name")}
                  placeholder="How your name appears"
                />
              </FieldGroup>

              <FieldGroup>
                <Label>Avatar color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setForm((prev) => ({ ...prev, avatar_color: color }))}
                      aria-label={`Choose ${color}`}
                      className={cn(
                        "h-8 w-8 cursor-pointer rounded-full transition-transform hover:scale-110",
                        form.avatar_color === color
                          ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                          : "ring-1 ring-border-default",
                      )}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={3}
                  value={form.bio}
                  onChange={update("bio")}
                  placeholder="A short bio…"
                />
              </FieldGroup>

              <Button type="submit" disabled={saving} loading={saving} className="gap-2">
                {saved ? (
                  <>
                    <LuCheck className="h-4 w-4" /> Saved
                  </>
                ) : (
                  <>
                    <LuSave className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
                  </>
                )}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
