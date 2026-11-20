"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Crown,
  Link2,
  Loader2,
  Mail,
  Save,
  Shield,
  Target,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import ConfirmModal from "@/components/ConfirmModal";
import UserAvatar from "@/components/UserAvatar";
import type { UserRole } from "@/lib/jwt";

interface AccountSettingsProps {
  initialUsername: string;
  initialDailyGoalMinutes: number;
  email?: string | null;
  avatarUrl?: string | null;
  hasGoogle: boolean;
  hasPassword: boolean;
  role: UserRole;
  createdAt: string;
  noteCount: number;
}

const GOAL_PRESETS = [5, 10, 15, 20, 30, 45, 60];

export default function AccountSettings({
  initialUsername,
  initialDailyGoalMinutes,
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
  const [prevGoalProp, setPrevGoalProp] = useState(initialDailyGoalMinutes);
  const [goalInput, setGoalInput] = useState(String(initialDailyGoalMinutes));
  const [savedGoal, setSavedGoal] = useState(initialDailyGoalMinutes);
  if (initialDailyGoalMinutes !== prevGoalProp) {
    setPrevGoalProp(initialDailyGoalMinutes);
    setGoalInput(String(initialDailyGoalMinutes));
    setSavedGoal(initialDailyGoalMinutes);
  }
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const parsedGoal = Number(goalInput);
  const validGoal =
    goalInput.trim() !== "" &&
    Number.isFinite(parsedGoal) &&
    parsedGoal >= 5 &&
    parsedGoal <= 180
      ? Math.round(parsedGoal)
      : null;

  function handlePreSubmit(e: FormEvent) {
    e.preventDefault();
    if (validGoal === null) {
      toast.error("Vui lòng nhập mục tiêu từ 5 đến 180 phút.");
      return;
    }

    const trimmedUser = username.trim();
    const usernameChanged = trimmedUser !== savedUsername;
    const goalChanged = validGoal !== savedGoal;

    if (!usernameChanged && !goalChanged) {
      toast.info("Bạn chưa thay đổi thông tin nào.");
      return;
    }

    if (!usernameChanged && goalChanged) {
      void executeUpdate(validGoal);
      return;
    }

    setConfirmOpen(true);
  }

  async function executeUpdate(targetGoal = validGoal ?? savedGoal) {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          dailyGoalMinutes: targetGoal,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể cập nhật thông tin tài khoản.");
        return;
      }

      setSavedUsername(data.user.username);
      setUsername(data.user.username);
      if (typeof data.user.dailyGoalMinutes === "number") {
        setSavedGoal(data.user.dailyGoalMinutes);
        setGoalInput(String(data.user.dailyGoalMinutes));
      }
      setConfirmOpen(false);
      toast.success("Thông tin và mục tiêu học tập đã được lưu.");
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
            <UserAvatar
              src={avatarUrl}
              name={savedUsername}
              sizeClass="h-12 w-12"
              textClass="text-base"
            />
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900">
                {savedUsername}
              </h2>
              <span
                className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  role === "SUPERADMIN"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {role === "SUPERADMIN" ? (
                  <Crown className="h-3 w-3 text-amber-600" />
                ) : (
                  <Shield className="h-3 w-3 text-teal-700" />
                )}
                {role === "SUPERADMIN"
                  ? "SuperAdmin"
                  : role === "ADMIN"
                  ? "Quản trị viên"
                  : "Học viên"}
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

            <div className="border-t border-slate-100 pt-5">
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Target className="h-4 w-4 text-teal-700" />
                <span>Mục tiêu học mỗi ngày (phút)</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {GOAL_PRESETS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setGoalInput(String(mins))}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      validGoal === mins
                        ? "border-teal-600 bg-teal-700 text-white shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {mins} phút
                  </button>
                ))}
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onBlur={() => {
                      if (validGoal !== null) {
                        setGoalInput(String(validGoal));
                      }
                    }}
                    className="w-20 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-center text-xs font-semibold text-slate-900 outline-none focus:border-teal-600 focus:bg-white"
                  />
                  <span className="text-xs text-slate-500">phút</span>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Giúp theo dõi phần trăm hoàn thành mỗi ngày trên trang chủ &amp; bảng nhóm.
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
                    <span>Lưu cài đặt</span>
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
