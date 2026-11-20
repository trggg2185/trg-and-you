"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Clock,
  CornerDownRight,
  Loader2,
  MessageCircle,
  NotebookPen,
  Send,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import UserAvatar from "@/components/UserAvatar";
import { isAdminRole, isSuperAdminRole, type UserRole } from "@/lib/jwt";

export interface SharedNoteReplyItem {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  authorRole: string;
  kind: "NOTE" | "COMMENT";
  parentId: string | null;
  timestampSec: number | null;
  content: string;
  createdAt: string;
}

export interface SharedNoteItem extends SharedNoteReplyItem {
  replies?: SharedNoteReplyItem[];
}

interface SharedNotesPanelProps {
  videoId: string;
  getCurrentTime: () => number;
  isAuthenticated: boolean;
  currentUserId: string | null;
  currentUserRole?: UserRole | null;
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
  currentUserRole = null,
  isAdmin,
  onJumpToTime,
  onRequireAuth,
}: SharedNotesPanelProps) {
  const toast = useToast();
  const [notes, setNotes] = useState<SharedNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [postKind, setPostKind] = useState<"NOTE" | "COMMENT">("NOTE");
  const [filterKind, setFilterKind] = useState<"ALL" | "NOTE" | "COMMENT">("ALL");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reply composer state
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [postingReply, setPostingReply] = useState(false);

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

  const filteredNotes = useMemo(() => {
    if (filterKind === "ALL") return notes;
    return notes.filter((n) => n.kind === filterKind);
  }, [notes, filterKind]);

  function canDeleteItem(authorId: string, authorRole: string): boolean {
    if (authorId === currentUserId) return true;
    if (isSuperAdminRole(currentUserRole)) return true;
    if (isAdmin && authorRole === "USER") return true;
    return false;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập nội dung.");
      return;
    }

    setPosting(true);
    try {
      const timestampSec =
        postKind === "NOTE" ? Number(getCurrentTime().toFixed(1)) : null;
      const res = await fetch("/api/shared-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          kind: postKind,
          content: trimmed,
          timestampSec,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể đăng nội dung.");
        return;
      }
      setNotes((prev) => [data.note, ...prev]);
      setContent("");
      toast.success(
        postKind === "NOTE"
          ? "Đã đăng ghi chú mốc cho nhóm."
          : "Đã đăng bình luận."
      );
    } catch {
      toast.error("Lỗi kết nối khi đăng nội dung.");
    } finally {
      setPosting(false);
    }
  }

  async function handleReplySubmit(e: FormEvent, parentId: string) {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    const trimmed = replyContent.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập nội dung trả lời.");
      return;
    }

    setPostingReply(true);
    try {
      const res = await fetch("/api/shared-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          kind: "COMMENT",
          parentId,
          content: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể gửi trả lời.");
        return;
      }
      setNotes((prev) =>
        prev.map((item) =>
          item.id === parentId
            ? { ...item, replies: [...(item.replies ?? []), data.note] }
            : item
        )
      );
      setReplyContent("");
      setReplyingToId(null);
      toast.success("Đã gửi trả lời.");
    } catch {
      toast.error("Lỗi kết nối khi gửi trả lời.");
    } finally {
      setPostingReply(false);
    }
  }

  async function handleDelete(noteId: string, parentId: string | null) {
    setDeletingId(noteId);
    try {
      const res = await fetch(`/api/shared-notes?id=${encodeURIComponent(noteId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Không thể xóa nội dung.");
        return;
      }
      if (parentId) {
        setNotes((prev) =>
          prev.map((item) =>
            item.id === parentId
              ? {
                  ...item,
                  replies: (item.replies ?? []).filter((r) => r.id !== noteId),
                }
              : item
          )
        );
      } else {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
      toast.success("Đã xóa.");
    } catch {
      toast.error("Lỗi kết nối khi xóa.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Compose Type + Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setPostKind("NOTE")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition cursor-pointer ${
              postKind === "NOTE"
                ? "bg-white text-teal-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <NotebookPen className="h-3 w-3" />
            <span>Ghi chú mốc</span>
          </button>
          <button
            type="button"
            onClick={() => setPostKind("COMMENT")}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition cursor-pointer ${
              postKind === "COMMENT"
                ? "bg-white text-teal-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageCircle className="h-3 w-3" />
            <span>Bình luận</span>
          </button>
        </div>

        <div className="inline-flex items-center gap-1 text-[11px]">
          {(
            [
              { key: "ALL", label: `Tất cả (${notes.length})` },
              { key: "NOTE", label: "Ghi chú" },
              { key: "COMMENT", label: "Bình luận" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterKind(f.key)}
              className={`rounded-lg px-2 py-1 font-medium transition cursor-pointer ${
                filterKind === f.key
                  ? "bg-teal-50 text-teal-800 border border-teal-200"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Composer */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            !isAuthenticated
              ? "Đăng nhập để viết ghi chú nhóm hoặc bình luận..."
              : postKind === "NOTE"
              ? "Ghi chú cụm từ hay / phát âm tại mốc video hiện tại..."
              : "Đặt câu hỏi hoặc bình luận trao đổi về bài học..."
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
      </form>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" />
          <span>Đang tải ghi chú &amp; bình luận...</span>
        </div>
      ) : filteredNotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-5 text-center text-xs text-slate-400">
          Chưa có ghi chú hay bình luận nào trong mục này.
        </p>
      ) : (
        <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
          {filteredNotes.map((n) => {
            const replies = n.replies ?? [];
            return (
              <div
                key={n.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <UserAvatar
                      src={n.avatarUrl}
                      name={n.username}
                      sizeClass="h-7 w-7 mt-0.5"
                      textClass="text-[11px]"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">
                          {n.username}
                        </span>
                        {isAdminRole(n.authorRole) && (
                          <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
                            {n.authorRole === "SUPERADMIN"
                              ? "SUPERADMIN"
                              : "ADMIN"}
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            n.kind === "NOTE"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {n.kind === "NOTE" ? "Ghi chú" : "Bình luận"}
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

                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAuthenticated) {
                              onRequireAuth();
                              return;
                            }
                            setReplyingToId((prev) =>
                              prev === n.id ? null : n.id
                            );
                            setReplyContent("");
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                        >
                          <CornerDownRight className="h-3 w-3" />
                          <span>
                            Trả lời{replies.length > 0 ? ` (${replies.length})` : ""}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {canDeleteItem(n.userId, n.authorRole) && (
                    <button
                      type="button"
                      disabled={deletingId === n.id}
                      onClick={() => void handleDelete(n.id, null)}
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

                {/* Threaded Replies */}
                {replies.length > 0 && (
                  <div className="mt-2.5 ml-6 space-y-2 border-l-2 border-teal-200/70 pl-3">
                    {replies.map((rep) => (
                      <div
                        key={rep.id}
                        className="flex items-start justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-2"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <UserAvatar
                            src={rep.avatarUrl}
                            name={rep.username}
                            sizeClass="h-6 w-6 mt-0.5"
                            textClass="text-[10px]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-bold text-slate-800">
                                {rep.username}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(rep.createdAt).toLocaleDateString("vi-VN")}
                              </span>
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-700">
                              {rep.content}
                            </p>
                          </div>
                        </div>

                        {canDeleteItem(rep.userId, rep.authorRole) && (
                          <button
                            type="button"
                            disabled={deletingId === rep.id}
                            onClick={() => void handleDelete(rep.id, n.id)}
                            aria-label="Xóa trả lời"
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                          >
                            {deletingId === rep.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline Reply Input */}
                {replyingToId === n.id && (
                  <form
                    onSubmit={(e) => void handleReplySubmit(e, n.id)}
                    className="mt-2.5 ml-6 flex gap-1.5"
                  >
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={`Trả lời ${n.username}...`}
                      autoFocus
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-teal-600"
                    />
                    <button
                      type="submit"
                      disabled={postingReply}
                      className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
                    >
                      {postingReply ? "..." : "Gửi"}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
