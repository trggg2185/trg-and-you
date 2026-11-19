import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Bookmark } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import SavedSentencesList from "@/components/SavedSentencesList";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const saved = await prisma.savedSentence.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      subtitle: {
        include: {
          video: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  const serialized = saved.map((s) => ({
    id: s.id,
    subtitleId: s.subtitleId,
    createdAt: s.createdAt.toISOString(),
    subtitle: s.subtitle,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar username={session.username} role={session.role} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-teal-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại thư viện bài học</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Bookmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Kho câu hay đã lưu ({serialized.length})
              </h1>
              <p className="text-sm text-slate-500">
                Ôn tập lại các câu giao tiếp và cụm nối âm IPA bạn đã đánh dấu.
              </p>
            </div>
          </div>
        </div>

        <SavedSentencesList initialItems={serialized} />
      </main>
    </div>
  );
}
