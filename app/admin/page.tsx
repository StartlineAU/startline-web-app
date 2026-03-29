"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit2, Trash2, EyeOff, Eye, Save, X, Lock,
  AlertCircle, Check, ChevronDown, RefreshCw, Database,
} from "lucide-react";
import {
  FitnessEvent, EventType, AustralianState, CompetitionFormat, ExperienceLevel,
  EVENT_TYPE_OPTIONS, STATE_OPTIONS,
} from "@/types";
import { formatMediumDate } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface EventFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  city: string;
  state: AustralianState | "";
  type: EventType | "";
  format: CompetitionFormat | "";
  level: ExperienceLevel | "";
  image: string;
  registrationUrl: string;
  organizer: string;
  distance: string;
  isOfficial: boolean;
}

const EMPTY_FORM: EventFormData = {
  title: "", description: "", date: "", time: "", endTime: "",
  location: "", city: "", state: "", type: "", format: "", level: "",
  image: "", registrationUrl: "", organizer: "", distance: "", isOfficial: false,
};

// ── Styled sub-components ─────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted block mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text", required = false,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-transparent text-light font-headline text-sm border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 placeholder:text-muted/30 transition-colors"
    />
  );
}

function SelectInput({
  value, onChange, options, required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full appearance-none bg-transparent text-light font-headline text-sm border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 cursor-pointer transition-colors"
      >
        <option value="" disabled className="bg-dark text-muted">— Select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-dark text-light">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-0 bottom-2.5 w-3.5 h-3.5 text-muted pointer-events-none" />
    </div>
  );
}

// ── Password Gate ─────────────────────────────────────────────────────────
function PasswordGate({ onAuth }: { onAuth: (pw: string) => void }) {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onAuth(password);
      } else {
        setError("Incorrect password. Access denied.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-darker flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 border border-dark-lighter mb-6">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">
            Restricted Access
          </p>
          <h1 className="font-headline text-3xl font-black italic tracking-tighter text-light">
            Admin Portal
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-dark border border-dark-lighter p-8">
          <FieldLabel>Admin Password</FieldLabel>
          <div className="relative mb-6">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-transparent text-light font-headline text-base border-b border-dark-lighter focus:border-primary focus:outline-none pb-2 placeholder:text-muted/30 pr-8 transition-colors"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-0 bottom-2 text-muted hover:text-light transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-4 text-red-400 font-headline text-xs font-medium uppercase tracking-widest">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest py-3.5 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            Authenticate
          </button>
        </form>

        <p className="mt-4 text-center font-headline text-[10px] font-medium uppercase tracking-widest text-muted/50">
          This page is not publicly accessible
        </p>
      </div>
    </div>
  );
}

