"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Loader2,
  Lock,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import { isSuperAdminRole, type UserRole } from "@/lib/jwt";

interface R2OrphanFile {
  key: string;
  size: number;
  lastModified: string;
  isRecent: boolean;
}

interface ScanResult {
  totalBucketObjects: number;
  referencedCount: number;
  totalOrphanBytes: number;
  orphans: R2OrphanFile[];
}

interface R2CleanupToolProps {
  currentRole: UserRole;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function R2CleanupTool({ currentRole }: R2CleanupToolProps) {
  const toast = useToast();
  const isSuper = isSuperAdminRole(currentRole);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/r2-cleanup");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể quét bucket R2.");
        return;
      }
      setScanResult(data);
      // Pre-select safe older orphans only (keep <15m recent files unchecked)
      const olderKeys = (data.orphans as R2OrphanFile[])
        .filter((o) => !o.isRecent)
        .map((o) => o.key);
      setSelectedKeys(olderKeys);
      toast.info(
        `Đã quét ${data.totalBucketObjects} tệp trên R2, phát hiện ${data.orphans.length} tệp chưa gắn với bài học.`
      );
    } catch {
      toast.error("Không thể kết nối máy chủ khi quét R2.");
    } finally {
      setScanning(false);
    }
  }

  function toggleKey(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function confirmDelete() {
    if (selectedKeys.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/r2-cleanup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: selectedKeys }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể xóa tệp R2.");
        return;
      }
      const deletedSet = new Set<string>(data.deletedKeys ?? selectedKeys);
      setScanResult((prev) => {
        if (!prev) return null;
        const remaining = prev.orphans.filter((o) => !deletedSet.has(o.key));
        return {
          ...prev,
          totalBucketObjects: Math.max(
            0,
            prev.totalBucketObjects - deletedSet.size
          ),
          orphans: remaining,
          totalOrphanBytes: remaining.reduce((acc, o) => acc + o.size, 0),
        };
      });
      setSelectedKeys([]);
      setConfirmOpen(false);
      toast.success(`Đã dọn sạch ${data.deletedCount ?? deletedSet.size} tệp trên R2.`);
    } catch {
      toast.error("Lỗi kết nối khi xóa tệp R2.");
    } finally {
      setDeleting(false);
    }
  }

  const selectedBytes =
    scanResult?.orphans
      .filter((o) => selectedKeys.includes(o.key))
      .reduce((acc, o) => acc + o.size, 0) ?? 0;

  return (
    <div className="animate-fade-up space-y-5">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Kiểm tra &amp; Dọn tệp thừa trên Cloudflare R2
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Tìm video hoặc ảnh bìa bị sót lại do tải lên dở dang và không còn gắn với bài học nào trong cơ sở dữ liệu.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={scanning}
            onClick={() => void handleScan()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>{scanning ? "Đang quét bucket..." : "Quét tệp R2"}</span>
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Lưu ý an toàn:</strong> Nếu máy local và bản deploy Render dùng chung 1 bucket R2 nhưng khác Database, chỉ nên bấm xóa khi đang chạy trên web deploy Render (tránh xóa nhầm video chỉ có trong Neon DB).
          </span>
        </div>

        {scanResult && (
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
                <p className="text-[11px] text-slate-500">Tổng tệp trên R2</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">
                  {scanResult.totalBucketObjects} tệp
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
                <p className="text-[11px] text-slate-500">Đang gắn bài học</p>
                <p className="mt-0.5 text-lg font-bold text-teal-800">
                  {scanResult.referencedCount} khóa
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
                <p className="text-[11px] text-slate-500">Tệp thừa phát hiện</p>
                <p className="mt-0.5 text-lg font-bold text-amber-700">
                  {scanResult.orphans.length} tệp (
                  {formatBytes(scanResult.totalOrphanBytes)})
                </p>
              </div>
            </div>

            {scanResult.orphans.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/50 py-10 text-center">
                <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-900">
                  Bucket R2 hoàn toàn sạch sẽ!
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  Tất cả tệp trên R2 đều đang khớp với các bài học trong hệ thống.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedKeys(scanResult.orphans.map((o) => o.key))
                      }
                      className="font-semibold text-teal-700 hover:underline cursor-pointer"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedKeys([])}
                      className="font-medium text-slate-500 hover:underline cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>

                  {isSuper ? (
                    <button
                      type="button"
                      disabled={selectedKeys.length === 0 || deleting}
                      onClick={() => setConfirmOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>
                        Xóa {selectedKeys.length} tệp ({formatBytes(selectedBytes)})
                      </span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                      <Lock className="h-3.5 w-3.5" />
                      <span>Chỉ SuperAdmin được phép xóa tệp R2</span>
                    </span>
                  )}
                </div>

                <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                  {scanResult.orphans.map((file) => {
                    const checked = selectedKeys.includes(file.key);
                    return (
                      <label
                        key={file.key}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!isSuper}
                            onChange={() => toggleKey(file.key)}
                            className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-mono font-medium text-slate-800">
                              {file.key}
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Tải lên:{" "}
                              {new Date(file.lastModified).toLocaleString("vi-VN")}
                              {file.isRecent && (
                                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                  Mới (&lt;15 phút)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 font-mono font-semibold text-slate-600">
                          {formatBytes(file.size)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        variant="danger"
        title={`Xóa ${selectedKeys.length} tệp thừa trên R2?`}
        description={`Hành động này sẽ xóa vĩnh viễn ${selectedKeys.length} tệp (${formatBytes(
          selectedBytes
        )}) khỏi bucket Cloudflare R2. Hệ thống tự động kiểm tra lại DB lần cuối để đảm bảo không xóa tệp đang dùng.`}
        confirmText="Xóa khỏi R2"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
