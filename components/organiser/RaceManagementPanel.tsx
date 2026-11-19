"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Upload, Download,
  RefreshCw, CheckCircle2, Circle, Bell,
  SlidersHorizontal, FileSpreadsheet, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import FormSelect from "@/components/ui/FormSelect";
import {
  Skeleton, CardListSkeleton,
} from "@/components/ui/skeleton";
import { nextAvailableBib } from "@/lib/bib-assignment";
import { assignAthletesToWaves, unassignedReason, type WaveDef } from "@/lib/wave-assignment";
import { parseFinishToMinutes, formatFinishMinutes, calcAgeFromIsoDate } from "@/lib/registration-form";
import { isValidRaceTime, normaliseRaceTime } from "@/lib/race-results";
import { REFUND_PROCESS_COPY } from "@/lib/refund-policy";
import WaveAllocationBoard from "@/components/organiser/WaveAllocationBoard";
import WaveResultsBoard from "@/components/organiser/WaveResultsBoard";
import ResultsImportDialog from "@/components/organiser/ResultsImportDialog";
import WaveBuilderDialog from "@/components/organiser/WaveBuilderDialog";
import {
  DEFAULT_EXPORT_COLUMN_KEYS,
  EXPORT_COLUMNS,
  type ExportColumnKey,
} from "@/lib/registration-export";

import { useApiResource } from "@/hooks/useApiResource";
import ExportMenu from "@/components/organiser/race-management/ExportMenu";
import type { PageData, Registration, StartWave } from "@/components/organiser/race-management/types";

const STATUS_STYLE: Record<Registration["status"], string> = {
  CONFIRMED:        "bg-primary/10 text-primary border-primary/30",
  REFUND_REQUESTED: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  REFUNDED:         "bg-red-400/10 text-red-300 border-red-400/20",
  CANCELLED:        "bg-white/5 text-muted border-dark-lighter",
};

const STATUS_LABEL: Record<Registration["status"], string> = {
  CONFIRMED:        "Confirmed",
  REFUND_REQUESTED: "Refund requested",
  REFUNDED:         "Refunded",
  CANCELLED:        "Cancelled",
};

