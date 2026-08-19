"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  RotateCcw,
  Star,
  X,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { CATEGORY_ICON } from "@/components/CategoryIcon";
import { useOwner } from "@/app/providers";
import {
  CATEGORIES,
  CITIES,
  FEATURE_SUGGESTIONS,
  type Category,
  type FuelType,
  type Transmission,
  type Vehicle,
} from "@/lib/types";

const FUEL_OPTIONS: FuelType[] = ["Petrol", "Diesel", "Electric", "CNG"];
const TRANSMISSION_OPTIONS: Transmission[] = ["Manual", "Automatic"];

// Matches @rento/db's MIN_ONLINE_PAYMENT_RUPEES (the authoritative check, re-enforced
// server-side in POST/PATCH /api/vehicles) — duplicated here rather than imported since
// @rento/db pulls in Prisma/pg, which can't be bundled into a "use client" component.
// Below this, a customer booking this vehicle for a single day/hour would be sent to pay
// a UPI amount small enough that banks commonly flag it as a fraud-probe pattern and
// silently reject it, which looks like a broken booking flow rather than a pricing issue.
const MIN_ONLINE_PAYMENT_RUPEES = 10;

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // mirrors /api/upload's limit — fail fast client-side
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface PhotoItem {
  id: string;
  url: string; // "" while uploading/processing; the final local /uploads/... path once ready
  previewUrl?: string; // local blob: URL shown while a file upload is in flight
  file?: File; // kept only for upload-sourced items, so "Retry" can resend without reprompting
  sourceUrl?: string; // kept only for pasted-link items, so "Retry" can refetch without reprompting
  status: "uploading" | "ready" | "error";
  error?: string;
  broken?: boolean; // client-side <img> failed to load (shouldn't happen once ready — safety net)
}

function makePhotoId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const CATEGORY_EXAMPLES: Record<
  Category,
  {
    brand: string;
    name: string;
    engineLabel: string;
    mileage: string;
    pricePerDay: string;
    pricePerHour: string;
    securityDeposit: string;
  }
> = {
  Scooty: {
    brand: "e.g. Honda",
    name: "e.g. Activa 6G",
    engineLabel: "e.g. 109cc or Electric Motor",
    mileage: "e.g. 45 km/l or 120 km/charge",
    pricePerDay: "349",
    pricePerHour: "70",
    securityDeposit: "1500",
  },
  Bike: {
    brand: "e.g. Royal Enfield",
    name: "e.g. Classic 350",
    engineLabel: "e.g. 349cc",
    mileage: "e.g. 35 km/l",
    pricePerDay: "799",
    pricePerHour: "150",
    securityDeposit: "3000",
  },
  Car: {
    brand: "e.g. Maruti Suzuki",
    name: "e.g. Swift",
    engineLabel: "e.g. 1.2L Petrol or 1.5L Diesel",
    mileage: "e.g. 20 km/l",
    pricePerDay: "1000",
    pricePerHour: "180",
    securityDeposit: "2500",
  },
};

const CATEGORY_STYLE: Record<Category, { icon: React.ElementType; bg: string; iconBg: string; text: string }> = {
  Scooty: { icon: CATEGORY_ICON.Scooty, bg: "bg-blue-50", iconBg: "bg-blue-100", text: "text-blue-600" },
  Bike: { icon: CATEGORY_ICON.Bike, bg: "bg-orange-50", iconBg: "bg-orange-100", text: "text-orange-600" },
  Car: { icon: CATEGORY_ICON.Car, bg: "bg-green-50", iconBg: "bg-green-100", text: "text-green-600" },
};

interface FormState {
  category: Category;
  name: string;
  brand: string;
  engineLabel: string;
  pricePerDay: string;
  pricePerHour: string;
  securityDeposit: string;
  stock: string;
  fuel: FuelType;
  transmission: Transmission;
  seats: string;
  mileage: string;
  features: string[];
  description: string;
  city: string;
}

