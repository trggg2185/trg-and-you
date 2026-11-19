"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Headphones,
  KeyRound,
  Loader2,
  LogIn,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

interface AuthModalProps {
  open: boolean;
  initialMode?: "login" | "register";
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({
  open,
  initialMode = "login",
  onClose,
  onSuccess,
}: AuthModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, loading, onClose]);

  if (!open || !mounted) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(
          data.error || "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại."
        );
        return;
      }

      toast.success(
        mode === "login"
          ? `Chào mừng ${data.user?.username ?? ""} quay trở lại!`
          : "Tạo tài khoản thành công!"
      );
      setUsername("");
      setPassword("");
      onClose();
      onSuccess?.();
      router.refresh();
    } catch {
      toast.error("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={() => {
          if (!loading) onClose();
        }}
        className="animate-modal-backdrop fixed inset-0 bg-slate-900/50"
      />

      <div className="animate-modal-panel relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xl shadow-slate-900/20">
        <button
          type="button"
          disabled={loading}
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm">
            <Headphones className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Trg and you
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Đăng nhập để lưu ghi chú cá nhân cho từng bài học
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition cursor-pointer ${
              mode === "login"
                ? "bg-white text-teal-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition cursor-pointer ${
              mode === "register"
                ? "bg-white text-teal-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Đăng ký</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Tên đăng nhập
            </label>
            <div className="relative">
              <UserCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="vd: minhanh"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-base sm:text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-700">
              Mật khẩu
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "register" ? "Tối thiểu 6 ký tự" : "Nhập mật khẩu"
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-base sm:text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {mode === "login" ? "Đăng nhập ngay" : "Tạo tài khoản"}
            </span>
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
