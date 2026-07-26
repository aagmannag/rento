"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MapPin } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useOwner } from "@/app/providers";
import { useToast } from "@/components/Toast";
import { CITIES } from "@/lib/types";
import { isValidPhone, isValidPincode, passwordIssue } from "@/lib/validation";

export default function ShopProfilePage() {
  const { owner, setOwner, logout } = useOwner();
  const { showToast } = useToast();
  const router = useRouter();

  const [ownerName, setOwnerName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!owner) return;
    setOwnerName(owner.ownerName);
    setShopName(owner.shopName);
    setPhone(owner.phone);
    setCity(owner.city);
    setAddress(owner.address);
    setPincode(owner.pincode ?? "");
  }, [owner]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (ownerName.trim().length < 2) next.ownerName = "Enter your full name";
    if (shopName.trim().length < 2) next.shopName = "Enter your shop/business name";
    if (!isValidPhone(phone)) next.phone = "Enter a valid 10-digit mobile number";
    if (address.trim().length < 10) next.address = "Enter the full pickup address";
    if (pincode && !isValidPincode(pincode)) next.pincode = "Enter a valid 6-digit pincode";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSavingProfile(true);
    try {
      const res = await fetch("/api/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          shopName: shopName.trim(),
          phone,
          city,
          address: address.trim(),
          pincode: pincode || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save changes");
      setOwner(data.owner);
      showToast("Shop profile updated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save changes", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");

    const issue = passwordIssue(newPassword);
    if (issue) return setPwError(issue);
    if (newPassword !== confirmPassword) return setPwError("New passwords don't match");
    if (!currentPassword) return setPwError("Enter your current password");

    setSavingPassword(true);
    try {
      const res = await fetch("/api/shop", {
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
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  if (!owner) return null;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Shop Profile" subtitle="Manage your account and pickup location" />

      <form onSubmit={handleSaveProfile} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Business details</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Your full name</label>
            <input className="input-field" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            {errors.ownerName && <p className="field-error">{errors.ownerName}</p>}
          </div>
          <div>
            <label className="field-label">Shop / business name</label>
            <input className="input-field" value={shopName} onChange={(e) => setShopName(e.target.value)} />
            {errors.shopName && <p className="field-error">{errors.shopName}</p>}
          </div>
        </div>

        <div>
          <label className="field-label">Email address</label>
          <input className="input-field opacity-60" value={owner.email} disabled />
          <p className="mt-1.5 text-xs text-muted-foreground">Email can&apos;t be changed. Contact support if needed.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Mobile number</label>
            <input
              className="input-field"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
            {errors.phone && <p className="field-error">{errors.phone}</p>}
          </div>
          <div>
            <label className="field-label">City</label>
            <select className="input-field" value={city} onChange={(e) => setCity(e.target.value)}>
              {!CITIES.includes(city as (typeof CITIES)[number]) && city && (
                <option value={city}>{city}</option>
              )}
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">
            Pickup location <span className="font-500 text-muted-foreground">(full address customers will collect vehicles from)</span>
          </label>
          <textarea
            rows={3}
            className="input-field resize-none"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          {errors.address && <p className="field-error">{errors.address}</p>}
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            Write the full address as precisely as you can. Rento&apos;s team pins your exact
            pickup point on the map during review, so customers see an accurate location —
            you don&apos;t need to set that yourself.
          </p>
        </div>

        <div>
          <label className="field-label">Pincode</label>
          <input
            className="input-field sm:max-w-[160px]"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          {errors.pincode && <p className="field-error">{errors.pincode}</p>}
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={savingProfile} className="btn-primary px-5 py-2.5 text-sm">
            {savingProfile ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <form onSubmit={handleChangePassword} className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Change password</h3>

        <div>
          <label className="field-label">Current password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className="input-field pr-10"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
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
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Confirm new password</label>
            <input
              type={showPw ? "text" : "password"}
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {pwError && <p className="field-error">{pwError}</p>}

        <div className="flex justify-end">
          <button type="submit" disabled={savingPassword} className="btn-primary px-5 py-2.5 text-sm">
            {savingPassword ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>

      <button onClick={handleLogout} className="btn-outline mt-6 w-full py-2.5 text-sm sm:hidden">
        Log Out
      </button>
    </div>
  );
}