function toFormState(v?: Vehicle, defaultCity?: string): FormState {
  if (!v) {
    return {
      category: "Scooty",
      name: "",
      brand: "",
      engineLabel: "",
      pricePerDay: "",
      pricePerHour: "",
      securityDeposit: "",
      stock: "1",
      fuel: "Petrol",
      transmission: "Automatic",
      seats: "2",
      mileage: "",
      features: [],
      description: "",
      city: defaultCity ?? "",
    };
  }
  return {
    category: v.category,
    name: v.name,
    brand: v.brand,
    engineLabel: v.engineLabel,
    pricePerDay: String(v.pricePerDay),
    pricePerHour: String(v.pricePerHour),
    securityDeposit: String(v.securityDeposit),
    stock: String(v.stock),
    fuel: v.specs.fuel,
    transmission: v.specs.transmission,
    seats: String(v.specs.seats),
    mileage: v.specs.mileage,
    features: v.features,
    description: v.description ?? "",
    city: v.city,
  };
}

export default function VehicleForm({ mode, vehicle }: { mode: "create" | "edit"; vehicle?: Vehicle }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { owner } = useOwner();

  const [form, setForm] = useState<FormState>(() => toFormState(vehicle, owner?.city));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "photos", string>>>({});
  const [featureInput, setFeatureInput] = useState("");
  const [photoMode, setPhotoMode] = useState<"upload" | "url">("upload");
  const [photoUrlDraft, setPhotoUrlDraft] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>(() => {
    const urls = vehicle?.photoUrls?.length ? vehicle.photoUrls : vehicle?.photoUrl ? [vehicle.photoUrl] : [];
    return urls.map((url) => ({ id: makePhotoId(), url, status: "ready" as const }));
  });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadingCount = photos.filter((p) => p.status === "uploading").length;
  const hasErrorPhoto = photos.some((p) => p.status === "error");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function uploadOne(id: string, file: File) {
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPhotos((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
          return { ...p, url: data.url, status: "ready", previewUrl: undefined };
        })
      );
    } catch (err) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "error", error: err instanceof Error ? err.message : "Upload failed" } : p
        )
      );
    }
  }

  function handleFilesSelected(fileList: FileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      showToast(`You can add up to ${MAX_PHOTOS} photos per vehicle.`, "error");
      return;
    }

    const accepted: File[] = [];
    for (const file of files) {
      if (accepted.length >= remaining) {
        showToast(`Only ${remaining} more photo${remaining > 1 ? "s" : ""} allowed — added the first ${remaining}.`, "error");
        break;
      }
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        showToast(`"${file.name}" isn't a JPG, PNG or WEBP image — skipped.`, "error");
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        showToast(`"${file.name}" is larger than 8MB — skipped.`, "error");
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) return;

    const newItems: PhotoItem[] = accepted.map((file) => ({
      id: makePhotoId(),
      url: "",
      previewUrl: URL.createObjectURL(file),
      file,
      status: "uploading",
    }));
    setPhotos((prev) => [...prev, ...newItems]);
    setErrors((e) => ({ ...e, photos: undefined }));
    newItems.forEach((item) => void uploadOne(item.id, item.file!));
  }

  async function processUrlPhoto(id: string, sourceUrl: string) {
    try {
      const res = await fetch("/api/upload/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't process that image link");
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, url: data.url, status: "ready" } : p)));
    } catch (err) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: "error", error: err instanceof Error ? err.message : "Couldn't process that image link" }
            : p
        )
      );
    }
  }

  function retryUpload(item: PhotoItem) {
    setPhotos((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "uploading", error: undefined } : p)));
    if (item.file) void uploadOne(item.id, item.file);
    else if (item.sourceUrl) void processUrlPhoto(item.id, item.sourceUrl);
  }

  function addPhotoUrl() {
    const trimmed = photoUrlDraft.trim();
    if (!trimmed) return;
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      showToast("Paste a direct image link starting with http:// or https://", "error");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      showToast(`You can add up to ${MAX_PHOTOS} photos per vehicle.`, "error");
      return;
    }
    if (photos.some((p) => p.sourceUrl === trimmed)) {
      showToast("That photo is already added.", "error");
      setPhotoUrlDraft("");
      return;
    }
    const id = makePhotoId();
    setPhotos((prev) => [...prev, { id, url: "", sourceUrl: trimmed, status: "uploading" }]);
    setPhotoUrlDraft("");
    setErrors((e) => ({ ...e, photos: undefined }));
    void processUrlPhoto(id, trimmed);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function movePhoto(id: string, direction: -1 | 1) {
    setPhotos((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const newIdx = idx + direction;
      if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }

  function markBroken(id: string) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, broken: true } : p)));
  }

  function addFeature(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (form.features.includes(trimmed)) {
      setFeatureInput("");
      return;
    }
    set("features", [...form.features, trimmed]);
    setFeatureInput("");
  }

  function removeFeature(value: string) {
    set("features", form.features.filter((f) => f !== value));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState | "photos", string>> = {};
    if (form.name.trim().length < 2) next.name = "Enter the model name";
    if (form.brand.trim().length < 2) next.brand = "Enter the brand";

    if (photos.length === 0) {
      next.photos = "Add at least one photo of the vehicle";
    } else if (photos.some((p) => p.status === "uploading")) {
      next.photos = "Wait for all photos to finish uploading";
    } else if (photos.some((p) => p.status === "error")) {
      next.photos = "Remove or retry the failed photo before saving";
    } else if (photos.some((p) => p.broken)) {
      next.photos =
        "One of your photo links doesn't load as an image — paste a direct image URL (usually ending in .jpg/.png/.webp), not a webpage link.";
    }

    const price = Number(form.pricePerDay);
    if (!Number.isFinite(price) || price < MIN_ONLINE_PAYMENT_RUPEES) {
      next.pricePerDay = `Enter a daily price of at least ₹${MIN_ONLINE_PAYMENT_RUPEES}`;
    }

    const hourly = Number(form.pricePerHour);
    if (!Number.isFinite(hourly) || hourly < MIN_ONLINE_PAYMENT_RUPEES) {
      next.pricePerHour = `Enter an hourly price of at least ₹${MIN_ONLINE_PAYMENT_RUPEES}`;
    }

    const deposit = Number(form.securityDeposit);
    if (!Number.isFinite(deposit) || deposit < 0) next.securityDeposit = "Enter a valid deposit amount";

    const stock = Number(form.stock);
    if (!Number.isFinite(stock) || stock < 1) next.stock = "Must have at least 1 unit";

    if (!form.mileage.trim()) next.mileage = "Enter mileage or range";
    if (!form.city) next.city = "Select the city this vehicle is listed in";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setSubmitting(true);
    const payload = {
      category: form.category,
      name: form.name.trim(),
      brand: form.brand.trim(),
      engineLabel: form.engineLabel.trim(),
      photoUrls: photos.map((p) => p.url),
      pricePerDay: Number(form.pricePerDay),
      pricePerHour: Number(form.pricePerHour),
      securityDeposit: Number(form.securityDeposit),
      stock: Number(form.stock),
      fuel: form.fuel,
      transmission: form.transmission,
      seats: Number(form.seats) || 2,
      mileage: form.mileage.trim(),
      features: form.features,
      description: form.description.trim() || null,
      city: form.city,
    };

    try {
      const res = await fetch(mode === "create" ? "/api/vehicles" : `/api/vehicles/${vehicle!.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      showToast(mode === "create" ? "Vehicle listed successfully!" : "Vehicle updated", "success");
      router.push("/vehicles");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const examples = CATEGORY_EXAMPLES[form.category];

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Category */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Vehicle type</h3>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {CATEGORIES.map((c) => {
            const style = CATEGORY_STYLE[c.key];
            const selected = form.category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => set("category", c.key)}
                className={`flex flex-col items-center gap-2.5 rounded-xl border p-4 text-sm font-700 transition ${
                  selected
                    ? "border-primary bg-secondary text-primary"
                    : "border-border text-foreground hover:border-primary/50"
                }`}
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                    selected ? "bg-primary text-white" : `${style.iconBg} ${style.text}`
                  }`}
                >
                  <style.icon size={22} />
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Basic details */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Basic details</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Brand</label>
            <input
              className="input-field"
              placeholder={examples.brand}
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
            />
            {errors.brand && <p className="field-error">{errors.brand}</p>}
          </div>
          <div>
            <label className="field-label">Model name</label>
            <input
              className="input-field"
              placeholder={examples.name}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div>
            <label className="field-label">
              Engine / motor label <span className="font-500 text-muted-foreground">(optional)</span>
            </label>
            <input
              className="input-field"
              placeholder={examples.engineLabel}
              value={form.engineLabel}
              onChange={(e) => set("engineLabel", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">City this vehicle is listed in</label>
            <select className="input-field" value={form.city} onChange={(e) => set("city", e.target.value)}>
              <option value="">Select city</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              {form.city && !CITIES.includes(form.city as (typeof CITIES)[number]) && (
                <option value={form.city}>{form.city}</option>
              )}
            </select>
            {errors.city && <p className="field-error">{errors.city}</p>}
          </div>
        </div>
      </section>

      {/* Photos */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Photos ({photos.length}/{MAX_PHOTOS})</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Add up to {MAX_PHOTOS} clear, well-lit photos — more angles build trust and get more
          bookings. The first photo is the cover image customers see first; use the arrows to reorder.
        </p>

        <div className="mt-3 inline-flex rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setPhotoMode("upload")}
            className={`rounded-lg px-4 py-1.5 text-xs font-700 transition ${
              photoMode === "upload" ? "bg-card text-primary shadow-card" : "text-muted-foreground"
            }`}
          >
            Upload Photo
          </button>
          <button
            type="button"
            onClick={() => setPhotoMode("url")}
            className={`rounded-lg px-4 py-1.5 text-xs font-700 transition ${
              photoMode === "url" ? "bg-card text-primary shadow-card" : "text-muted-foreground"
            }`}
          >
            Image URL
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFilesSelected(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <div
              key={p.id}
              className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted"
            >
              {p.previewUrl || (p.status === "uploading" && p.sourceUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element -- transient local/optimistic preview, next/image can't optimize either
                <img src={p.previewUrl ?? p.sourceUrl} alt="Processing preview" className="h-full w-full object-cover" />
              ) : p.url && !p.broken ? (
                <Image src={p.url} alt={`Vehicle photo ${i + 1}`} fill className="object-cover" onError={() => markBroken(p.id)} />
              ) : (
                <ImagePlus size={22} className="text-muted-foreground" />
              )}

              {i === 0 && p.status === "ready" && !p.broken && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-700 text-white">
                  <Star size={10} fill="currentColor" /> Cover
                </span>
              )}

              {p.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 size={20} className="animate-spin text-white" />
                </div>
              )}

              {p.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 px-3 text-center">
                  <p className="text-[11px] font-600 leading-tight text-white">{p.error ?? "Upload failed"}</p>
                  {p.sourceUrl && (
                    <p className="text-[10px] text-white/70">
                      Switch to <strong className="text-white">Upload Photo</strong> to use a file from your device.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => retryUpload(p)}
                    className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-700 text-foreground"
                  >
                    <RotateCcw size={11} /> Retry
                  </button>
                </div>
              )}

              {p.broken && p.status === "ready" && (
                <div className="absolute inset-x-0 bottom-0 bg-red-600/90 px-1.5 py-1 text-center text-[9px] font-600 text-white">
                  Not a valid image
                </div>
              )}

              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Remove photo"
              >
                <X size={13} />
              </button>

              {photos.length > 1 && p.status === "ready" && (
                <div className="absolute bottom-1.5 right-1.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => movePhoto(p.id, -1)}
                    disabled={i === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                    aria-label="Move photo earlier"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(p.id, 1)}
                    disabled={i === photos.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                    aria-label="Move photo later"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {photos.length < MAX_PHOTOS && photoMode === "upload" && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <ImagePlus size={22} />
              <span className="text-xs font-700">Add photos</span>
            </button>
          )}
        </div>

        {photoMode === "url" && photos.length < MAX_PHOTOS && (
          <div className="mt-3">
            <div className="flex gap-2">
              <input
                className="input-field"
                placeholder="https://example.com/bike.jpg"
                value={photoUrlDraft}
                onChange={(e) => setPhotoUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPhotoUrl();
                  }
                }}
              />
              <button type="button" onClick={addPhotoUrl} className="btn-outline whitespace-nowrap px-4 text-sm">
                Add
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Paste a direct link to a JPG, PNG or WEBP image. We&apos;ll fetch and
              optimize it automatically — any size is accepted.
            </p>
          </div>
        )}

        {errors.photos && <p className="field-error">{errors.photos}</p>}
      </section>

      {/* Pricing */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Pricing &amp; availability</h3>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="field-label">Price / day (₹)</label>
            <input
              type="number"
              min={0}
              className="input-field"
              placeholder={examples.pricePerDay}
              value={form.pricePerDay}
              onChange={(e) => set("pricePerDay", e.target.value)}
            />
            {errors.pricePerDay && <p className="field-error">{errors.pricePerDay}</p>}
          </div>
          <div>
            <label className="field-label">Price / hour (₹)</label>
            <input
              type="number"
              min={0}
              className="input-field"
              placeholder={examples.pricePerHour}
              value={form.pricePerHour}
              onChange={(e) => set("pricePerHour", e.target.value)}
            />
            {errors.pricePerHour && <p className="field-error">{errors.pricePerHour}</p>}
          </div>
          <div>
            <label className="field-label">Security deposit (₹)</label>
            <input
              type="number"
              min={0}
              className="input-field"
              placeholder={examples.securityDeposit}
              value={form.securityDeposit}
              onChange={(e) => set("securityDeposit", e.target.value)}
            />
            {errors.securityDeposit && <p className="field-error">{errors.securityDeposit}</p>}
          </div>
          <div>
            <label className="field-label">Units in stock</label>
            <input
              type="number"
              min={1}
              className="input-field"
              value={form.stock}
              onChange={(e) => set("stock", e.target.value)}
            />
            {errors.stock && <p className="field-error">{errors.stock}</p>}
          </div>
        </div>
      </section>

      {/* Specs */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Specifications</h3>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="field-label">Fuel type</label>
            <select className="input-field" value={form.fuel} onChange={(e) => set("fuel", e.target.value as FuelType)}>
              {FUEL_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Transmission</label>
            <select
              className="input-field"
              value={form.transmission}
              onChange={(e) => set("transmission", e.target.value as Transmission)}
            >
              {TRANSMISSION_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {form.category === "Car" && (
            <div>
              <label className="field-label">Seats</label>
              <input
                type="number"
                min={2}
                max={9}
                className="input-field"
                value={form.seats}
                onChange={(e) => set("seats", e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="field-label">Mileage / range</label>
            <input
              className="input-field"
              placeholder={examples.mileage}
              value={form.mileage}
              onChange={(e) => set("mileage", e.target.value)}
            />
            {errors.mileage && <p className="field-error">{errors.mileage}</p>}
          </div>
        </div>
      </section>

      {/* Features & description */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-800 text-foreground">Features</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {form.features.map((f) => (
            <span
              key={f}
              className="flex max-w-full items-center gap-1.5 break-words rounded-full bg-secondary px-3 py-1.5 text-xs font-600 text-primary"
            >
              {f}
              <button type="button" onClick={() => removeFeature(f)} aria-label={`Remove ${f}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input-field"
            placeholder="Type a feature and press Enter"
            value={featureInput}
            onChange={(e) => setFeatureInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFeature(featureInput);
              }
            }}
          />
          <button type="button" onClick={() => addFeature(featureInput)} className="btn-outline whitespace-nowrap px-4 text-sm">
            Add
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FEATURE_SUGGESTIONS[form.category]
            .filter((s) => !form.features.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addFeature(s)}
                className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-600 text-muted-foreground hover:border-primary hover:text-primary"
              >
                + {s}
              </button>
            ))}
        </div>

        <div className="mt-5">
          <label className="field-label">
            Description <span className="font-500 text-muted-foreground">(optional)</span>
          </label>
          <textarea
            rows={3}
            className="input-field resize-none"
            placeholder="Anything customers should know — condition, extra charges, usage rules, etc."
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
      </section>

      {serverError && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-600 text-red-600">{serverError}</div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => router.back()} className="btn-outline w-full px-5 py-2.5 text-sm sm:w-auto">
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || uploadingCount > 0 || hasErrorPhoto}
          className="btn-primary w-full px-6 py-2.5 text-sm sm:w-auto"
        >
          {submitting ? "Saving…" : mode === "create" ? "List vehicle" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
