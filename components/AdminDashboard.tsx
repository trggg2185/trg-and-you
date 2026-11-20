"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Edit3,
  ExternalLink,
  FileVideo,
  Film,
  HardDrive,
  Languages,
  Loader2,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import UserManagement, { type AdminUserItem } from "@/components/UserManagement";
import R2CleanupTool from "@/components/R2CleanupTool";
import type { UserRole } from "@/lib/jwt";
import {
  LESSON_LEVELS,
  LEVEL_BADGE_STYLES,
  parseTagsList,
} from "@/lib/lessonMeta";

export interface AdminVideoItem {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  r2Key: string;
  thumbnailUrl?: string | null;
  level?: string | null;
  tags?: string | null;
  status: string;
  createdAt: string;
  _count: {
    subtitles: number;
  };
}

interface AdminDashboardProps {
  initialVideos: AdminVideoItem[];
  initialUsers: AdminUserItem[];
  currentAdminId: string;
  currentRole: UserRole;
}

function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error("UPLOAD_FAILED"));
      }
    };

    xhr.onerror = () => {
      reject(new Error("UPLOAD_NETWORK_ERROR"));
    };

    xhr.send(file);
  });
}

export default function AdminDashboard({
  initialVideos,
  initialUsers,
  currentAdminId,
  currentRole,
}: AdminDashboardProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"videos" | "users" | "storage">(
    "videos"
  );
  const [videos, setVideos] = useState<AdminVideoItem[]>(initialVideos);
  const [userCount, setUserCount] = useState(initialUsers.length);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stage, setStage] = useState<
    "idle" | "presigning" | "uploading" | "processing"
  >("idle");
  const [uploadPercent, setUploadPercent] = useState(0);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<AdminVideoItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit inline state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editTags, setEditTags] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const isBusy = stage !== "idle";

  async function refreshVideos() {
    const res = await fetch("/api/videos?all=1");
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!title.trim() || !file) {
      toast.error("Vui lòng nhập tiêu đề và chọn tệp video trước khi tải lên.");
      return;
    }

    try {
      // Step 1: Get Presigned URL
      setStage("presigning");
      setUploadPercent(0);
      const presignRes = await fetch("/api/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "video/mp4",
        }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        toast.error(
          presignData.error || "Không thể khởi tạo phiên tải lên. Vui lòng thử lại."
        );
        return;
      }

      // Step 2: Upload directly to storage with progress bar
      setStage("uploading");
      try {
        await uploadFileWithProgress(
          presignData.uploadUrl,
          file,
          setUploadPercent
        );
      } catch {
        toast.error(
          "Không thể tải tệp video lên máy chủ lưu trữ. Vui lòng thử lại sau."
        );
        return;
      }

      // Step 3: Trigger backend audio extraction & subtitle generation
      setStage("processing");
      const processRes = await fetch("/api/videos/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          level: level || null,
          tags: tags.trim(),
          r2Key: presignData.r2Key,
        }),
      });

      const processData = await processRes.json();
      if (!processRes.ok) {
        await refreshVideos();
        toast.error(
          processData.error ||
            "Không thể tạo phụ đề cho video này. Vui lòng thử lại."
        );
        return;
      }

      toast.success(
        `Bài học "${title.trim()}" đã sẵn sàng với phụ đề và phiên âm IPA!`
      );
      setTitle("");
      setDescription("");
      setLevel("");
      setTags("");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await refreshVideos();
    } catch {
      toast.error("Đã có sự cố kết nối. Vui lòng thử lại sau.");
    } finally {
      setStage("idle");
      setUploadPercent(0);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/videos/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể xóa bài học lúc này.");
        return;
      }
      setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      toast.success(`Đã xóa bài học "${deleteTarget.title}".`);
      setDeleteTarget(null);
    } catch {
      toast.error("Không thể kết nối máy chủ khi xóa bài học.");
    } finally {
      setDeleting(false);
    }
  }

  function startEdit(video: AdminVideoItem) {
    setEditingId(video.id);
    setEditTitle(video.title);
    setEditDescription(video.description ?? "");
    setEditLevel(video.level ?? "");
    setEditTags(video.tags ?? "");
  }

  async function saveEdit(videoId: string) {
    if (!editTitle.trim()) {
      toast.error("Tiêu đề bài học không được để trống.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          level: editLevel || null,
          tags: editTags.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể cập nhật thông tin bài học.");
        return;
      }
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? {
                ...v,
                title: data.video.title,
                description: data.video.description,
                level: data.video.level,
                tags: data.video.tags,
              }
            : v
        )
      );
      setEditingId(null);
      toast.success("Đã cập nhật thông tin bài học.");
    } catch {
      toast.error("Không thể kết nối máy chủ.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("videos")}
          className={`inline-flex items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeTab === "videos"
              ? "bg-teal-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Film className="h-4 w-4 shrink-0" />
          <span className="truncate">Bài học ({videos.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`inline-flex items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeTab === "users"
              ? "bg-teal-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <Users className="h-4 w-4 shrink-0" />
          <span className="truncate">Người dùng ({userCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("storage")}
          className={`inline-flex items-center justify-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
            activeTab === "storage"
              ? "bg-teal-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          <HardDrive className="h-4 w-4 shrink-0" />
          <span className="truncate">Dọn R2</span>
        </button>
      </div>

      {activeTab === "users" ? (
        <UserManagement
          initialUsers={initialUsers}
          currentAdminId={currentAdminId}
          currentRole={currentRole}
          onUserCountChange={setUserCount}
        />
      ) : activeTab === "storage" ? (
        <R2CleanupTool currentRole={currentRole} />
      ) : (
        <div className="animate-fade-up grid gap-8 lg:grid-cols-12">
      {/* Upload & AI Processing Form */}
      <section className="min-w-0 lg:col-span-5">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Tải lên bài học mới
              </h2>
              <p className="text-xs text-slate-500">
                Tải video lên và tự động tạo phụ đề kèm phiên âm IPA
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tiêu đề bài học <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isBusy}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="vd: Peppa Pig - At the Supermarket"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-base sm:text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Mô tả ngắn (tùy chọn)
              </label>
              <textarea
                rows={2}
                disabled={isBusy}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Chủ đề giao tiếp, mẫu câu nổi bật..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-base sm:text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15 disabled:bg-slate-100"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Trình độ (CEFR)
                </label>
                <select
                  disabled={isBusy}
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-base sm:text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15 disabled:bg-slate-100"
                >
                  <option value="">Chưa phân loại</option>
                  {LESSON_LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Thẻ chủ đề
                </label>
                <input
                  type="text"
                  disabled={isBusy}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="vd: giao tiếp, mua sắm"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-base sm:text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tệp video (.mp4, .mkv, .webm){" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.mkv,.webm,video/mp4,video/x-matroska,video/webm"
                disabled={isBusy}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full min-w-0 max-w-full overflow-hidden cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-3 text-xs sm:text-sm text-slate-600 transition hover:border-teal-400 file:mr-2.5 file:rounded-lg file:border-0 file:bg-teal-700 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-800 disabled:opacity-50"
              />
              {file && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <FileVideo className="h-3.5 w-3.5 text-teal-700" />
                  <span className="truncate">
                    {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                </p>
              )}
            </div>

            {stage === "uploading" && (
              <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3.5">
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-teal-800">
                  <span>Đang tải tệp video lên...</span>
                  <span>{uploadPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-teal-100">
                  <div
                    className="h-full rounded-full bg-teal-700 transition-all duration-150"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
              </div>
            )}

            {stage === "processing" && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs font-medium text-amber-800">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-600" />
                <span>
                  Hệ thống đang tách âm thanh và tạo phụ đề IPA. Vui lòng giữ
                  nguyên trang...
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white shadow-xs transition duration-200 hover:bg-teal-800 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {stage === "presigning" && "Đang chuẩn bị..."}
                    {stage === "uploading" && `Đang tải lên (${uploadPercent}%)`}
                    {stage === "processing" && "Đang tạo phụ đề IPA..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Tải lên & Tạo phụ đề</span>
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* Uploaded Videos List */}
      <section className="min-w-0 lg:col-span-7">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-teal-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Danh sách bài học ({videos.length})
              </h2>
            </div>
          </div>

          {videos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-500">
              Chưa có bài học nào trong hệ thống.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {videos.map((video) => {
                const isEditing = editingId === video.id;
                return (
                  <div
                    key={video.id}
                    className="py-4 first:pt-0 last:pb-0 transition"
                  >
                    {isEditing ? (
                      <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-3.5">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Tiêu đề bài học"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-teal-600"
                        />
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Mô tả ngắn"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-teal-600"
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <select
                            value={editLevel}
                            onChange={(e) => setEditLevel(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-teal-600"
                          >
                            <option value="">Chưa phân trình độ</option>
                            {LESSON_LEVELS.map((lv) => (
                              <option key={lv} value={lv}>
                                Trình độ {lv}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            placeholder="Thẻ cách nhau dấu phẩy (vd: giao tiếp, du lịch)"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-teal-600"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Hủy</span>
                          </button>
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => void saveEdit(video.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
                          >
                            {savingEdit ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            <span>Lưu</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold text-slate-900">
                              {video.title}
                            </h3>
                            <StatusBadge status={video.status} />
                            {video.level && (
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                                  LEVEL_BADGE_STYLES[video.level] ??
                                  "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {video.level}
                              </span>
                            )}
                          </div>
                          {parseTagsList(video.tags).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {parseTagsList(video.tags).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          {video.description && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                              {video.description}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                            <span>{video._count.subtitles} câu thoại</span>
                            <span>•</span>
                            <span>
                              {new Date(video.createdAt).toLocaleString("vi-VN")}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {video.status === "READY" && (
                            <Link
                              href={`/learn/${video.id}`}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-teal-700" />
                              <span>Mở</span>
                            </Link>
                          )}
                          <Link
                            href={`/admin/videos/${video.id}`}
                            title="Chỉnh sửa phụ đề và phiên âm IPA"
                            className="inline-flex items-center gap-1 rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100"
                          >
                            <Languages className="h-3.5 w-3.5" />
                            <span>Sub & IPA</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => startEdit(video)}
                            title="Chỉnh sửa tiêu đề / mô tả"
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(video)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        variant="danger"
        title="Xóa bài học này?"
        description={
          deleteTarget
            ? `Bài học "${deleteTarget.title}" cùng toàn bộ phụ đề và tệp video sẽ bị xóa vĩnh viễn.`
            : ""
        }
        confirmText="Xóa vĩnh viễn"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "READY") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/70">
        <CheckCircle2 className="h-3 w-3" />
        Sẵn sàng
      </span>
    );
  }
  if (status === "PROCESSING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200/70">
        <Clock3 className="h-3 w-3" />
        Đang xử lý
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200/70">
      <AlertTriangle className="h-3 w-3" />
      Thất bại
    </span>
  );
}
