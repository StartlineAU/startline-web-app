"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface RejectPanelProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

/** The rejection reason form, shared by the events queue and the event preview. */
export default function RejectPanel({ onConfirm, onCancel, loading }: RejectPanelProps) {
  const [reason, setReason] = useState("");
  return (
    <div className="mt-3 p-4 bg-red-500/[0.08] border border-red-500/20 rounded-lg">
      <label className="font-headline text-[11px] font-bold uppercase tracking-widest text-red-400 block mb-2">
        Rejection reason <span className="text-red-400">*</span>
      </label>
      <textarea
        className="w-full text-[14px] text-light bg-dark border border-red-500/30 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-red-400 placeholder:text-placeholder"
        rows={3}
        placeholder="Explain why the event is being rejected…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex items-center gap-2 mt-2 justify-end">
        <button
          onClick={onCancel}
          disabled={loading}
          className="font-headline text-[12px] font-bold uppercase tracking-widest text-muted hover:text-light px-3 py-1.5 rounded transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => reason.trim() && onConfirm(reason.trim())}
          disabled={loading || !reason.trim()}
          className="font-headline text-[12px] font-bold uppercase tracking-widest bg-red-600 text-white px-4 py-1.5 rounded hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {loading
            ? <><span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> Rejecting…</>
            : <><X className="w-3 h-3" /> Reject</>}
        </button>
      </div>
    </div>
  );
}
