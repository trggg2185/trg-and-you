"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Headphones,
  KeyRound,
  Loader2,
  LogIn,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
          : "Tạo tài khoản thành công. Bắt đầu luyện tập ngay!"
      );
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f7f5] px-4 py-10">
      <div className="animate-fade-up w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-8 shadow-xl shadow-slate-200/50">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-md shadow-teal-900/10">
            <Headphones className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Trg and you
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Không gian luyện Nghe & Shadowing tiếng Anh dịu mắt, tập trung
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition duration-200 cursor-pointer ${
              mode === "login"
                ? "bg-white text-teal-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LogIn className="h-4 w-4" />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition duration-200 cursor-pointer ${
              mode === "register"
                ? "bg-white text-teal-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            <span>Đăng ký</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/15"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white shadow-xs transition duration-200 hover:bg-teal-800 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {mode === "login" ? "Đăng nhập ngay" : "Tạo tài khoản học viên"}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
