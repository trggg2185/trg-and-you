"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Link2,
  Loader2,
  Mail,
  Save,
  Shield,
  UserCog,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

interface AccountSettingsProps {
  initialUsername: string;
  email?: string | null;
  avatarUrl?: string | null;
  hasGoogle: boolean;
  hasPassword: boolean;
  role: "ADMIN" | "USER";
  createdAt: string;
  noteCount: number;
}

export default function AccountSettings({
  initialUsername,
  email = null,
  avatarUrl = null,
  hasGoogle,
  hasPassword,
  role,
  createdAt,
  noteCount,
}: AccountSettingsProps) {
  const router = useRouter();
  const toast = useToast();

  const [username, setUsername] = useState(initialUsername);
  const [savedUsername, setSavedUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handlePreSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedUser = username.trim();
    if (trimmedUser === savedUsername) {
      toast.info("Bạn chưa thay đổi tên hiển thị nào.");
      return;
    }
    setConfirmOpen(true);
  }

  async function executeUpdate() {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể cập nhật thông tin tài khoản.");
        return;
      }

      setSavedUsername(data.user.username);
      setUsername(data.user.username);
      setConfirmOpen(false);
      toast.success("Tên hiển thị của bạn đã được cập nhật.");
      router.refresh();
    } catch {
      toast.error("Không thể kết nối máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-up grid gap-6 lg:grid-cols-12">
      {/* Account Summary Card */}
      <div className="lg:col-span-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-3.5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={savedUsername}
                className="h-12 w-12 rounded-2xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <UserCog className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900">
                {savedUsername}
              </h2>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                <Shield className="h-3 w-3 text-teal-700" />
                {role === "ADMIN" ? "Quản trị viên" : "Học viên"}
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-sm">
            {email && (
              <div className="flex items-center justify-between gap-2 text-slate-600">
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>Google</span>
                </span>
                <span className="truncate font-medium text-slate-900">
                  {email}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-slate-600">
              <span>Ngày tham gia</span>
              <span className="font-medium text-slate-900">
                {new Date(createdAt).toLocaleDateString("vi-VN")}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Số bài đã ghi chú</span>
              <span className="font-medium text-slate-900">
                {noteCount} bài học
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Google Link Status + Username Settings */}
      <div className="space-y-6 lg:col-span-8">
        {/* Google Auth Link Banner */}
        {!hasGoogle ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    Liên kết với tài khoản Google để gỡ bỏ mật khẩu cũ
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">
                    Tài khoản này vẫn đang gắn mật khẩu cũ. Hãy liên kết với
                    Google để đăng nhập nhanh một chạm và tự động xóa mật khẩu cũ
                    khỏi hệ thống (vẫn giữ nguyên toàn bộ ghi chú, câu đã lưu, từ vựng).
                  </p>
                </div>
              </div>

              <a
                href="/api/auth/google?mode=link&returnTo=/account"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800"
              >
                <Link2 className="h-4 w-4" />
                <span>Liên kết Google ngay</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-950">
                  Đã liên kết tài khoản Google{email ? ` (${email})` : ""}
                </p>
                <p className="text-xs text-emerald-800">
                  {hasPassword
                    ? "Đang hoàn tất đồng bộ bảo mật."
                    : "Đăng nhập hoàn toàn qua Google — mật khẩu cũ đã được loại bỏ."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-6 flex items-center gap-2.5">
            <BadgeCheck className="h-5 w-5 text-teal-700" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Thông tin hiển thị
              </h2>
              <p className="text-xs text-slate-500">
                Đổi tên hiển thị của bạn trên ghi chú nhóm và bảng điều khiển
              </p>
            </div>
          </div>

          <form onSubmit={handlePreSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tên hiển thị
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={32}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              />
              <p className="mt-1 text-xs text-slate-400">
                Từ 3–32 ký tự, chỉ gồm chữ cái, số và ký tự _ . -
              </p>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Lưu tên hiển thị</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Xác nhận đổi tên hiển thị?"
        description="Tên mới sẽ cập nhật ngay trên phiên đăng nhập hiện tại của bạn."
        confirmText="Lưu thay đổi"
        loading={saving}
        onConfirm={() => void executeUpdate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
