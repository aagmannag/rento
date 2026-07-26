"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Car,
  CheckCircle2,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  XCircle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { LocationPickResult } from "@/components/LocationPicker";
import type { ShopOwnerDetail } from "@/lib/types";

// Leaflet touches `window` as soon as its module loads, which breaks Next's server-side
// render pass — ssr:false keeps the whole map (and its import) out of that pass entirely.
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

// Approximate city centers used only for the map's initial view before a pin exists and
// forward-geocoding the typed address didn't turn up a suggestion either.
const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Lucknow: { lat: 26.8467, lng: 80.9462 },
  Indore: { lat: 22.7196, lng: 75.8577 },
  Goa: { lat: 15.2993, lng: 74.124 },
  Haridwar: { lat: 29.9457, lng: 78.1642 },
  Rishikesh: { lat: 30.0869, lng: 78.2676 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
};
const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };

/** Best-effort forward geocode of the owner's typed address, used only to give the admin
 *  a starting pin to verify/adjust rather than a blank map — never saved until the admin
 *  explicitly confirms it via "Save location". */
async function forwardGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

type DialogKind = "approve" | "reject" | "suspend" | "reinstate" | null;

export default function ShopOwnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [owner, setOwner] = useState<ShopOwnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);

  // The map pin currently shown — may differ from owner.latitude/longitude while the
  // admin is reviewing an auto-suggested or manually-picked-but-unsaved position.
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [pickedAddress, setPickedAddress] = useState<string | null>(null);
  const [locationNote, setLocationNote] = useState("");
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [savingLocation, setSavingLocation] = useState(false);
  const suggestionRequestedFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/shop-owners/${id}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data: { owner: ShopOwnerDetail } = await res.json();
    setOwner(data.owner);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handlePick = useCallback((result: LocationPickResult) => {
    setPinLat(result.lat);
    setPinLng(result.lng);
    setPickedAddress(result.address ?? null);
    setLocationNote("");
  }, []);

  // Once the owner has loaded, seed the pin from whatever's already saved — or, if
  // nothing's saved yet, try forward-geocoding the typed address once per owner so the
  // admin starts from a real suggestion instead of a blank map. Never auto-saves.
  useEffect(() => {
    if (!owner) return;
    if (owner.latitude != null && owner.longitude != null) {
      setPinLat(owner.latitude);
      setPinLng(owner.longitude);
      setPickedAddress(null);
      setRecenterSignal((s) => s + 1);
      return;
    }
    if (suggestionRequestedFor.current === owner.id) return;
    suggestionRequestedFor.current = owner.id;
    void (async () => {
      const suggestion = await forwardGeocode(`${owner.address}, ${owner.city}`);
      if (suggestion) {
        handlePick({ lat: suggestion.lat, lng: suggestion.lng });
        setRecenterSignal((s) => s + 1);
      }
    })();
  }, [owner, handlePick]);

  async function handleSaveLocation() {
    if (pinLat == null || pinLng == null) return;
    setSavingLocation(true);
    try {
      const res = await fetch(`/api/shop-owners/${id}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: pinLat, longitude: pinLng }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save location");
      setOwner(data.owner);
      showToast("Pickup location saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save location", "error");
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleClearLocation() {
    setSavingLocation(true);
    try {
      const res = await fetch(`/api/shop-owners/${id}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear location");
      setOwner(data.owner);
      setPinLat(null);
      setPinLng(null);
      setPickedAddress(null);
      showToast("Pin removed — showing the geocoded address instead", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to clear location", "error");
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleAction(kind: Exclude<DialogKind, null>, reason?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/shop-owners/${id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "reject" ? JSON.stringify({ reason }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      const labels: Record<string, string> = {
        approve: "Shop owner approved — their vehicles are now visible to customers.",
        reject: "Application rejected.",
        suspend: "Shop owner suspended — their vehicles are now hidden from customers.",
        reinstate: "Shop owner reinstated — their vehicles are visible again.",
      };
      showToast(labels[kind], "success");
      setDialog(null);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (notFound || !owner) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">This shop owner couldn&apos;t be found.</p>
        <Link href="/shop-owners" className="btn-primary mt-4 inline-block px-5 py-2.5 text-sm">
          Back to Shop Owners
        </Link>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/shop-owners")}
        className="mb-4 flex items-center gap-1.5 text-sm font-600 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Back to Shop Owners
      </button>

      <PageHeader
        title={owner.shopName}
        subtitle={`Applied ${formatDate(owner.createdAt)}`}
        action={<StatusBadge status={owner.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="text-sm font-800 text-foreground">Registration details</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Owner name" value={owner.ownerName} />
              <Field label="Shop / business name" value={owner.shopName} />
              <Field label="Email" value={owner.email} icon={Mail} />
              <Field label="Phone" value={owner.phone} icon={Phone} />
              <Field label="City" value={owner.city} />
              <Field label="Pincode" value={owner.pincode ?? "—"} />
            </div>
            <div className="mt-4">
              <p className="field-label">Pickup location</p>
              <p className="flex items-start gap-1.5 text-sm text-foreground">
                <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                {owner.address}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Shop owners only provide this typed address — marking the exact pickup
                point on the map below is an admin-only step. Click the map or drag the
                pin, verify it matches a real, findable location, then save.
              </p>

              <div className="mt-3">
                <LocationPicker
                  lat={pinLat}
                  lng={pinLng}
                  centerFallback={CITY_CENTERS[owner.city] ?? INDIA_CENTER}
                  recenterSignal={recenterSignal}
                  onPick={handlePick}
                  onGeocodeError={setLocationNote}
                />
              </div>

              {pickedAddress && (
                <p className="mt-1.5 break-words text-[11px] text-muted-foreground">
                  Pin resolves to: {pickedAddress}
                </p>
              )}
              {locationNote && <p className="mt-1.5 break-words text-xs font-600 text-amber-700">{locationNote}</p>}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {(pinLat !== owner.latitude || pinLng !== owner.longitude) && pinLat != null && pinLng != null ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveLocation}
                      disabled={savingLocation}
                      className="btn-primary px-4 py-2 text-xs"
                    >
                      {savingLocation ? "Saving…" : "Save this location"}
                    </button>
                    <span className="text-[11px] font-600 text-amber-700">Not yet saved</span>
                  </>
                ) : pinLat != null && pinLng != null ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 text-[11px] font-700 text-green-700">
                    <CheckCircle2 size={12} /> Precise location saved
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    No pin yet — click the map to mark the pickup point.
                  </span>
                )}
                {pinLat != null && pinLng != null && (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    disabled={savingLocation}
                    className="px-2 py-1.5 text-[11px] font-700 text-red-600 hover:underline"
                  >
                    Clear pin
                  </button>
                )}
              </div>
            </div>

            {owner.status === "Rejected" && owner.rejectionReason && (
              <div className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                <span className="font-700">Rejection reason: </span>
                {owner.rejectionReason}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-800 text-foreground">Listed vehicles ({owner.vehicles.length})</h3>
            </div>

            {owner.vehicles.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">This shop hasn&apos;t listed any vehicles yet.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {owner.vehicles.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                      {v.photoUrl && <Image src={v.photoUrl} alt={v.name} fill className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-700 text-foreground">{v.brand} {v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.category} · ₹{v.pricePerDay}/day · {v.stock} units</p>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Actions come first in source order so they're reachable without scrolling
           *  past Activity/vehicle-list content on mobile, where this column stacks
           *  below the main content instead of sitting beside it. */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="text-sm font-800 text-foreground">Actions</h3>
            <div className="mt-4 space-y-2">
              {owner.status === "Pending" && (
                <>
                  <button onClick={() => setDialog("approve")} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm">
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button
                    onClick={() => setDialog("reject")}
                    className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-red-200 py-2.5 text-sm font-600 text-red-600 transition hover:bg-red-50"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </>
              )}
              {owner.status === "Approved" && (
                <button
                  onClick={() => setDialog("suspend")}
                  className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-red-200 py-2.5 text-sm font-600 text-red-600 transition hover:bg-red-50"
                >
                  <Ban size={16} /> Suspend Shop
                </button>
              )}
              {owner.status === "Rejected" && (
                <button onClick={() => setDialog("approve")} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm">
                  <CheckCircle2 size={16} /> Approve Anyway
                </button>
              )}
              {owner.status === "Suspended" && (
                <button onClick={() => setDialog("reinstate")} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm">
                  <RotateCcw size={16} /> Reinstate
                </button>
              )}
              {owner.status === "Approved" && (
                <p className="pt-1 text-center text-[11px] text-muted-foreground">
                  This shop&apos;s vehicles are currently visible to customers.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="text-sm font-800 text-foreground">Activity</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-muted px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-xs font-600 text-muted-foreground">
                  <Car size={14} /> Vehicles listed
                </span>
                <span className="text-sm font-800 text-foreground">{owner.vehicles.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-xs font-600 text-muted-foreground">
                  <CheckCircle2 size={14} /> Total bookings
                </span>
                <span className="text-sm font-800 text-foreground">{owner.totalBookings}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-xs font-600 text-muted-foreground">
                  <IndianRupee size={14} /> Earnings (completed)
                </span>
                <span className="text-sm font-800 text-foreground">₹{owner.totalEarnings.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "approve"}
        title="Approve this shop owner?"
        description={`${owner.shopName}'s vehicles will immediately become visible to customers.`}
        confirmLabel="Approve"
        busy={busy}
        onConfirm={() => handleAction("approve")}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "reject"}
        title="Reject this application?"
        description="The owner will see this reason and can update their details to resubmit."
        confirmLabel="Reject"
        danger
        busy={busy}
        requireReason
        reasonLabel="Reason for rejection"
        reasonPlaceholder="e.g. Pickup address looks incomplete — please add a landmark."
        onConfirm={(reason) => handleAction("reject", reason)}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "suspend"}
        title="Suspend this shop?"
        description={`${owner.shopName}'s vehicles will be immediately hidden from customers until reinstated.`}
        confirmLabel="Suspend"
        danger
        busy={busy}
        onConfirm={() => handleAction("suspend")}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "reinstate"}
        title="Reinstate this shop?"
        description={`${owner.shopName}'s vehicles will become visible to customers again.`}
        confirmLabel="Reinstate"
        busy={busy}
        onConfirm={() => handleAction("reinstate")}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div>
      <p className="field-label">{label}</p>
      <p className="flex items-center gap-1.5 break-words text-sm text-foreground">
        {Icon && <Icon size={14} className="shrink-0 text-muted-foreground" />}
        {value}
      </p>
    </div>
  );
}
