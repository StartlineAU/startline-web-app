"use client";

import { AlertCircle, Bell, CheckCircle2, Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import FormSelect from "@/components/ui/FormSelect";
import type { Dispatch, SetStateAction } from "react";
import type { WaveDef } from "@/lib/wave-assignment";
import type { Registration, StartWave } from "./types";

const GENDER_CHOICES = ["Male", "Female", "Non-binary", "Other"];

interface RaceDialogEvent {
  startWaves: StartWave[];
}

interface EditDialogs {
  editReg: Registration | null;
  setEditReg: Dispatch<SetStateAction<Registration | null>>;
  editWave: string;
  setEditWave: Dispatch<SetStateAction<string>>;
  editBib: string;
  setEditBib: Dispatch<SetStateAction<string>>;
  editNextBib: string | null;
  editStatus: Registration["status"];
  setEditStatus: Dispatch<SetStateAction<Registration["status"]>>;
  editFinish: string;
  setEditFinish: Dispatch<SetStateAction<string>>;
  savingEdit: boolean;
  editError: string;
  saveEdit: () => void;
}

interface ResultDialogs {
  editingResult: Registration | null;
  setEditingResult: Dispatch<SetStateAction<Registration | null>>;
  resultTime: string;
  setResultTime: Dispatch<SetStateAction<string>>;
  resultPlacement: string;
  setResultPlacement: Dispatch<SetStateAction<string>>;
  savingResult: boolean;
  resultError: string;
  saveResult: () => void;
}

interface CsvDialogs {
  csvOpen: boolean;
  setCsvOpen: Dispatch<SetStateAction<boolean>>;
  csvText: string;
  setCsvText: Dispatch<SetStateAction<string>>;
  csvUploading: boolean;
  csvMessage: string;
  uploadCsv: () => void;
}

interface NotifyDialogs {
  notifyOpen: boolean;
  setNotifyOpen: Dispatch<SetStateAction<boolean>>;
  notifySaving: boolean;
  notifyMsg: string;
  pendingNotify: number;
  runNotifyWaves: () => void;
}

interface WaveDialogs {
  manageOpen: boolean;
  setManageOpen: Dispatch<SetStateAction<boolean>>;
  builderWaves: WaveDef[];
  assignPreview: { perWave: Record<string, number>; unassigned: number; total: number } | null;
  addWave: () => void;
  updateWave: (waveId: string, patch: Partial<WaveDef>) => void;
  removeWave: (waveId: string) => void;
  toggleWaveGender: (waveId: string, gender: string) => void;
  assignMsg: string;
  assignSaving: boolean;
  saveAndAssign: () => void;
}

interface Props {
  event: RaceDialogEvent;
  edit: EditDialogs;
  results: ResultDialogs;
  csv: CsvDialogs;
  notify: NotifyDialogs;
  waves: WaveDialogs;
}

export default function RaceDialogs({ event, edit, results, csv, notify, waves }: Props) {
  const {
    editReg, setEditReg, editWave, setEditWave, editBib, setEditBib, editNextBib,
    editStatus, setEditStatus, editFinish, setEditFinish, savingEdit, editError, saveEdit,
  } = edit;
  const {
    editingResult, setEditingResult, resultTime, setResultTime, resultPlacement,
    setResultPlacement, savingResult, resultError, saveResult,
  } = results;
  const { csvOpen, setCsvOpen, csvText, setCsvText, csvUploading, csvMessage, uploadCsv } = csv;
  const {
    notifyOpen, setNotifyOpen, notifySaving, notifyMsg, pendingNotify, runNotifyWaves,
  } = notify;
  const {
    manageOpen, setManageOpen, builderWaves, assignPreview, addWave, updateWave,
    removeWave, toggleWaveGender, assignMsg, assignSaving, saveAndAssign,
  } = waves;

  return (
    <>
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

      {/* Results CSV */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload results CSV</DialogTitle>
            <DialogDescription>
              Paste rows with a header:{" "}
              <code className="text-muted-light">email,time,placement</code>.
              Division comes from each athlete&apos;s registration category.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            placeholder={"email,time,placement\nalex.turner@example.com,41:05,8th / 512"}
            className="w-full bg-dark border border-dark-lighter rounded-lg px-3 py-2.5 text-[13px] text-light font-mono placeholder:text-placeholder focus:border-primary focus:outline-none resize-y"
          />
          {csvMessage && <p className="text-[13px] text-muted-light">{csvMessage}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCsvOpen(false)}>Close</Button>
            <Button onClick={uploadCsv} disabled={csvUploading}>
              {csvUploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Wave builder: create waves with conditions + capacity, then sort athletes in */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Build start waves</DialogTitle>
            <DialogDescription>
              Create your start waves and set each one&apos;s time, size, and who it&apos;s for. Save to sort
              athletes in automatically. This is separate from the ticket tiers people bought.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-3">
            {builderWaves.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl border border-dashed border-dark-lighter">
                <p className="font-headline text-[13px] font-bold text-light mb-1">No start waves yet</p>
                <p className="text-[12.5px] text-muted-dark mb-4">Add a wave, set who it&apos;s for, then save to seed athletes in.</p>
                <Button variant="outline" size="sm" onClick={addWave}>
                  <Plus className="w-4 h-4" /> Add your first wave
                </Button>
              </div>
            ) : builderWaves.map((w) => {
              const count = assignPreview?.perWave[w.label] ?? 0;
              return (
                <div key={w.id} className="rounded-xl border border-dark-lighter bg-dark p-3.5">
                  {/* Name / time / capacity / remove */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={w.label}
                      onChange={(e) => updateWave(w.id, { label: e.target.value })}
                      placeholder="Wave name"
                      aria-label={`Wave name for ${w.label || "new wave"}`}
                      className="flex-1 min-w-0 bg-dark-light border border-dark-lighter rounded-lg px-2.5 py-2 text-[14px] font-headline font-bold text-light placeholder:text-placeholder focus:border-primary focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5" title="Start time">
                      <Clock className="w-3.5 h-3.5 text-muted-dark shrink-0" />
                      <input
                        type="time"
                        value={w.startTime ?? ""}
                        onChange={(e) => updateWave(w.id, { startTime: e.target.value })}
                        aria-label={`Start time for ${w.label || "new wave"}`}
                        className="bg-dark-light border border-dark-lighter rounded-lg px-2 py-2 text-[13px] text-light focus:border-primary focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWave(w.id)}
                      className="shrink-0 p-2 text-muted-dark hover:text-red-400 transition-colors"
                      aria-label={`Remove ${w.label || "wave"}`}
                      title="Remove wave"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Conditions */}
                  <p className="font-headline text-[9.5px] font-bold uppercase tracking-widest text-muted-dark mb-2">Who goes in this wave</p>
                  <div className="grid sm:grid-cols-3 gap-2.5">
                    <div>
                      <label htmlFor={`${w.id}-finish-min`} className="text-[11px] text-muted-dark block mb-1">Finish time (mins)</label>
                      <div className="flex items-center gap-1.5">
                        <input type="number" min={0} value={w.finishMin ?? ""} placeholder="min"
                          id={`${w.id}-finish-min`} aria-label={`Minimum finish minutes for ${w.label || "this wave"}`}
                          onChange={(e) => updateWave(w.id, { finishMin: e.target.value === "" ? null : Number(e.target.value) })}
                          className="w-full bg-dark-light border border-dark-lighter rounded-lg px-2 py-1.5 text-[13px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none" />
                        <span className="text-muted-dark text-[12px]">-</span>
                        <input type="number" min={0} value={w.finishMax ?? ""} placeholder="max"
                          aria-label={`Maximum finish minutes for ${w.label || "this wave"}`}
                          onChange={(e) => updateWave(w.id, { finishMax: e.target.value === "" ? null : Number(e.target.value) })}
                          className="w-full bg-dark-light border border-dark-lighter rounded-lg px-2 py-1.5 text-[13px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`${w.id}-age-min`} className="text-[11px] text-muted-dark block mb-1">Age</label>
                      <div className="flex items-center gap-1.5">
                        <input type="number" min={0} value={w.ageMin ?? ""} placeholder="min"
                          id={`${w.id}-age-min`} aria-label={`Minimum age for ${w.label || "this wave"}`}
                          onChange={(e) => updateWave(w.id, { ageMin: e.target.value === "" ? null : Number(e.target.value) })}
                          className="w-full bg-dark-light border border-dark-lighter rounded-lg px-2 py-1.5 text-[13px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none" />
                        <span className="text-muted-dark text-[12px]">-</span>
                        <input type="number" min={0} value={w.ageMax ?? ""} placeholder="max"
                          aria-label={`Maximum age for ${w.label || "this wave"}`}
                          onChange={(e) => updateWave(w.id, { ageMax: e.target.value === "" ? null : Number(e.target.value) })}
                          className="w-full bg-dark-light border border-dark-lighter rounded-lg px-2 py-1.5 text-[13px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`${w.id}-capacity`} className="text-[11px] text-muted-dark block mb-1">Max athletes</label>
                      <input type="number" min={0} value={w.capacity ?? ""} placeholder="Any"
                        id={`${w.id}-capacity`} aria-label={`Maximum athletes in ${w.label || "this wave"}`}
                        onChange={(e) => updateWave(w.id, { capacity: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-full bg-dark-light border border-dark-lighter rounded-lg px-2 py-1.5 text-[13px] text-light placeholder:text-placeholder focus:border-primary focus:outline-none" />
                    </div>
                  </div>

                  {/* Gender + live count */}
                  <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-muted-dark mr-0.5">Gender:</span>
                      {GENDER_CHOICES.map((g) => {
                        const on = (w.genders ?? []).includes(g);
                        return (
                          <button key={g} type="button" onClick={() => toggleWaveGender(w.id, g)}
                            className={`px-2 py-1 rounded-md text-[11px] font-headline font-bold uppercase tracking-wide border transition-colors ${
                              on ? "bg-primary/15 border-primary/40 text-primary" : "bg-dark-light border-dark-lighter text-muted-dark hover:text-light"
                            }`}>
                            {g}
                          </button>
                        );
                      })}
                      {(w.genders ?? []).length === 0 && <span className="text-[11px] text-muted-dark">any</span>}
                    </div>
                    <span className="font-headline text-[11px] font-bold uppercase tracking-widest text-muted">
                      <span className="text-primary font-black italic">{count}</span> athlete{count === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              );
            })}

            {builderWaves.length > 0 && (
              <button type="button" onClick={addWave}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-dark-lighter py-2.5 font-headline text-[11px] font-bold uppercase tracking-widest text-muted hover:text-primary hover:border-primary/40 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add another wave
              </button>
            )}
          </div>

          {assignPreview && builderWaves.length > 0 && assignPreview.unassigned > 0 && (
            <p className="flex items-center gap-2 text-[12.5px] text-muted-light bg-dark border border-dark-lighter rounded-lg px-3 py-2 mt-1">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
              {assignPreview.unassigned} athlete{assignPreview.unassigned === 1 ? "" : "s"} match no wave and will stay unassigned.
            </p>
          )}
          {assignMsg && <p className="text-[13px] text-muted-light mt-1">{assignMsg}</p>}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageOpen(false)}>Close</Button>
            <Button onClick={saveAndAssign} disabled={assignSaving || builderWaves.length === 0} className="shadow-machined">
              {assignSaving ? "Saving…" : "Save & sort athletes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
