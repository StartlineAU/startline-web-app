"use client";

import { useCallback, useMemo, useState } from "react";
import {
  RefreshCw, Circle, Hash,
  SlidersHorizontal,
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
import { holdsTeamPlace } from "@/lib/team-tickets";
import { assignAthletesToWaves, unassignedReason, type WaveDef } from "@/lib/wave-assignment";
import { parseFinishToMinutes, formatFinishMinutes, calcAgeFromIsoDate } from "@/lib/registration-form";
import {
  normalisePlacement, ordinal, placementNumber, raceTimeFromParts, raceTimeParts, type RaceTimeParts,
} from "@/lib/race-results";
import { REFUND_PROCESS_COPY } from "@/lib/refund-policy";
import { isFreeEvent } from "@/lib/event-types";
import WaveAllocationBoard from "@/components/organiser/WaveAllocationBoard";
import WaveResultsBoard from "@/components/organiser/WaveResultsBoard";
import WaveBuilderDialog from "@/components/organiser/WaveBuilderDialog";
import type { ExportColumnKey } from "@/lib/registration-export";
import { organiserSeesBibs, organiserSeesWaves, raceDayReady, type RaceFeatures } from "@/lib/race-features";
import RaceFeatureControls from "@/components/organiser/race-management/RaceFeatureControls";
import SimpleRoster from "@/components/organiser/race-management/SimpleRoster";
import AssignBibsDialog from "@/components/organiser/race-management/AssignBibsDialog";

import { useApiResource } from "@/hooks/useApiResource";
import ExportMenu from "@/components/organiser/race-management/ExportMenu";
import RemoveAthleteDialog, { type RemovalOutcome } from "@/components/organiser/race-management/RemoveAthleteDialog";
import { InfoTip } from "@/components/event/event-form/info-tip";
import type { PageData, Registration, StartWave } from "@/components/organiser/race-management/types";

const STATUS_STYLE: Record<Registration["status"], string> = {
  CONFIRMED:        "bg-primary/10 text-primary border-primary/30",
  REFUND_REQUESTED: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  REFUNDED:         "bg-red-400/10 text-red-300 border-red-400/20",
  CANCELLED:        "bg-white/5 text-muted border-dark-lighter",
  REMOVED:          "bg-red-400/10 text-red-300 border-red-400/20",
};

/** Sentinel option in the division picker that reveals a "new division" field. */
const ADD_DIVISION = "__add_division__";

const STATUS_LABEL: Record<Registration["status"], string> = {
  CONFIRMED:        "Confirmed",
  REFUND_REQUESTED: "Refund requested",
  REFUNDED:         "Refunded",
  CANCELLED:        "Cancelled",
  REMOVED:          "Removed",
};

/** Race-day console: waves, results, refunds. Embedded on the event dashboard. */
export default function RaceManagementPanel({
  eventId,
  finished = false,
  initialTab,
}: {
  eventId: string;
  /** The event has ended: open on results and drop the pre-race nudges. */
  finished?: boolean;
  /** Which tab opens first. Defaults to After race once the event has finished. */
  initialTab?: "setup" | "results" | "refunds";
}) {
  const id = eventId;

  const [editReg, setEditReg] = useState<Registration | null>(null);
  const [editWave, setEditWave] = useState("");
  const [editBib, setEditBib] = useState("");
  const [editStatus, setEditStatus] = useState<Registration["status"]>("CONFIRMED");
  const [editFinish, setEditFinish] = useState("");
  // Team entries: rename the team, or swap the member being edited.
  const [editTeamName, setEditTeamName] = useState("");
  const [swapOpen, setSwapOpen] = useState(false);
  const [swap, setSwap] = useState({
    firstName: "", lastName: "", email: "", dateOfBirth: "", gender: "",
    mobile: "", emergencyContactName: "", emergencyContactPhone: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  // Remove from event (#571).
  const [removeReg, setRemoveReg] = useState<Registration | null>(null);
  const [removeMsg, setRemoveMsg] = useState("");

  const [manageOpen, setManageOpen] = useState(false);
  const [builderWaves, setBuilderWaves] = useState<WaveDef[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");
  const [assignBibsOpen, setAssignBibsOpen] = useState(false);
  // Bumped on each open so the dialog remounts with fresh inputs.
  const [assignBibsKey, setAssignBibsKey] = useState(0);

  const [editingResult, setEditingResult] = useState<Registration | null>(null);
  const [resultTime, setResultTime] = useState<RaceTimeParts>({ hours: 0, minutes: 0, seconds: 0 });
  // Digits only: the ordinal ("st", "nd", "rd", "th") is added for the athlete.
  const [resultPlacement, setResultPlacement] = useState("");
  // The athlete's division, or ADD_DIVISION while typing a new one in.
  const [resultDivision, setResultDivision] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const [savingResult, setSavingResult] = useState(false);
  const [resultError, setResultError] = useState("");


  // Splits the page into before-race setup (waves, bibs) and after-race results.
  const [activeTab, setActiveTab] = useState<"setup" | "results" | "refunds">(initialTab ?? (finished ? "results" : "setup"));

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
      // A team starts together, and the server moves every member still
      // holding a place, so the board moves them all too rather than showing
      // the team split until the next reload.
      const movingTeams = new Set(
        (data?.registrations ?? []).filter((r) => ids.includes(r.id) && r.team).map((r) => r.team!.id),
      );
      const moves = (r: Registration) =>
        ids.includes(r.id) || (!!r.team && movingTeams.has(r.team.id) && holdsTeamPlace(r.status));
      setData((d) =>
        d
          ? {
              ...d,
              registrations: d.registrations.map((r) =>
                moves(r) ? { ...r, waveId: destWaveId, wave: destLabel } : r,
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
    setEditTeamName(r.team?.name ?? "");
    setSwapOpen(false);
    setSwap({
      firstName: "", lastName: "", email: "", dateOfBirth: "", gender: "",
      mobile: "", emergencyContactName: "", emergencyContactPhone: "",
    });
  };

  // Lowest unused bib on the event; one obvious action, no guessing.
  const editNextBib = useMemo(() => {
    if (!data || !editReg || !organiserSeesBibs(data.event)) return null;
    return nextAvailableBib({
      taken: data.registrations.map((r) => r.bibNumber).filter(Boolean) as string[],
      start: 1,
    });
  }, [data, editReg]);

  const saveEdit = async () => {
    if (!editReg || !data) return;
    const wavesOn = organiserSeesWaves(data.event);
    const bibsOn = organiserSeesBibs(data.event);
    // A finish time we can't read would silently save as "unknown" and quietly
    // drop the athlete out of pace-based wave sorting. Say so instead.
    if (editFinish.trim() && parseFinishToMinutes(editFinish) === null) {
      setEditError('Estimated finish time must look like 0:45 or 3:30, or a number of minutes.');
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      if (editReg.team) {
        const renamed = editTeamName.trim() && editTeamName.trim() !== editReg.team.name;
        if (renamed || swapOpen) {
          const teamRes = await fetch(`/api/organiser/events/${id}/teams/${editReg.team.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(renamed ? { name: editTeamName.trim() } : {}),
              ...(swapOpen ? { member: { registrationId: editReg.id, ...swap } } : {}),
            }),
          });
          const teamJson = await teamRes.json().catch(() => ({}));
          if (!teamRes.ok) {
            setEditError(teamJson.error ?? "Could not update the team.");
            return;
          }
        }
      }
      const res = await fetch(`/api/organiser/events/${id}/registrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // A feature that is turned off is left out: the server refuses writes to it.
          registrations: [{
            registrationId: editReg.id,
            ...(wavesOn ? { startWaveLabel: editWave || null } : {}),
            ...(bibsOn ? { bibNumber: editBib.trim() || null } : {}),
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
      const teamId = editReg.team?.id ?? null;
      const teamName = editTeamName.trim() || editReg.team?.name || "";
      if (swapOpen) {
        // A swap changes who the entry is for; reload rather than guess.
        setEditReg(null);
        load();
        return;
      }
      setData((d) => d ? {
        ...d,
        registrations: d.registrations.map((r) => {
          if (r.id === editReg.id) {
            return {
              ...r,
              ...(wavesOn ? { waveId: nextWaveId, wave: editWave || null } : {}),
              ...(bibsOn ? { bibNumber: editBib.trim() || null } : {}),
              status: editStatus,
              estimatedFinishMinutes: parseFinishToMinutes(editFinish),
              team: r.team ? { ...r.team, name: teamName } : r.team,
            };
          }
          // Teammates still holding a place share the team's start wave; every
          // member shows the team's bib and name.
          if (teamId && r.team?.id === teamId) {
            return {
              ...r,
              ...(wavesOn && holdsTeamPlace(r.status) ? { waveId: nextWaveId, wave: editWave || null } : {}),
              ...(bibsOn ? { bibNumber: editBib.trim() || null } : {}),
              team: { ...r.team, name: teamName },
            };
          }
          return r;
        }),
      } : d);
      setEditReg(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const onRemoved = (registrationId: string, outcome: RemovalOutcome) => {
    const removed = data?.registrations.find((r) => r.id === registrationId);
    setRemoveReg(null);
    setEditReg(null);
    if (outcome.replacedBy) {
      // The entry now belongs to the replacement: reload rather than guess.
      setRemoveMsg(`${removed?.name ?? "The athlete"} was removed and emailed. ${outcome.replacedBy} now holds their place.`);
      load();
      return;
    }
    setData((d) => d ? {
      ...d,
      registrations: d.registrations.map((r) =>
        r.id === registrationId
          ? { ...r, status: "REMOVED" as const, bibNumber: r.team ? r.bibNumber : null, waveId: null, wave: null }
          : r,
      ),
    } : d);
    const parts = [`${removed?.name ?? "The athlete"} was removed and emailed.`];
    if (outcome.refundCents > 0) parts.push(`A refund of $${(outcome.refundCents / 100).toFixed(2)} is on its way to them.`);
    if (outcome.blocked) parts.push("They are blocked from your future events.");
    if (outcome.warning) parts.push(outcome.warning);
    setRemoveMsg(parts.join(" "));
  };

  const openResultEditor = (reg: Registration) => {
    setEditingResult(reg);
    setResultTime(raceTimeParts(reg.resultTime));
    const place = placementNumber(reg.resultPlacement);
    setResultPlacement(place ? String(place) : "");
    setResultDivision(reg.category?.trim() ?? "");
    setNewDivision("");
    setResultError("");
  };

  const saveResult = async () => {
    if (!editingResult) return;
    // Built from the dropdowns, so it is always a readable time (or none at 0:00:00).
    const timeValue = raceTimeFromParts(resultTime);
    const placementValue = normalisePlacement(resultPlacement);
    const addingDivision = resultDivision === ADD_DIVISION;
    if (addingDivision && !newDivision.trim()) {
      setResultError("Name the new division, or pick one from the list.");
      return;
    }
    const divisionValue = addingDivision ? newDivision.trim() : resultDivision || null;
    setSavingResult(true);
    setResultError("");
    try {
      const res = await fetch(`/api/organiser/events/${id}/results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: [{
            registrationId: editingResult.id,
            resultTime: timeValue,
            resultPlacement: placementValue,
            division: divisionValue,
          }],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setResultError(json?.error ?? "Could not save this result.");
        return;
      }
      // A team shares one result; the server wrote it to every member still
      // holding a place. The division stays with the row it was set on.
      const resultTeamId = editingResult.team?.id ?? null;
      const sharesResult = (r: Registration) =>
        r.id === editingResult.id ||
        (!!resultTeamId && r.team?.id === resultTeamId && holdsTeamPlace(r.status));
      setData((d) => d ? {
        ...d,
        // The server answers with the event's divisions, including one just added.
        event: Array.isArray(json?.divisions) ? { ...d.event, divisions: json.divisions } : d.event,
        registrations: d.registrations.map((r) =>
          sharesResult(r)
            ? {
                ...r,
                category: divisionValue,
                resultTime: timeValue,
                resultPlacement: placementValue,
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
      const desired = new Map<string, string | null>(assignments.map((a) => [a.registrationId, a.waveLabel]));
      // A team starts together, in the wave its captain (or first member) sorted into.
      const leadOfTeam = new Map<string, string>();
      for (const r of data.registrations) {
        if (!r.team || r.status !== "CONFIRMED") continue;
        if (r.team.captain || !leadOfTeam.has(r.team.id)) leadOfTeam.set(r.team.id, r.id);
      }
      for (const r of data.registrations) {
        if (!r.team) continue;
        const lead = leadOfTeam.get(r.team.id);
        if (lead && lead !== r.id) desired.set(r.id, desired.get(lead) ?? null);
      }
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
      setAssignMsg(`Waves saved and ${json.updated} athlete${json.updated === 1 ? "" : "s"} sorted.`);
      load();
      setManageOpen(false);
    } finally {
      setAssignSaving(false);
    }
  };

  // Turn waves or bibs on, share them, or turn them off (#566).
  const updateModes = async (next: Partial<RaceFeatures>): Promise<string | null> => {
    try {
      const res = await fetch(`/api/organiser/events/${id}/race-features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return json?.error ?? "Could not save that change.";
      setData((d) => d ? { ...d, event: { ...d.event, waveMode: json.waveMode, bibMode: json.bibMode } } : d);
      setAssignMsg("");
      return null;
    } catch {
      return "Could not save that change. Check your connection.";
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
  const wavesOn = organiserSeesWaves(event);
  const bibsOn = organiserSeesBibs(event);
  // Waves and bibs that are turned off are hidden, not deleted, so blank them
  // here and every board below behaves as if they were never set.
  const startWaves = wavesOn ? event.startWaves : [];
  // Members still holding a place, per team. A team with fewer than its size
  // (someone cancelled or was refunded) is flagged on its badge, so the
  // organiser can swap someone in or settle the rest of the team.
  const heldByTeam = new Map<string, number>();
  for (const r of registrations) {
    if (r.team && holdsTeamPlace(r.status)) heldByTeam.set(r.team.id, (heldByTeam.get(r.team.id) ?? 0) + 1);
  }
  // A team place the buyer has not named yet shows as "Team member 2 ·
  // details pending"; its email is the buyer's until then.
  const displayName = (r: Registration) => (r.detailsPending ? `${r.name} · details pending` : r.name);
  const teamLabel = (r: Registration): string | null => {
    if (!r.team) return null;
    const held = heldByTeam.get(r.team.id) ?? 0;
    return held < r.team.size ? `${r.team.name} · ${held}/${r.team.size}` : r.team.name;
  };
  const confirmed = registrations
    .filter((r) => r.status === "CONFIRMED")
    .map((r) => ({
      ...r,
      waveId: wavesOn ? r.waveId : null,
      wave: wavesOn ? r.wave : null,
      bibNumber: bibsOn ? r.bibNumber : null,
    }));
  const confirmedCount = confirmed.length;
  const wavesConfigured = startWaves.length > 0;
  const withWave = confirmed.filter((r) => r.wave).length;
  const withBib = confirmed.filter((r) => r.bibNumber).length;
  const withResults = confirmed.filter((r) => r.resultTime || r.resultPlacement).length;
  const wavesDone = wavesConfigured && withWave === confirmedCount;
  const bibsDone = withBib === confirmedCount;
  const allSet = raceDayReady(event, {
    total: confirmedCount,
    withWave,
    withBib,
    wavesConfigured: startWaves.length,
  });
  const nextFreeBib = Number(nextAvailableBib({
    taken: registrations.map((r) => r.bibNumber).filter(Boolean) as string[],
  }));
  // The event's divisions, plus the athlete's current one if the event doesn't
  // list it (entries start with their ticket name), plus "add a division".
  const currentDivision = editingResult?.category?.trim() || "";
  const divisionOptions = [
    { value: "", label: "No division" },
    ...event.divisions.map((d) => ({ value: d, label: d })),
    ...(currentDivision && !event.divisions.some((d) => d.toLowerCase() === currentDivision.toLowerCase())
      ? [{ value: currentDivision, label: `${currentDivision} (not an event division)` }]
      : []),
    { value: ADD_DIVISION, label: "+ Add a division" },
  ];
  const hiddenExportColumns: ExportColumnKey[] = [
    ...(bibsOn ? [] : (["bib"] as const)),
    ...(wavesOn ? [] : (["startWave", "waveStart"] as const)),
  ];

  // Athletes who asked for a refund (pending) or have been refunded (done). These
  // sit outside wave assignment; the organiser only views them, admins action them.
  const refundsList = registrations
    .filter((r) => r.status === "REFUND_REQUESTED" || r.status === "REFUNDED")
    .sort((a, b) => Number(a.status !== "REFUND_REQUESTED") - Number(b.status !== "REFUND_REQUESTED"));
  const refundPending = registrations.filter((r) => r.status === "REFUND_REQUESTED").length;
  // A free event takes no money, so there is nothing to refund. The tab still
  // shows if refund records exist (the event was paid before it went free), so
  // they never become unreachable.
  const showRefunds = !isFreeEvent(event.waves) || refundsList.length > 0;
  const tab = activeTab === "refunds" && !showRefunds ? "setup" : activeTab;

  // The list's actions sit beside its search field. Import results and Export
  // are off the After race tab until #565.
  const setupActions = (
    <>
      {wavesOn && (
        <Button variant="outline" onClick={openManageWaves}>
          <SlidersHorizontal className="w-4 h-4" /> Manage waves
        </Button>
      )}
      {bibsOn && (
        <Button variant="outline" onClick={() => { setAssignMsg(""); setAssignBibsKey((k) => k + 1); setAssignBibsOpen(true); }} disabled={confirmedCount === 0}>
          <Hash className="w-4 h-4" /> Assign bibs
        </Button>
      )}
      <ExportMenu eventId={id} hiddenColumns={hiddenExportColumns} />
    </>
  );

  return (
    <div>
        <div className="flex items-center gap-1 border-b border-white/5 mb-4">
          {([
            { id: "setup", label: "Before race" },
            { id: "results", label: "After race" },
            ...(showRefunds ? [{ id: "refunds" as const, label: "Refunds" }] : []),
          ] as const).map((t) => {
            const on = tab === t.id;
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

        {tab === "setup" && (
          <RaceFeatureControls modes={{ waveMode: event.waveMode, bibMode: event.bibMode }} onChange={updateModes} />
        )}

        {/* Progress only exists for features that are on; a plain list has none. */}
        {tab === "setup" && confirmedCount > 0 && (wavesOn || bibsOn) && (
          <div className="mb-3 min-h-[20px]">
            {allSet ? (
              <p className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                Ready for race day
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                {wavesOn && (
                  <span className="inline-flex items-center gap-1.5">
                    {!wavesDone ? (
                      <Circle className="w-3.5 h-3.5 text-muted-dark shrink-0" strokeWidth={2.2} />
                    ) : null}
                    Waves{" "}
                    <span className="text-light">
                      {!wavesConfigured ? "none" : `${withWave}/${confirmedCount}`}
                    </span>
                  </span>
                )}
                {bibsOn && (
                  <span className="inline-flex items-center gap-1.5">
                    {!bibsDone ? (
                      <Circle className="w-3.5 h-3.5 text-muted-dark shrink-0" strokeWidth={2.2} />
                    ) : null}
                    Bibs{" "}
                    <span className="text-light">{`${withBib}/${confirmedCount}`}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {removeMsg && (
          <p className="text-[13px] text-muted-light mb-4" role="status" data-testid="remove-message">{removeMsg}</p>
        )}

        {tab === "results" && confirmedCount > 0 && (
          <p className="mb-4 font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
            Results{" "}
            <span className="text-light">{withResults}/{confirmedCount}</span>
          </p>
        )}

        {tab === "setup" && assignMsg && !manageOpen && (
          <p className="text-[13px] text-muted-light mb-4">{assignMsg}</p>
        )}

        {tab === "setup" && !wavesOn && (
          <Card className="mb-6">
            <CardContent className="p-4 sm:p-5">
              <SimpleRoster
                actions={setupActions}
                athletes={confirmed.map((r) => ({
                  id: r.id,
                  name: r.name,
                  email: r.email,
                  tier: r.tier,
                  bibNumber: r.bibNumber,
                  medicalNotes: r.medicalNotes,
                  checkedInAt: r.checkedInAt,
                  teamName: teamLabel(r),
                }))}
                showBibs={bibsOn}
                onEdit={(aid) => { const reg = registrations.find((r) => r.id === aid); if (reg) openEdit(reg); }}
                onRemove={(aid) => { const reg = registrations.find((r) => r.id === aid); if (reg) setRemoveReg(reg); }}
              />
            </CardContent>
          </Card>
        )}

        {tab === "setup" && wavesOn && (
          <Card className="mb-6">
            <CardContent className="p-4 sm:p-5">
              <WaveAllocationBoard
                actions={setupActions}
                showBibs={bibsOn}
                waves={startWaves.map((w) => ({
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
                    name: displayName(r),
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
                      : unassignedReason(candidate, startWaves),
                    teamName: teamLabel(r),
                  };
                })}
                onEdit={(aid) => { const reg = registrations.find((r) => r.id === aid); if (reg) openEdit(reg); }}
                onRemove={(aid) => { const reg = registrations.find((r) => r.id === aid); if (reg) setRemoveReg(reg); }}
                onMove={moveAthletes}
              />
            </CardContent>
          </Card>
        )}

        {tab === "results" && (
          <Card className="mb-6">
            <CardContent className="p-4 sm:p-5">
              <WaveResultsBoard
                showBibs={bibsOn}
                waves={startWaves.map((w) => ({
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
                  name: displayName(r),
                  email: r.email,
                  waveId: r.waveId,
                  bibNumber: r.bibNumber,
                  category: r.category,
                  resultTime: r.resultTime,
                  resultPlacement: r.resultPlacement,
                  teamName: teamLabel(r),
                }))}
                onEditResult={(aid) => {
                  const reg = registrations.find((r) => r.id === aid);
                  if (reg) openResultEditor(reg);
                }}
              />
            </CardContent>
          </Card>
        )}

        {tab === "refunds" && (
          <>
            <Card className="mb-6">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-2 font-headline text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-1.5">
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.5} /> Refund requests
                </div>
                <p className="text-[13px] text-muted leading-relaxed max-w-[600px]">
                  Athletes who asked for a refund.{" "}
                  {wavesOn ? "They come out of wave assignment automatically and free up their spot." : "Their spot is freed automatically."} Refund due is worked out from your event&apos;s policy at the moment they asked,
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
                          {["Athlete", wavesOn ? "Was in wave" : "Ticket", "Paid", "Refund due", "Requested", "Status"].map((h) => (
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
                            <td className="px-3 py-3 font-headline text-[12px] text-muted-light">{(wavesOn ? r.wave : r.tier) ?? "-"}</td>
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
              {[
                wavesOn && bibsOn ? "Update wave, bib number or estimated finish."
                  : wavesOn ? "Update wave or estimated finish."
                  : bibsOn ? "Update bib number."
                  : "Check this entry's status.",
                editReg?.team && (wavesOn || bibsOn)
                  ? `${wavesOn && bibsOn ? "Wave and bib apply" : wavesOn ? "The wave applies" : "The bib applies"} to the whole team.`
                  : "",
              ].filter(Boolean).join(" ")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editReg?.team && (
              <div className="rounded-lg border border-dark-lighter p-3 space-y-3" data-testid="edit-team">
                <div>
                  <label htmlFor="edit-team-name" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                    Team name · {editReg.team.size} people{editReg.team.captain ? " · Captain" : ""}
                    {(heldByTeam.get(editReg.team.id) ?? 0) < editReg.team.size && (
                      <span className="text-amber-300"> · {heldByTeam.get(editReg.team.id) ?? 0} still entered</span>
                    )}
                  </label>
                  <input
                    id="edit-team-name"
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                    className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
                  />
                </div>
                {!holdsTeamPlace(editReg.status) ? (
                  <p className="text-[12px] text-muted-dark">
                    This place was cancelled or refunded, so it cannot be handed to someone else.
                  </p>
                ) : !swapOpen ? (
                  <button
                    type="button"
                    onClick={() => setSwapOpen(true)}
                    className="font-headline text-[11px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                  >
                    {editReg.detailsPending ? `Add the member for ${editReg.name}` : `Swap ${editReg.name} for someone else`}
                  </button>
                ) : (
                  <div className="space-y-2" data-testid="swap-member">
                    <p className="text-[12px] text-muted-dark">
                      The new member takes over this place, its payment and the team&apos;s bib and wave.
                    </p>
                    {([
                      ["firstName", "First name", "text"],
                      ["lastName", "Last name", "text"],
                      ["email", "Email", "email"],
                      ["dateOfBirth", "Date of birth", "date"],
                      ["mobile", "Mobile", "tel"],
                      ["emergencyContactName", "Emergency contact name", "text"],
                      ["emergencyContactPhone", "Emergency contact phone", "tel"],
                    ] as const).map(([field, label, type]) => (
                      <div key={field}>
                        <label htmlFor={`swap-${field}`} className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1">
                          {label}
                        </label>
                        <input
                          id={`swap-${field}`}
                          type={type}
                          value={swap[field]}
                          onChange={(e) => setSwap((prev) => ({ ...prev, [field]: e.target.value }))}
                          className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSwapOpen(false)}
                      className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary transition-colors"
                    >
                      Keep {editReg.name}
                    </button>
                  </div>
                )}
              </div>
            )}
            {wavesOn && (
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
            )}
            {bibsOn && (
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
            )}
            {wavesOn && (
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
            )}
            <div>
              <label htmlFor="edit-status" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">
                Status
              </label>
              {editReg?.statusEditable && editReg.status === "CANCELLED" ? (
                // A cancelled free entry can be put back, capacity permitting.
                // Taking someone out is Remove from event, never a status (#571).
                <FormSelect
                  id="edit-status"
                  value={editStatus}
                  onChange={(v) => setEditStatus(v as Registration["status"])}
                  options={[
                    { value: "CANCELLED", label: "Cancelled" },
                    { value: "CONFIRMED", label: "Confirmed (reinstate)" },
                  ]}
                />
              ) : (
                <>
                  <p id="edit-status" className="text-[14px] text-light">{STATUS_LABEL[editStatus]}</p>
                  <p className="text-[12px] text-muted-dark mt-1.5">
                    {editReg && holdsTeamPlace(editReg.status)
                      ? "To take this athlete out of the event, use Remove from event below."
                      : "This entry no longer holds a place."}
                  </p>
                </>
              )}
            </div>
            {editError && (
              <p className="text-[13px] text-red-300">{editError}</p>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            {editReg && holdsTeamPlace(editReg.status) ? (
              <Button variant="destructive" onClick={() => setRemoveReg(editReg)}>
                Remove from event
              </Button>
            ) : <span />}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="ghost" onClick={() => setEditReg(null)}>Cancel</Button>
              <Button onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RemoveAthleteDialog
        eventId={id}
        registration={removeReg}
        onClose={() => setRemoveReg(null)}
        onRemoved={onRemoved}
      />

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
              <div className="flex items-center gap-1.5 mb-1.5">
                <span id="result-division-label" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted">Division</span>
                <InfoTip label="Division">
                  <p>
                    The race or group an athlete is placed in, such as 10K or Women 40-49. Placements are
                    usually counted within a division.
                  </p>
                  <p className="mt-2">
                    Athletes don&apos;t choose one when they register yet, so an entry starts with its ticket
                    name (like General). Pick the right one here, or add a division this event is missing.
                  </p>
                </InfoTip>
              </div>
              <FormSelect
                id="result-division"
                aria-label="Division"
                value={resultDivision}
                onChange={setResultDivision}
                options={divisionOptions}
              />
              {resultDivision === ADD_DIVISION && (
                <input
                  aria-label="New division name"
                  autoFocus
                  value={newDivision}
                  onChange={(e) => setNewDivision(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Half Marathon or Women 40-49"
                  className="mt-2 w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
                />
              )}
              {resultDivision === ADD_DIVISION && (
                <p className="text-[12px] text-muted-dark mt-1.5">Added to this event&apos;s divisions and kept in its change history.</p>
              )}
            </div>
            <fieldset>
              <legend className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">Time</legend>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "hours", label: "Hours", max: 99 },
                  { key: "minutes", label: "Minutes", max: 59 },
                  { key: "seconds", label: "Seconds", max: 59 },
                ] as const).map((unit) => (
                  <div key={unit.key}>
                    <FormSelect
                      aria-label={unit.label}
                      value={String(resultTime[unit.key])}
                      onChange={(v) => setResultTime((t) => ({ ...t, [unit.key]: Number(v) }))}
                      options={Array.from({ length: unit.max + 1 }, (_, n) => ({
                        value: String(n),
                        label: unit.key === "hours" ? String(n) : String(n).padStart(2, "0"),
                      }))}
                    />
                    <span className="block mt-1 font-headline text-[10px] uppercase tracking-widest text-muted-dark">{unit.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-muted-dark mt-1.5">Leave all three at 0 for no time.</p>
            </fieldset>
            <div>
              <label htmlFor="result-placement" className="font-headline text-[10px] font-bold uppercase tracking-widest text-muted block mb-1.5">Placement</label>
              <div className="flex items-center gap-3">
                <input
                  id="result-placement"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={resultPlacement}
                  onChange={(e) => setResultPlacement(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 8"
                  className="w-32 bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[14px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
                />
                {Number(resultPlacement) >= 1 && (
                  <span className="font-headline text-[13px] font-bold text-muted-light" aria-live="polite">
                    Shows as {ordinal(Number(resultPlacement))}
                  </span>
                )}
              </div>
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

      <AssignBibsDialog
        key={assignBibsKey}
        eventId={id}
        open={assignBibsOpen}
        onOpenChange={setAssignBibsOpen}
        defaultStart={nextFreeBib}
        wavesOn={wavesOn}
        onAssigned={(count) => {
          setAssignMsg(`Bibs assigned to ${count} athlete${count === 1 ? "" : "s"}.`);
          load();
        }}
      />

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
