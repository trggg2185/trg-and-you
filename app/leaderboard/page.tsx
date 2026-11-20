import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getGroupWeeklyLeaderboard } from "@/lib/stats";
import Navbar from "@/components/Navbar";
import GroupLeaderboard from "@/components/GroupLeaderboard";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const members = await getGroupWeeklyLeaderboard();

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar
        username={session.username}
        role={session.role}
        avatarUrl={session.avatarUrl ?? null}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-teal-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại thư viện bài học</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Bảng xếp hạng học tập nhóm
              </h1>
              <p className="text-sm text-slate-500">
                Tổng hợp thời gian luyện nghe, chuỗi ngày liên tiếp và mục tiêu hôm nay trong 7 ngày gần nhất.
              </p>
            </div>
          </div>
        </div>

        <GroupLeaderboard members={members} currentUserId={session.userId} />
      </main>
    </div>
  );
}
