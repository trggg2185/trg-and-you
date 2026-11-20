"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bookmark,
  BookOpen,
  GraduationCap,
  Headphones,
  LogIn,
  LogOut,
  Settings2,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import AuthModal from "@/components/AuthModal";
import UserAvatar from "@/components/UserAvatar";
import { isAdminRole, isSuperAdminRole, type UserRole } from "@/lib/jwt";

interface NavbarProps {
  username?: string | null;
  role?: UserRole | null;
  avatarUrl?: string | null;
}

export default function Navbar({ username, role, avatarUrl }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const isLoggedIn = Boolean(username && role);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const authStatus = url.searchParams.get("auth");
    const authError = url.searchParams.get("authError");
    if (!authStatus && !authError) return;

    if (authStatus === "google_linked") {
      toast.success(
        "Đã liên kết tài khoản Google thành công và gỡ bỏ mật khẩu cũ!"
      );
    } else if (authStatus === "google_ok") {
      toast.success(
        `Chào mừng ${username ? `${username} ` : ""}đăng nhập thành công!`
      );
    } else if (authError === "google_already_linked") {
      toast.error(
        "Tài khoản Google này đã gắn với một tài khoản khác trên hệ thống."
      );
    } else if (authError) {
      toast.error("Không thể hoàn tất xác thực Google. Vui lòng thử lại.");
    }

    url.searchParams.delete("auth");
    url.searchParams.delete("authError");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, [toast, username]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.info(
        "Hẹn gặp lại bạn trong buổi luyện tập tiếp theo!",
        "Đã đăng xuất"
      );
      if (
        pathname.startsWith("/admin") ||
        pathname === "/account" ||
        pathname === "/saved" ||
        pathname === "/vocab" ||
        pathname === "/leaderboard"
      ) {
        router.push("/");
      }
      router.refresh();
    } catch {
      toast.error("Không thể đăng xuất lúc này. Vui lòng thử lại.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <Link
              href="/"
              className="group flex items-center gap-2 sm:gap-2.5 text-slate-900 transition shrink-0"
            >
              <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-teal-700 text-white shadow-xs transition duration-200 group-hover:scale-105 group-hover:bg-teal-800">
                <Headphones className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-none">
                  Trg and you
                </span>
                <span className="hidden sm:block mt-0.5 text-[11px] font-medium text-slate-500">
                  Listening & Shadowing
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  pathname === "/"
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Bài học</span>
              </Link>

              {isLoggedIn && (
                <>
                  <Link
                    href="/saved"
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                      pathname === "/saved"
                        ? "bg-teal-50 text-teal-800"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>Đã lưu</span>
                  </Link>
                  <Link
                    href="/vocab"
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                      pathname === "/vocab"
                        ? "bg-teal-50 text-teal-800"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    <span>Từ vựng</span>
                  </Link>
                  <Link
                    href="/leaderboard"
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                      pathname === "/leaderboard"
                        ? "bg-teal-50 text-teal-800"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Trophy className="h-4 w-4" />
                    <span>Xếp hạng</span>
                  </Link>
                </>
              )}

              {isAdminRole(role) && (
                <Link
                  href="/admin"
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                    pathname.startsWith("/admin")
                      ? "bg-teal-50 text-teal-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Quản trị</span>
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            {isLoggedIn ? (
              <>
                <Link
                  href="/saved"
                  title="Câu hay đã lưu"
                  aria-label="Câu hay đã lưu"
                  className={`inline-flex md:hidden items-center gap-1 rounded-xl border p-1.5 sm:px-2.5 text-xs font-semibold transition ${
                    pathname === "/saved"
                      ? "border-teal-600 bg-teal-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Bookmark className="h-4 w-4" />
                </Link>

                <Link
                  href="/vocab"
                  title="Kho từ vựng Flashcard"
                  aria-label="Kho từ vựng Flashcard"
                  className={`inline-flex md:hidden items-center gap-1 rounded-xl border p-1.5 sm:px-2.5 text-xs font-semibold transition ${
                    pathname === "/vocab"
                      ? "border-teal-600 bg-teal-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <GraduationCap className="h-4 w-4" />
                </Link>

                <Link
                  href="/leaderboard"
                  title="Bảng xếp hạng nhóm"
                  aria-label="Bảng xếp hạng nhóm"
                  className={`inline-flex md:hidden items-center gap-1 rounded-xl border p-1.5 sm:px-2.5 text-xs font-semibold transition ${
                    pathname === "/leaderboard"
                      ? "border-teal-600 bg-teal-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Trophy className="h-4 w-4" />
                </Link>

                {isAdminRole(role) && (
                  <Link
                    href="/admin"
                    title="Quản trị"
                    aria-label="Quản trị"
                    className={`inline-flex md:hidden items-center gap-1 rounded-xl border p-1.5 sm:px-2.5 text-xs font-semibold transition ${
                      pathname.startsWith("/admin")
                        ? "border-teal-600 bg-teal-700 text-white"
                        : "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100"
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span className="hidden sm:inline">Quản trị</span>
                  </Link>
                )}

                <Link
                  href="/account"
                  title="Chỉnh sửa thông tin tài khoản"
                  aria-label="Tài khoản"
                  className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border p-1 sm:px-3 text-xs sm:text-sm transition ${
                    pathname === "/account"
                      ? "border-teal-300 bg-teal-50 text-teal-900"
                      : "border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  <UserAvatar
                    src={avatarUrl}
                    name={username ?? "U"}
                    sizeClass="h-6 w-6"
                    textClass="text-[11px]"
                  />
                  <span className="hidden sm:inline max-w-[110px] truncate font-medium">
                    {username}
                  </span>
                  {isAdminRole(role) && (
                    <span
                      className={`hidden sm:inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
                        isSuperAdminRole(role)
                          ? "bg-amber-100 text-amber-800"
                          : "bg-teal-700/10 text-teal-800"
                      }`}
                    >
                      {isSuperAdminRole(role) ? "SUPERADMIN" : "ADMIN"}
                    </span>
                  )}
                  <Settings2 className="hidden sm:inline-block h-3.5 w-3.5 text-slate-400" />
                </Link>

                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 sm:px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-teal-800 cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
}
