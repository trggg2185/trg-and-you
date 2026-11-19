"use client";

import { FormEvent, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Link2,
  Loader2,
  UserCheck,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: "Bạn đã hủy đăng nhập Google.",
  invalid_state: "Phiên xác thực Google đã hết hạn. Vui lòng thử lại.",
  email_unverified: "Email Google của bạn chưa được xác minh.",
  link_expired: "Phiên liên kết tài khoản cũ đã hết hạn. Vui lòng xác minh lại.",
  banned: "Tài khoản này đã bị khóa bởi quản trị viên.",
  google_already_linked:
    "Tài khoản Google này đã gắn với một tài khoản khác trên hệ thống.",
  google_failed: "Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.",
  oauth_config: "Hệ thống chưa cấu hình đầy đủ Google OAuth.",
};

function GoogleLogo() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

interface GoogleSignInPanelProps {
  returnTo?: string;
  authError?: string | null;
  onBusyChange?: (busy: boolean) => void;
}

export default function GoogleSignInPanel({
  returnTo,
  authError,
  onBusyChange,
}: GoogleSignInPanelProps) {
  const pathname = usePathname();
  const toast = useToast();
  const [showLegacyLink, setShowLegacyLink] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [redirectingGoogle, setRedirectingGoogle] = useState(false);

  const resolvedReturnTo =
    returnTo || (pathname && pathname !== "/login" ? pathname : "/");

  const errorBanner = authError ? AUTH_ERROR_MESSAGES[authError] ?? null : null;

  function startGoogleLogin() {
    setRedirectingGoogle(true);
    onBusyChange?.(true);
    const target = new URL(
      `/api/auth/google?mode=login&returnTo=${encodeURIComponent(
        resolvedReturnTo
      )}`,
      window.location.origin
    ).toString();
    window.location.assign(target);
  }

  async function handleLegacyVerify(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    onBusyChange?.(true);
    try {
      const res = await fetch("/api/auth/legacy-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          returnTo: resolvedReturnTo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Không thể xác minh tài khoản cũ.");
        setSubmitting(false);
        onBusyChange?.(false);
        return;
      }

      toast.info("Xác minh thành công — Đang chuyển tới Google để liên kết...");
      const target = new URL(
        data.redirectUrl,
        window.location.origin
      ).toString();
      window.location.assign(target);
    } catch {
      toast.error("Không thể kết nối máy chủ. Vui lòng thử lại.");
      setSubmitting(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="space-y-4">
      {errorBanner && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      <button
        type="button"
        disabled={redirectingGoogle || submitting}
        onClick={startGoogleLogin}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white py-3 px-4 text-sm font-semibold text-slate-800 shadow-xs transition hover:border-teal-400 hover:bg-slate-50 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
      >
        {redirectingGoogle ? (
          <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
        ) : (
          <GoogleLogo />
        )}
        <span>Tiếp tục với tài khoản Google</span>
      </button>

      <p className="text-center text-[11px] leading-relaxed text-slate-500">
        Hệ thống dùng chung một bước đăng nhập / tạo tài khoản an toàn qua Google,
        không cần nhớ mật khẩu.
      </p>

      {/* Legacy Password Account Migration Section */}
      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowLegacyLink((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50/70 transition cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5 text-left">
            <Link2 className="h-3.5 w-3.5 shrink-0" />
            <span>Đã có tài khoản mật khẩu cũ? Liên kết với Google</span>
          </span>
          {showLegacyLink ? (
            <ChevronUp className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" />
          )}
        </button>

        {showLegacyLink && (
          <form
            onSubmit={handleLegacyVerify}
            className="mt-3 space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5"
          >
            <p className="text-[11px] leading-relaxed text-amber-900">
              Dành cho tài khoản cũ (gồm cả Admin hoặc học viên trước đây): nhập
              tên đăng nhập &amp; mật khẩu cũ một lần để chuyển sang đăng nhập
              Google và <strong>gỡ bỏ mật khẩu cũ</strong>.
            </p>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Tên đăng nhập cũ
              </label>
              <div className="relative">
                <UserCheck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="vd: admin hoặc tên cũ"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Mật khẩu cũ
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || redirectingGoogle}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang xác minh...</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Xác minh &amp; chọn tài khoản Google để liên kết</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
