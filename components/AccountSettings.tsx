"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  KeyRound,
  Loader2,
  LockKeyhole,
  Save,
  Shield,
  UserCog,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";

interface AccountSettingsProps {
  initialUsername: string;
  role: "ADMIN" | "USER";
  createdAt: string;
  noteCount: number;
}

export default function AccountSettings({
  initialUsername,
  role,
  createdAt,
  noteCount,
}: AccountSettingsProps) {
  const router = useRouter();
  const toast = useToast();

  const [username, setUsername] = useState(initialUsername);
  const [savedUsername, setSavedUsername] = useState(initialUsername);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handlePreSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedUser = username.trim();
    const hasUserChange = trimmedUser !== savedUsername;
    const hasPasswordChange = newPassword.length > 0;

    if (!hasUserChange && !hasPasswordChange) {
      toast.info("Bạn chưa thay đổi thông tin nào.");
      return;
    }

    if (hasPasswordChange && newPassword !== confirmPassword) {
      toast.error("Mật khẩu mới và xác nhận mật khẩu không khớp.");
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
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể cập nhật thông tin tài khoản.");
        return;
      }

      setSavedUsername(data.user.username);
      setUsername(data.user.username);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setConfirmOpen(false);
      toast.success("Thông tin tài khoản của bạn đã được lưu.");
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <UserCog className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {savedUsername}
              </h2>
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                <Shield className="h-3 w-3 text-teal-700" />
                {role === "ADMIN" ? "Quản trị viên" : "Học viên"}
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-sm">
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

      {/* Edit Form */}
      <div className="lg:col-span-8">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="mb-6 flex items-center gap-2.5">
            <BadgeCheck className="h-5 w-5 text-teal-700" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Cập nhật hồ sơ & Bảo mật
              </h2>
              <p className="text-xs text-slate-500">
                Đổi tên hiển thị hoặc thay đổi mật khẩu đăng nhập của bạn
              </p>
            </div>
          </div>

          <form onSubmit={handlePreSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Tên đăng nhập
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

            <div className="border-t border-slate-100 pt-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <LockKeyhole className="h-4 w-4 text-teal-700" />
                <span>Đổi mật khẩu (bỏ trống nếu không thay đổi)</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Mật khẩu hiện tại
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang sử dụng"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-3.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Lưu thay đổi tài khoản?"
        description="Thông tin đăng nhập mới sẽ có hiệu lực ngay sau khi bạn xác nhận."
        confirmText="Lưu thay đổi"
        loading={saving}
        onConfirm={executeUpdate}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
