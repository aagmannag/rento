"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Phone, ShieldCheck, Star, User as UserIcon, X } from "lucide-react";
import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useToast } from "@/components/Toast";
import { useApp } from "../providers";
import type { Gender } from "@/lib/types";

const GENDER_OPTIONS: Gender[] = ["Male", "Female", "Other", "Prefer not to say"];

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, bookings, openLoginModal, updateProfile } = useApp();
  const { showToast } = useToast();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [genderDraft, setGenderDraft] = useState<Gender | undefined>(undefined);
  const [nameError, setNameError] = useState("");

  if (!user?.isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Nav />
        <Header title="Profile" showBack={false} />
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
          <p className="text-sm text-muted-foreground">Login to view your profile.</p>
          <button onClick={openLoginModal} className="btn-primary px-5 py-2 text-sm">
            Login
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  function handleLogout() {
    logout();
    router.push("/");
  }

  function startEditing() {
    setNameDraft(user!.name);
    setGenderDraft(user!.gender);
    setNameError("");
    setEditing(true);
  }

  async function handleSave() {
    if (!nameDraft.trim()) {
      setNameError("Name can't be empty");
      return;
    }
    try {
      await updateProfile({ name: nameDraft.trim(), gender: genderDraft });
      showToast("Profile updated", "success");
      setEditing(false);
    } catch {
      showToast("Couldn't save your profile — please try again", "error");
    }
  }

  const profileComplete = user.name !== "Rento User" && Boolean(user.gender);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <Header title="Profile" showBack={false} />

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-800 text-primary-foreground">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-800 text-foreground">{user.name}</p>
              <p className="text-sm text-muted-foreground">+91 {user.phone}</p>
            </div>
          </div>
          {!editing && (
            <button
              onClick={startEditing}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-700 text-foreground transition hover:border-primary hover:text-primary"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>

        {!editing && !profileComplete && (
          <div className="mt-4 rounded-xl bg-secondary px-3.5 py-2.5 text-xs font-600 text-primary">
            Complete your profile — add your name and gender to personalize your bookings.
          </div>
        )}

        {editing ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-700 text-foreground">Edit Profile</p>
              <button
                onClick={() => setEditing(false)}
                aria-label="Cancel editing"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            <label className="block">
              <span className="text-xs font-600 text-muted-foreground">Full Name</span>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setNameError("");
                }}
                placeholder="Enter your full name"
                className="mt-1 w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
              {nameError && <p className="mt-1 text-xs font-600 text-red-500">{nameError}</p>}
            </label>

            <div className="mt-4">
              <span className="text-xs font-600 text-muted-foreground">Gender</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {GENDER_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGenderDraft(option)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-600 transition ${
                      genderDraft === option
                        ? "border-primary bg-secondary text-primary"
                        : "border-border text-foreground hover:border-primary/40"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-600 text-muted-foreground">Mobile Number</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                <Phone size={14} /> +91 {user.phone}
                <span className="ml-auto text-[11px]">Verified · can&apos;t be changed</span>
              </div>
            </label>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-700 text-foreground transition active:scale-[0.98]"
              >
                Cancel
              </button>
              <button onClick={handleSave} className="btn-primary flex-1 py-2.5 text-sm">
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-2xl font-800 text-primary">{bookings.length}</p>
                <p className="text-xs text-muted-foreground">Total bookings</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-2xl font-800 text-primary">
                  {bookings.filter((b) => b.status === "Upcoming").length}
                </p>
                <p className="text-xs text-muted-foreground">Upcoming rides</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-xs text-muted-foreground">Your rating from shop owners</p>
              {user.rating ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={16}
                        className={n <= Math.round(user.rating!.value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-800 text-foreground">{user.rating.value.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">
                    ({user.rating.count} rating{user.rating.count > 1 ? "s" : ""})
                  </span>
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Not yet rated — shop owners rate you after a completed ride.
                </p>
              )}
            </div>

            <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
              <InfoRow icon={<UserIcon size={14} />} label="Full name" value={user.name} />
              <InfoRow
                icon={<UserIcon size={14} />}
                label="Gender"
                value={user.gender ?? "Not specified"}
              />
              <InfoRow icon={<Phone size={14} />} label="Mobile number" value={`+91 ${user.phone}`} />
              <InfoRow icon={<ShieldCheck size={14} />} label="Login method" value="Phone + OTP" />
            </div>
          </>
        )}

        {!editing && (
          <button
            onClick={handleLogout}
            className="mt-8 w-full rounded-xl border border-red-200 py-3 text-sm font-700 text-red-500 transition active:scale-[0.98]"
          >
            Logout
          </button>
        )}
      </main>

      <Footer />
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-700 text-foreground">{value}</span>
    </div>
  );
}