/** Race-day console: waves, results, refunds. Embedded on the event dashboard. */
export default function RaceManagementPanel({ eventId }: { eventId: string }) {
  const id = eventId;

  const [editReg, setEditReg] = useState<Registration | null>(null);
  const [editWave, setEditWave] = useState("");
  const [editBib, setEditBib] = useState("");
  const [editStatus, setEditStatus] = useState<Registration["status"]>("CONFIRMED");
  const [editFinish, setEditFinish] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [manageOpen, setManageOpen] = useState(false);
  const [builderWaves, setBuilderWaves] = useState<WaveDef[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");

  const [editingResult, setEditingResult] = useState<Registration | null>(null);
  const [resultTime, setResultTime] = useState("");
  const [resultPlacement, setResultPlacement] = useState("");
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifySaving, setNotifySaving] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState("");

  // Splits the page into before-race setup (waves, bibs) and after-race results.
  const [activeTab, setActiveTab] = useState<"setup" | "results" | "refunds">("setup");

  const fetchRegistrations = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(`/api/organiser/events/${id}/registrations`, { signal });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Failed to load");
    return json as PageData;
  }, [id]);

  const {
    data,
    loading,
    error,
    reload: load,
    setData,
  } = useApiResource<PageData>(fetchRegistrations, { key: id });

  // Optimistically move athletes between waves, rolling back if the server rejects.
  // Organisers do this under time pressure on flaky venue wifi, so the UI must feel
  // instant and recover cleanly on failure.
  const moveAthletes = useCallback(
    async (ids: string[], destWaveId: string | null) => {
      const destLabel = destWaveId
        ? data?.event.startWaves.find((w) => w.id === destWaveId)?.label ?? null
        : null;
      const snapshot = data;
      setData((d) =>
        d
          ? {
              ...d,
              registrations: d.registrations.map((r) =>
                ids.includes(r.id) ? { ...r, waveId: destWaveId, wave: destLabel } : r,
              ),
            }
          : d,
      );
      try {
        const res = await fetch(`/api/organiser/events/${id}/registrations/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationIds: ids, destWaveId }),
        });
        const json = await res.json();
        if (!res.ok) {
          setData(snapshot);
          return { ok: false as const, error: json.error ?? "Move failed." };
        }
        return { ok: true as const, overCapacity: json.destWave?.overCapacity ?? false };
      } catch {
        setData(snapshot);
        return { ok: false as const, error: "Move failed. Check your connection." };
      }
    },
    [data, id, setData],
  );

  // Live preview of how the builder's waves would place confirmed athletes.
  const assignPreview = useMemo(() => {
    if (!data) return null;
    const candidates = data.registrations
      .filter((r) => r.status === "CONFIRMED")
      .map((r) => ({
        id: r.id,
        name: r.name,
        estimatedFinishMinutes: r.estimatedFinishMinutes,
        age: r.dateOfBirth ? calcAgeFromIsoDate(r.dateOfBirth) : null,
        gender: r.gender,
      }));
    const { perWave, unassignedIds } = assignAthletesToWaves({ candidates, waves: builderWaves });
    return { perWave, unassigned: unassignedIds.length, total: candidates.length };
  }, [data, builderWaves]);

  const openEdit = (r: Registration) => {
    setEditReg(r);
    setEditWave(r.wave ?? "");
    setEditBib(r.bibNumber ?? "");
    setEditStatus(r.status);
    setEditFinish(formatFinishMinutes(r.estimatedFinishMinutes));
    setEditError("");
  };

  // Lowest unused bib on the event; one obvious action, no guessing.
  const editNextBib = useMemo(() => {
    if (!data || !editReg) return null;
    return nextAvailableBib({
      taken: data.registrations.map((r) => r.bibNumber).filter(Boolean) as string[],
      start: 1,
    });
  }, [data, editReg]);

  const saveEdit = async () => {
    if (!editReg) return;
    // A finish time we can't read would silently save as "unknown" and quietly
    // drop the athlete out of pace-based wave sorting. Say so instead.
    if (editFinish.trim() && parseFinishToMinutes(editFinish) === null) {
      setEditError('Estimated finish time must look like 0:45 or 3:30, or a number of minutes.');
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      const res = await fetch(`/api/organiser/events/${id}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrations: [{
            registrationId: editReg.id,
            startWaveLabel: editWave || null,
            bibNumber: editBib.trim() || null,
            status: editStatus,
            estimatedFinishMinutes: parseFinishToMinutes(editFinish),
          }],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const base = json.error ?? "Save failed.";
        const takenMatch = typeof base === "string" && base.match(/^Bib (.+) is already assigned\.?$/i);
        if (takenMatch && data) {
          const suggested = nextAvailableBib({
            taken: data.registrations.map((r) => r.bibNumber).filter(Boolean) as string[],
            start: parseInt(takenMatch[1], 10) || 1,
          });
          setEditError(`${base} Next free from there is #${suggested}.`);
        } else {
          setEditError(base);
        }
        return;
      }
      // The board groups by waveId, so the label alone is not enough — without
      // this the athlete stays visibly in their old wave until a page refresh.
      const nextWaveId = editWave
        ? data?.event.startWaves.find((w) => w.label === editWave)?.id ?? null
        : null;
      setData((d) => d ? {
        ...d,
        registrations: d.registrations.map((r) =>
          r.id === editReg.id
            ? {
                ...r,
                waveId: nextWaveId,
                wave: editWave || null,
                bibNumber: editBib.trim() || null,
                status: editStatus,
                estimatedFinishMinutes: parseFinishToMinutes(editFinish),
              }
            : r
        ),
      } : d);
      setEditReg(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const openResultEditor = (reg: Registration) => {
    setEditingResult(reg);
    setResultTime(reg.resultTime ?? "");
    setResultPlacement(reg.resultPlacement ?? "");
    setResultError("");
  };

  const saveResult = async () => {
    if (!editingResult) return;
    // Results publish straight to the athlete's public profile, so an unreadable
    // time must never get that far.
    const trimmedTime = resultTime.trim();
    if (trimmedTime && !isValidRaceTime(trimmedTime)) {
      setResultError("Finish time must look like 41:05 or 1:08:22.");
      return;
    }
    setSavingResult(true);
    setResultError("");
    try {
      const res = await fetch(`/api/organiser/events/${id}/results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: [{
            registrationId: editingResult.id,
            resultTime: trimmedTime || null,
            resultPlacement: resultPlacement.trim() || null,
          }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setResultError(json?.error ?? "Could not save this result.");
        return;
      }
      if (json?.invalidTimes?.length) {
        setResultError("Finish time must look like 41:05 or 1:08:22.");
        return;
      }
      const savedTime = trimmedTime ? normaliseRaceTime(trimmedTime) : null;
      setData((d) => d ? {
        ...d,
        registrations: d.registrations.map((r) =>
          r.id === editingResult.id
            ? {
                ...r,
                resultTime: savedTime,
                resultPlacement: resultPlacement.trim() || null,
              }
            : r
        ),
      } : d);
      setEditingResult(null);
    } catch {
      setResultError("Could not save this result. Check your connection.");
    } finally {
      setSavingResult(false);
    }
  };

  const openManageWaves = () => {
    setAssignMsg("");
    // Deep copy so edits in the builder don't mutate the loaded data.
    setBuilderWaves((data?.event.startWaves ?? []).map((w) => ({ ...w, genders: [...(w.genders ?? [])] })));
    setManageOpen(true);
  };

  // Persist the wave definitions, then sort confirmed athletes into them.
  const saveAndAssign = async () => {
    if (!data) return;
    setAssignSaving(true);
    setAssignMsg("");
    try {
      const saveRes = await fetch(`/api/organiser/events/${id}/waves`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startWaves: builderWaves }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) { setAssignMsg(saveJson.error ?? "Could not save waves."); return; }

      const candidates = data.registrations
        .filter((r) => r.status === "CONFIRMED")
        .map((r) => ({
          id: r.id,
          name: r.name,
          estimatedFinishMinutes: r.estimatedFinishMinutes,
          age: r.dateOfBirth ? calcAgeFromIsoDate(r.dateOfBirth) : null,
          gender: r.gender,
        }));
      const { assignments } = assignAthletesToWaves({ candidates, waves: builderWaves });
      const desired = new Map(assignments.map((a) => [a.registrationId, a.waveLabel]));
      // Include athletes who no longer match any wave (cleared to null).
      const rows = candidates
        .map((c) => ({ registrationId: c.id, startWaveLabel: desired.get(c.id) ?? null }))
        .filter((row) => (data.registrations.find((r) => r.id === row.registrationId)?.wave ?? null) !== row.startWaveLabel);

      if (rows.length === 0) {
        setAssignMsg("Waves saved. Everyone is already in the right wave.");
        load();
        setManageOpen(false);
        return;
      }
      const res = await fetch(`/api/organiser/events/${id}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrations: rows }),
      });
      const json = await res.json();
      if (!res.ok) { setAssignMsg(json.error ?? "Could not assign waves."); return; }
      setAssignMsg(`Waves saved and ${json.updated} athlete${json.updated === 1 ? "" : "s"} sorted. Notify them from the header when ready.`);
      load();
      setManageOpen(false);
    } finally {
      setAssignSaving(false);
    }
  };

  const runNotifyWaves = async () => {
    setNotifySaving(true);
    setNotifyMsg("");
    try {
      const res = await fetch(`/api/organiser/events/${id}/waves/notify`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setNotifyMsg(json.error ?? "Could not send notifications.");
        return;
      }
      if (json.notified === 0) {
        setNotifyMsg("Everyone is already up to date. Nothing to send.");
      } else {
        setNotifyMsg(`Notified ${json.notified} athlete${json.notified === 1 ? "" : "s"}.`);
      }
      load();
    } finally {
      setNotifySaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-1 border-b border-white/5 mb-2 pb-px">
          <Skeleton className="h-10 w-24 rounded-t" />
          <Skeleton className="h-10 w-24 rounded-t opacity-60" />
          <Skeleton className="h-10 w-20 rounded-t opacity-60" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
        <div className="bg-dark border border-dark-lighter rounded-2xl p-4 sm:p-5 space-y-3">
          <Skeleton className="h-11 w-full rounded-lg" />
          <CardListSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-dark-lighter bg-dark px-6 py-12 text-center">
        <p className="font-headline text-lg font-bold text-light mb-1">{error || "Not found"}</p>
        <p className="text-[13px] text-muted">Could not load race management.</p>
      </div>
    );
  }

  const { event, registrations } = data;
  const confirmed = registrations.filter((r) => r.status === "CONFIRMED");
  const confirmedCount = confirmed.length;
  const wavesConfigured = event.startWaves.length > 0;
  const withWave = confirmed.filter((r) => r.wave).length;
  const withBib = confirmed.filter((r) => r.bibNumber).length;
  const withResults = confirmed.filter((r) => r.resultTime || r.resultPlacement).length;
  const wavesDone = !wavesConfigured || withWave === confirmedCount;
  const bibsDone = confirmedCount > 0 && withBib === confirmedCount;
  // Athletes with a wave that differs from what they were last told about.
  const pendingNotify = confirmed.filter((r) => r.wave && r.wave !== r.waveNotified).length;
  const allSet = confirmedCount > 0 && wavesDone && bibsDone && pendingNotify === 0;

  // Athletes who asked for a refund (pending) or have been refunded (done). These
  // sit outside wave assignment; the organiser only views them, admins action them.
  const refundsList = registrations
    .filter((r) => r.status === "REFUND_REQUESTED" || r.status === "REFUNDED")
    .sort((a, b) => Number(a.status !== "REFUND_REQUESTED") - Number(b.status !== "REFUND_REQUESTED"));
  const refundPending = registrations.filter((r) => r.status === "REFUND_REQUESTED").length;

  const openNotify = () => { setNotifyMsg(""); setNotifyOpen(true); };

  return (
    <div>
        <div className="flex items-center gap-1 border-b border-white/5 mb-4">
          {([
            { id: "setup", label: "Before race" },
            { id: "results", label: "After race" },
            { id: "refunds", label: "Refunds" },
          ] as const).map((t) => {
            const on = activeTab === t.id;
            const badge = t.id === "refunds" ? refundPending : 0;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`relative -mb-px px-4 py-3 border-b-2 font-headline text-[12px] font-bold uppercase tracking-widest transition-colors ${
                  on ? "border-primary text-primary" : "border-transparent text-muted hover:text-light"
                }`}
              >
                {t.label}
                {badge > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black align-middle">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab-scoped progress + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="min-h-[20px]">
            {activeTab === "setup" && confirmedCount > 0 && (
              allSet ? (
                <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                  Ready for race day
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    {!wavesConfigured || !wavesDone ? (
                      <Circle className="w-3.5 h-3.5 text-muted-dark shrink-0" strokeWidth={2.2} />
                    ) : null}
                    Waves{" "}
                    <span className="text-light">
                      {!wavesConfigured ? "none" : `${withWave}/${confirmedCount}`}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {!bibsDone ? (
                      <Circle className="w-3.5 h-3.5 text-muted-dark shrink-0" strokeWidth={2.2} />
                    ) : null}
                    Bibs{" "}
                    <span className="text-light">{`${withBib}/${confirmedCount}`}</span>
                  </span>
                </div>
              )
            )}
            {activeTab === "results" && confirmedCount > 0 && (
              <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                Results{" "}
                <span className="text-light">{withResults}/{confirmedCount}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeTab === "setup" && (
              <>
                {pendingNotify > 0 && (
                  <Button variant="outline" onClick={openNotify}>
                    <Bell className="w-4 h-4" /> Notify athletes
                    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black">
                      {pendingNotify}
                    </span>
                  </Button>
                )}
                <Button variant="outline" onClick={openManageWaves}>
                  <SlidersHorizontal className="w-4 h-4" /> Manage waves
                </Button>
              </>
            )}
            {activeTab === "results" && (
              <Button
                onClick={() => { setImportMessage(""); setImportOpen(true); }}
                className="shadow-machined"
              >
                <Upload className="w-4 h-4" /> Import results
              </Button>
            )}
            <ExportMenu eventId={id} />
          </div>
        </div>

        {activeTab === "results" && importMessage && (
          <p className="flex items-center gap-2 text-[13px] text-primary mb-4">
            <CheckCircle2 className="w-4 h-4" /> {importMessage}
          </p>
        )}

        {activeTab === "setup" && assignMsg && !manageOpen && (
          <p className="text-[13px] text-muted-light mb-4">{assignMsg}</p>
        )}

        {activeTab === "setup" && (
          <Card className="mb-6">
            <CardContent className="p-4 sm:p-5">
              <WaveAllocationBoard
                waves={event.startWaves.map((w) => ({
                  id: w.id,
                  label: w.label,
                  startTime: w.startTime,
                  capacity: w.capacity,
                  finishMin: w.finishMin,
                  finishMax: w.finishMax,
                  genders: w.genders,
                  ageMin: w.ageMin,
                  ageMax: w.ageMax,
                }))}
                athletes={confirmed.map((r) => {
                  const age = r.dateOfBirth ? calcAgeFromIsoDate(r.dateOfBirth) : null;
                  const finishLabel = formatFinishMinutes(r.estimatedFinishMinutes) || null;
                  const candidate = {
                    id: r.id,
                    name: r.name,
                    estimatedFinishMinutes: r.estimatedFinishMinutes,
                    age,
                    gender: r.gender,
                  };
                  return {
                    id: r.id,
                    name: r.name,
                    email: r.email,
                    waveId: r.waveId,
                    bibNumber: r.bibNumber,
                    medicalNotes: r.medicalNotes,
                    checkedInAt: r.checkedInAt,
                    finishLabel,
                    gender: r.gender,
                    age,
                    unassignedReason: r.waveId
                      ? null
                      : unassignedReason(candidate, event.startWaves),
                  };
                })}
                onEdit={(aid) => { const reg = registrations.find((r) => r.id === aid); if (reg) openEdit(reg); }}
                onMove={moveAthletes}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === "results" && (
          <Card className="mb-6">
            <CardContent className="p-4 sm:p-5">
              <WaveResultsBoard
                waves={event.startWaves.map((w) => ({
                  id: w.id,
                  label: w.label,
                  startTime: w.startTime,
                  finishMin: w.finishMin,
                  finishMax: w.finishMax,
                  genders: w.genders,
                  ageMin: w.ageMin,
                  ageMax: w.ageMax,
                }))}
                athletes={confirmed.map((r) => ({
                  id: r.id,
                  name: r.name,
                  email: r.email,
                  waveId: r.waveId,
                  bibNumber: r.bibNumber,
                  category: r.category,
                  resultTime: r.resultTime,
                  resultPlacement: r.resultPlacement,
                }))}
                onEditResult={(aid) => {
                  const reg = registrations.find((r) => r.id === aid);
                  if (reg) openResultEditor(reg);
                }}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === "refunds" && (
          <>
            <Card className="mb-6">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-1.5">
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.5} /> Refund requests
                </div>
                <p className="text-[13px] text-muted leading-relaxed max-w-[600px]">
                  Athletes who asked for a refund. They come out of wave assignment automatically and free up
                  their spot. Refund due is worked out from your event&apos;s policy at the moment they asked,
                  and is fixed from then on. {REFUND_PROCESS_COPY} This list is for your visibility.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0 sm:p-2">
                {refundsList.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <p className="font-headline text-sm font-bold uppercase tracking-widest text-muted mb-1">
                      No refund requests
                    </p>
                    <p className="text-[13px] text-muted-dark">Nothing to review right now.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse">
                      <thead>
                        <tr className="border-b border-white/5">
                          {["Athlete", "Was in wave", "Paid", "Refund due", "Requested", "Status"].map((h) => (
                            <th key={h} className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted-dark text-left px-3 py-3">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {refundsList.map((r) => (
                          <tr key={r.id} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-3">
                              <div className="font-headline text-[14px] font-bold text-white/90 truncate max-w-[220px]">{r.name}</div>
                              <div className="text-[12px] text-muted-dark truncate max-w-[240px]">{r.email}</div>
                            </td>
                            <td className="px-3 py-3 font-headline text-[12px] text-muted-light">{r.wave ?? "-"}</td>
                            <td className="px-3 py-3 font-headline text-[13px] font-black italic text-white whitespace-nowrap">
                              ${r.amount.toFixed(2)}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <span className="font-headline text-[13px] font-black italic text-white">
                                ${((r.refundAmountCents ?? 0) / 100).toFixed(2)}
                              </span>
                              {r.refundPercent != null && !r.refundOutsidePolicy && (
                                <span className="font-headline text-[11px] text-muted-dark ml-1.5">{r.refundPercent}%</span>
                              )}
                              {r.refundOutsidePolicy && (
                                <div className="font-headline text-[10px] uppercase tracking-widest text-amber-300 mt-0.5">
                                  Outside policy
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 font-headline text-[12px] text-muted-light whitespace-nowrap">
                              {r.refundRequestedAt
                                ? new Date(r.refundRequestedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
                                : "-"}
                            </td>
                            <td className="px-3 py-3">
                              <Badge className={`border ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

      {/* Edit athlete */}
      <Dialog open={!!editReg} onOpenChange={(open) => { if (!open) setEditReg(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit: {editReg?.name}</DialogTitle>
            <DialogDescription>
              Update wave, bib number, or registration status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label htmlFor="edit-wave" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                Start wave
              </label>
              <FormSelect
                id="edit-wave"
                value={editWave}
                onChange={setEditWave}
                options={[
                  { value: "", label: "No wave" },
                  ...event.startWaves.map((w) => ({
                    value: w.label,
                    label: w.startTime ? `${w.label} · ${w.startTime}` : w.label,
                  })),
                ]}
              />
            </div>
            <div>
              <label htmlFor="edit-bib" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                Bib number
              </label>
              <input
                id="edit-bib"
                value={editBib}
                onChange={(e) => setEditBib(e.target.value)}
                placeholder="e.g. 42"
                className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
              />
              {editNextBib && editBib.trim() !== editNextBib && (
                <button
                  type="button"
                  onClick={() => setEditBib(editNextBib)}
                  className="mt-2 font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                >
                  Assign next free bib (#{editNextBib})
                </button>
              )}
            </div>
            <div>
              <label htmlFor="edit-finish" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                Estimated finish time
              </label>
              <input
                id="edit-finish"
                value={editFinish}
                onChange={(e) => setEditFinish(e.target.value)}
                placeholder="e.g. 0:45 or 3:30"
                className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
              />
              <p className="text-[12px] text-muted-dark mt-1.5">Used to seed start waves by pace. Leave blank if unknown.</p>
            </div>
            <div>
              <label htmlFor="edit-status" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                Status
              </label>
              <FormSelect
                id="edit-status"
                value={editStatus}
                onChange={(v) => setEditStatus(v as Registration["status"])}
                options={[
                  { value: "CONFIRMED", label: "Confirmed" },
                  { value: "REFUND_REQUESTED", label: "Refund requested" },
                  { value: "REFUNDED", label: "Refunded" },
                  { value: "CANCELLED", label: "Cancelled" },
                ]}
              />
            </div>
            {editError && (
              <p className="text-[13px] text-red-300">{editError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditReg(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result editor */}
      <Dialog open={!!editingResult} onOpenChange={(open) => { if (!open) setEditingResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Race result: {editingResult?.name}</DialogTitle>
            <DialogDescription>
              Recorded results appear on this athlete&apos;s public profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">Division</div>
              <div className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-muted-light">
                {editingResult?.category?.trim() || "No division on registration"}
              </div>
            </div>
            <div>
              <label htmlFor="result-time" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">Time</label>
              <input
                id="result-time"
                value={resultTime}
                onChange={(e) => setResultTime(e.target.value)}
                placeholder="e.g. 41:05"
                className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="result-placement" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">Placement</label>
              <input
                id="result-placement"
                value={resultPlacement}
                onChange={(e) => setResultPlacement(e.target.value)}
                placeholder="e.g. 8th / 512"
                className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
              />
            </div>
            {resultError && <p className="text-[13px] text-red-300">{resultError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingResult(null)}>Cancel</Button>
            <Button onClick={saveResult} disabled={savingResult}>
              {savingResult ? "Saving…" : "Save result"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {importOpen && (
        <ResultsImportDialog
          eventId={id}
          registrations={registrations}
          onClose={() => setImportOpen(false)}
          onImported={(count) => {
            setImportOpen(false);
            setImportMessage(`Updated ${count} result${count === 1 ? "" : "s"}.`);
            load({ silent: true });
          }}
        />
      )}

      {/* Notify athletes of wave */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Let athletes know their wave</DialogTitle>
            <DialogDescription>
              Sends each athlete their wave and start time, by app notification and email. Only people whose
              wave changed since you last told them are messaged, so no one gets spammed by small edits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {pendingNotify > 0 ? (
              <p className="flex items-center gap-2 text-[13px] text-light bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5">
                <Bell className="w-4 h-4 text-primary shrink-0" />
                <span>
                  <strong className="font-semibold text-primary">{pendingNotify} athlete{pendingNotify === 1 ? "" : "s"}</strong>{" "}
                  {pendingNotify === 1 ? "has" : "have"} a new or changed wave and will be notified.
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-2 text-[13px] text-muted-light bg-dark border border-dark-lighter rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                Everyone is up to date. There&apos;s nothing new to send right now.
              </p>
            )}
            {notifyMsg && <p className="text-[13px] text-muted-light">{notifyMsg}</p>}
          </div>
          <DialogFooter>
            {pendingNotify === 0 ? (
              <Button onClick={() => setNotifyOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setNotifyOpen(false)}>Cancel</Button>
                <Button onClick={runNotifyWaves} disabled={notifySaving} className="shadow-machined">
                  {notifySaving
                    ? "Sending…"
                    : `Notify ${pendingNotify} athlete${pendingNotify === 1 ? "" : "s"}`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WaveBuilderDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        waves={builderWaves}
        onWavesChange={setBuilderWaves}
        preview={assignPreview}
        message={assignMsg}
        saving={assignSaving}
        onSave={saveAndAssign}
      />
    </div>
  );
}
