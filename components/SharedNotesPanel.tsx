"use client";

import { FormEvent, useEffect, useState } from "react";
import { Clock, Loader2, Send, Trash2, Users } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export interface SharedNoteItem {
  id: string;
  userId: string;
  username: string;
  timestampSec: number | null;
  content: string;
  createdAt: string;
}

interface SharedNotesPanelProps {
  videoId: string;
  getCurrentTime: () => number;
  isAuthenticated: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  onJumpToTime: (sec: number) => void;
  onRequireAuth: () => void;
}

function formatMmSs(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function SharedNotesPanel({
  videoId,
  getCurrentTime,
  isAuthenticated,
  currentUserId,
  isAdmin,
  onJumpToTime,
  onRequireAuth,
}: SharedNotesPanelProps) {
  const toast = useToast();
  const [notes, setNotes] = useState<SharedNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [attachTimestamp, setAttachTimestamp] = useState(true);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/shared-notes?videoId=${encodeURIComponent(videoId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;
        if (res.ok && Array.isArray(json.notes)) {
          setNotes(json.notes);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [videoId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập nội dung ghi chú nhóm.");
      return;
    }

    setPosting(true);
    try {
      const timestampSec = attachTimestamp
        ? Number(getCurrentTime().toFixed(1))
        : null;
      const res = await fetch("/api/shared-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          content: trimmed,
          timestampSec,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể đăng ghi chú.");
        return;
      }
      setNotes((prev) => [data.note, ...prev]);
      setContent("");
      toast.success("Đã đăng ghi chú cho nhóm.");
    } catch {
      toast.error("Lỗi kết nối khi đăng ghi chú.");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(noteId: string) {
    setDeletingId(noteId);
    try {
      const res = await fetch(`/api/shared-notes?id=${encodeURIComponent(noteId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Không thể xóa ghi chú.");
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Đã xóa ghi chú nhóm.");
    } catch {
      toast.error("Lỗi kết nối khi xóa ghi chú.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="h-3.5 w-3.5 text-teal-700" />
          <span>Chia sẻ cụm từ hay hoặc thắc mắc với các thành viên cùng học</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              isAuthenticated
                ? "Viết ghi chú chung cho bài học này..."
                : "Đăng nhập để chia sẻ ghi chú với nhóm..."
            }
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-600 focus:bg-white"
          />
          <button
            type="submit"
            disabled={posting}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            {posting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>Gửi</span>
          </button>
        </div>

        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={attachTimestamp}
            onChange={(e) => setAttachTimestamp(e.target.checked)}
            className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
          />
          <span>Đính kèm mốc thời gian video hiện tại</span>
        </label>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" />
          <span>Đang tải ghi chú nhóm...</span>
        </div>
      ) : notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-xs text-slate-400">
          Chưa có ghi chú nhóm nào cho bài học này.
        </p>
      ) : (
        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
          {notes.map((n) => {
            const canDelete = n.userId === currentUserId || isAdmin;
            return (
              <div
                key={n.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      @{n.username}
                    </span>
                    {n.timestampSec !== null && (
                      <button
                        type="button"
                        onClick={() => onJumpToTime(n.timestampSec!)}
                        className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-teal-800 hover:bg-teal-100 cursor-pointer"
                      >
                        <Clock className="h-3 w-3" />
                        <span>{formatMmSs(n.timestampSec)}</span>
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {new Date(n.createdAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {n.content}
                  </p>
                </div>

                {canDelete && (
                  <button
                    type="button"
                    disabled={deletingId === n.id}
                    onClick={() => void handleDelete(n.id)}
                    aria-label="Xóa ghi chú"
                    className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                  >
                    {deletingId === n.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