// ── Event Form ────────────────────────────────────────────────────────────
function EventForm({
  initial, onSave, onCancel, password, isSaving, saveError,
}: {
  initial: EventFormData;
  onSave: (data: EventFormData) => void;
  onCancel: () => void;
  password: string;
  isSaving: boolean;
  saveError: string;
}) {
  const [form, setForm] = useState<EventFormData>(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  function field<K extends keyof EventFormData>(key: K) {
    return (value: EventFormData[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
      className="flex flex-col h-full"
    >
      {/* Form header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-lighter flex-shrink-0">
        <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-light">
          {initial.title ? "Edit Event" : "New Event"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted hover:text-light transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        {/* Basic Info */}
        <div>
          <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-primary inline-block" />
            Basic Info
          </p>
          <div className="space-y-5">
            <div>
              <FieldLabel>Title *</FieldLabel>
              <TextInput value={form.title} onChange={field("title")} placeholder="e.g. HYROX Sydney" required />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Type *</FieldLabel>
                <SelectInput
                  value={form.type}
                  onChange={field("type")}
                  options={EVENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  required
                />
              </div>
              <div>
                <FieldLabel>Level *</FieldLabel>
                <SelectInput
                  value={form.level}
                  onChange={field("level")}
                  options={[
                    { value: "open", label: "Open" },
                    { value: "beginner", label: "Beginner" },
                    { value: "elite", label: "Elite" },
                  ]}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>Format *</FieldLabel>
                <SelectInput
                  value={form.format}
                  onChange={field("format")}
                  options={[
                    { value: "individual", label: "Individual" },
                    { value: "team", label: "Team / Pairs" },
                    { value: "both", label: "Both" },
                  ]}
                  required
                />
              </div>
              <div>
                <FieldLabel>Distance</FieldLabel>
                <TextInput value={form.distance} onChange={field("distance")} placeholder="e.g. 42.2km" />
              </div>
            </div>
          </div>
        </div>

        {/* Date & Time */}
        <div>
          <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-primary inline-block" />
            Date &amp; Time
          </p>
          <div className="grid grid-cols-3 gap-5">
            <div>
              <FieldLabel>Date *</FieldLabel>
              <TextInput value={form.date} onChange={field("date")} type="date" required />
            </div>
            <div>
              <FieldLabel>Start Time *</FieldLabel>
              <TextInput value={form.time} onChange={field("time")} type="time" required />
            </div>
            <div>
              <FieldLabel>End Time</FieldLabel>
              <TextInput value={form.endTime} onChange={field("endTime")} type="time" />
            </div>
          </div>
        </div>

        {/* Location */}
        <div>
          <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-primary inline-block" />
            Location
          </p>
          <div className="space-y-5">
            <div>
              <FieldLabel>Venue / Location Name *</FieldLabel>
              <TextInput value={form.location} onChange={field("location")} placeholder="e.g. Sydney Olympic Park" required />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <FieldLabel>City *</FieldLabel>
                <TextInput value={form.city} onChange={field("city")} placeholder="e.g. Sydney" required />
              </div>
              <div>
                <FieldLabel>State *</FieldLabel>
                <SelectInput
                  value={form.state}
                  onChange={field("state")}
                  options={STATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-primary inline-block" />
            Description
          </p>
          <div>
            <FieldLabel>Description *</FieldLabel>
            <textarea
              value={form.description}
              onChange={(e) => field("description")(e.target.value)}
              placeholder="Describe the event..."
              required
              rows={4}
              className="w-full bg-transparent text-light font-headline text-sm border border-dark-lighter focus:border-primary focus:outline-none p-3 placeholder:text-muted/30 resize-y transition-colors leading-relaxed"
            />
          </div>
        </div>

        {/* Registration */}
        <div>
          <p className="font-headline text-[10px] font-medium uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-primary inline-block" />
            Registration
          </p>
          <div className="space-y-5">
            <div>
              <FieldLabel>Registration URL *</FieldLabel>
              <TextInput value={form.registrationUrl} onChange={field("registrationUrl")} placeholder="https://" type="url" required />
            </div>
            <div>
              <FieldLabel>Organiser</FieldLabel>
              <TextInput value={form.organizer} onChange={field("organizer")} placeholder="e.g. HYROX Australia" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => field("isOfficial")(!form.isOfficial)}
                className={`w-5 h-5 border flex items-center justify-center flex-shrink-0 transition-colors ${
                  form.isOfficial ? "bg-primary border-primary" : "border-dark-lighter group-hover:border-primary/50"
                }`}
              >
                {form.isOfficial && <Check className="w-3 h-3 text-dark" />}
              </div>
              <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted group-hover:text-light transition-colors">
                Official / Sanctioned Event
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 border-t border-dark-lighter px-6 py-4">
        {saveError && (
          <div className="flex items-center gap-2 mb-3 text-red-400 font-headline text-xs font-medium uppercase tracking-widest">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {saveError}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving..." : "Save Event"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-light border border-dark-lighter px-5 py-3 hover:border-primary/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Main admin dashboard ──────────────────────────────────────────────────
function AdminDashboard({ password }: { password: string }) {
  const [events, setEvents] = useState<FitnessEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [formData, setFormData] = useState<EventFormData>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      showToast("Failed to load events.", "error");
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function openNewForm() {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setSaveError("");
  }

  function openEditForm(event: FitnessEvent) {
    setFormData({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      endTime: event.endTime ?? "",
      location: event.location,
      city: event.city,
      state: event.state,
      type: event.type,
      format: event.format,
      level: event.level,
      image: event.image ?? "",
      registrationUrl: event.registrationUrl,
      organizer: event.organizer ?? "",
      distance: event.distance ?? "",
      isOfficial: event.isOfficial ?? false,
    });
    setEditingId(event.id);
    setShowForm(true);
    setSaveError("");
  }

  async function handleSave(data: EventFormData) {
    setIsSaving(true);
    setSaveError("");

    const payload: Partial<FitnessEvent> = {
      title: data.title,
      description: data.description,
      date: data.date,
      time: data.time,
      endTime: data.endTime || undefined,
      location: data.location,
      city: data.city,
      state: data.state as AustralianState,
      type: data.type as EventType,
      format: data.format as CompetitionFormat,
      level: data.level as ExperienceLevel,
      image: data.image || "",
      registrationUrl: data.registrationUrl,
      organizer: data.organizer || undefined,
      distance: data.distance || undefined,
      isOfficial: data.isOfficial,
    };

    try {
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/events/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${password}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${password}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "Save failed.");
        return;
      }

      showToast(editingId ? "Event updated." : "Event created.");
      setShowForm(false);
      await loadEvents();
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${password}` },
      });
      if (res.ok) {
        showToast("Event deleted.");
        setDeleteConfirm(null);
        if (editingId === id) setShowForm(false);
        await loadEvents();
      } else {
        showToast("Delete failed.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  }

  async function handleSeed() {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { Authorization: `Bearer ${password}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message ?? "Seeded successfully.");
        await loadEvents();
      } else {
        showToast(data.error ?? "Seed failed.", "error");
      }
    } catch {
      showToast("Seed failed.", "error");
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className="bg-dark-darker flex flex-col" style={{ height: "100dvh" }}>
      {/* ── Top bar ── */}
      <div className="flex-shrink-0 bg-dark border-b border-dark-lighter flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-4">
          <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
            StartLine
          </span>
          <span className="text-dark-lighter">/</span>
          <span className="font-headline text-xs font-medium uppercase tracking-widest text-primary">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            title="Seed events.json into Supabase (run once)"
            className="flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-light border border-dark-lighter px-4 py-2 hover:border-primary/50 transition-colors disabled:opacity-40"
          >
            {isSeeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            Seed DB
          </button>
          <button
            onClick={loadEvents}
            className="flex items-center gap-2 font-headline text-xs font-medium uppercase tracking-widest text-muted hover:text-light border border-dark-lighter px-4 py-2 hover:border-primary/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={openNewForm}
            className="flex items-center gap-2 bg-machined text-dark font-headline text-xs font-bold uppercase tracking-widest px-5 py-2 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Event
          </button>
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Event list */}
        <div className="w-[400px] flex-shrink-0 border-r border-dark-lighter overflow-y-auto bg-dark-darker">
          <div className="px-5 py-3 border-b border-dark-lighter flex items-center justify-between">
            <span className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
              {loadingEvents ? "Loading…" : `${events.length} Event${events.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {loadingEvents ? (
            <div className="p-8 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-muted animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted mb-2">
                No events found
              </p>
              <p className="text-xs text-muted mb-4">
                Click &quot;Seed DB&quot; to import existing events, or add one manually.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 bg-dark-darker">
              {events.map((event) => {
                const isEditing = editingId === event.id;
                return (
                  <div
                    key={event.id}
                    className={`p-4 border-l-4 transition-colors ${
                      isEditing
                        ? "bg-dark-light border-primary"
                        : "bg-dark border-transparent hover:bg-dark-light"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-dark bg-primary px-2 py-0.5 flex-shrink-0">
                        {event.type}
                      </span>
                      <span className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted flex-shrink-0">
                        {formatMediumDate(event.date)}
                      </span>
                    </div>
                    <h3 className={`font-headline text-sm font-black italic tracking-tighter leading-tight mb-3 ${
                      isEditing ? "text-primary" : "text-light"
                    }`}>
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditForm(event)}
                        className="flex items-center gap-1.5 font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-primary border border-dark-lighter hover:border-primary px-3 py-1.5 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      {deleteConfirm === event.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="font-headline text-[10px] font-medium uppercase tracking-widest bg-red-600 text-white px-3 py-1.5 hover:bg-red-500 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-light px-2 py-1.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(event.id)}
                          className="flex items-center gap-1.5 font-headline text-[10px] font-medium uppercase tracking-widest text-muted hover:text-red-400 border border-dark-lighter hover:border-red-400/50 px-3 py-1.5 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Form or empty state */}
        <div className="flex-1 overflow-hidden bg-dark-darker">
          {showForm ? (
            <EventForm
              initial={formData}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingId(null); }}
              password={password}
              isSaving={isSaving}
              saveError={saveError}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center p-12">
              <div className="w-12 h-12 border border-dark-lighter flex items-center justify-center mb-2">
                <Plus className="w-5 h-5 text-muted" />
              </div>
              <p className="font-headline text-xs font-medium uppercase tracking-widest text-muted">
                Select an event to edit, or
              </p>
              <button
                onClick={openNewForm}
                className="flex items-center gap-2 bg-machined text-dark font-headline text-sm font-bold uppercase tracking-widest px-6 py-3 machined-button-shadow hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-100 active:translate-x-0 active:translate-y-0"
              >
                <Plus className="w-4 h-4" />
                Add New Event
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Toast notification ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 font-headline text-sm font-medium uppercase tracking-widest shadow-xl transition-all ${
            toast.type === "success"
              ? "bg-primary text-dark"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────
export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_token");
    if (stored) setPassword(stored);
  }, []);

  function handleAuth(pw: string) {
    sessionStorage.setItem("admin_token", pw);
    setPassword(pw);
  }

  if (!password) {
    return <PasswordGate onAuth={handleAuth} />;
  }

  return <AdminDashboard password={password} />;
}
