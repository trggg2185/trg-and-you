import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Flame } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudySummary } from "@/lib/stats";
import Navbar from "@/components/Navbar";
import AccountSettings from "@/components/AccountSettings";
import StudyHeatmap from "@/components/StudyHeatmap";
import AccountGoalCard from "@/components/AccountGoalCard";

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
      <Navbar
        username={user.username}
        role={session.role}
        avatarUrl={user.avatarUrl}
      />

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
            Tài khoản &amp; Thống kê học tập
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý hồ sơ, mục tiêu mỗi ngày và theo dõi biểu đồ chuyên cần cá nhân.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-white px-4 py-3.5 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Chuỗi ngày liên tiếp</p>
              <p className="text-lg font-bold text-slate-900">
                {summary.streakDays} ngày
              </p>
            </div>
          </div>

          <AccountGoalCard
            todaySeconds={summary.todaySeconds}
            initialDailyGoalMinutes={summary.dailyGoalMinutes}
          />

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Tổng thời gian học</p>
              <p className="text-lg font-bold text-teal-700">
                {formatMins(summary.totalSeconds)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-white px-4 py-3.5 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Chép chính tả / Từ vựng</p>
              <p className="text-base font-bold text-slate-900">
                {summary.totalDictationCorrect} câu · {user._count.vocabItems} từ
              </p>
            </div>
          </div>
        </div>

        <div id="study-heatmap" className="mb-6 scroll-mt-20">
          <StudyHeatmap
            dailyLogs={summary.dailyLogs}
            todayKey={summary.todayKey}
          />
        </div>

        <AccountSettings
          initialUsername={user.username}
          initialDailyGoalMinutes={user.dailyGoalMinutes}
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
