import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Flame } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudySummary } from "@/lib/stats";
import Navbar from "@/components/Navbar";
import AccountSettings from "@/components/AccountSettings";

export const dynamic = "force-dynamic";

function formatMins(seconds: number): string {
  if (seconds <= 0) return "0 phút";
  if (seconds < 60) return `${seconds} giây`;
  return `${Math.round(seconds / 60)} phút`;
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const [user, summary] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      include: {
        _count: {
          select: { notes: true, vocabItems: true, savedSentences: true },
        },
      },
    }),
    getStudySummary(session.userId),
  ]);

  if (!user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar username={user.username} role={session.role} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-teal-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại thư viện bài học</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tài khoản của bạn
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý tên đăng nhập, mật khẩu và theo dõi thành tích học tập hàng ngày.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-white px-4 py-3.5 shadow-2xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Chuỗi ngày liên tiếp</p>
              <p className="text-lg font-bold text-slate-900">
                {summary.streakDays} ngày
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-teal-200/80 bg-white px-4 py-3.5 shadow-2xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Hôm nay / Tổng thời gian</p>
              <p className="text-lg font-bold text-slate-900">
                {formatMins(summary.todaySeconds)} /{" "}
                <span className="text-teal-700">
                  {formatMins(summary.totalSeconds)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-white px-4 py-3.5 shadow-2xs">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Câu nghe chép đúng</p>
              <p className="text-lg font-bold text-slate-900">
                {summary.totalDictationCorrect} câu •{" "}
                <span className="text-sm font-semibold text-slate-500">
                  {user._count.vocabItems} từ vựng
                </span>
              </p>
            </div>
          </div>
        </div>

        <AccountSettings
          initialUsername={user.username}
          email={user.email}
          avatarUrl={user.avatarUrl}
          hasGoogle={Boolean(user.googleId)}
          hasPassword={Boolean(user.passwordHash)}
          role={session.role}
          createdAt={user.createdAt.toISOString()}
          noteCount={user._count.notes}
        />
      </main>
    </div>
  );
}
