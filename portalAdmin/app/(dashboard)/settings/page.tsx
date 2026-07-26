"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useAdmin } from "@/app/providers";
import { useToast } from "@/components/Toast";
import { passwordIssue } from "@/lib/validation";

export default function SettingsPage() {
  const { admin, setAdmin } = useAdmin();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (admin) setName(admin.name);
  }, [admin]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError("");
    if (name.trim().length < 2) return setNameError("Enter your full name");

    setSavingName(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update name");

      setAdmin(data.admin);
      showToast("Name updated", "success");
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!currentPassword) return setError("Enter your current password");
    const issue = passwordIssue(newPassword);
    if (issue) return setError(issue);
    if (newPassword !== confirmPassword) return setError("New passwords don't match");

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");

      showToast("Password updated", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  if (!admin) return null;

  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" subtitle="Manage your admin account" />

      <form onSubmit={handleSaveName} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Account</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Name</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
              }}
            />
            {nameError && <p className="field-error">{nameError}</p>}
          </div>
          <div>
            <p className="field-label">Email</p>
            <p className="input-field bg-muted text-muted-foreground">{admin.email}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={savingName || name.trim() === admin.name} className="btn-primary px-5 py-2.5 text-sm">
            {savingName ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Change password</h3>

        <div>
          <label className="field-label">Current password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className="input-field pr-10"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError("");
              }}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:bg-muted"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">New password</label>
            <input
              type={showPw ? "text" : "password"}
              className="input-field"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError("");
              }}
            />
          </div>
          <div>
            <label className="field-label">Confirm new password</label>
            <input
              type={showPw ? "text" : "password"}
              className="input-field"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError("");
              }}
            />
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary px-5 py-2.5 text-sm">
            {saving ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}
