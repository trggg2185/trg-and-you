import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BookMarked } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import VocabTrainer from "@/components/VocabTrainer";

export const dynamic = "force-dynamic";

export default async function VocabPage() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const items = await prisma.vocabItem.findMany({
    where: { userId: session.userId },
    orderBy: [{ nextReviewAt: "asc" }, { createdAt: "desc" }],
    include: {
      video: {
        select: { id: true, title: true },
      },
    },
  });

  const serialized = items.map((item) => ({
    ...item,
    nextReviewAt: item.nextReviewAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  const nowMs = new Date().getTime();

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar username={session.username} role={session.role} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-teal-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại thư viện bài học</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <BookMarked className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Kho từ vựng &amp; Flashcard SRS
              </h1>
              <p className="text-sm text-slate-500">
                Ôn tập từ vựng đã chạm lưu bằng thẻ ghi nhớ lặp lại ngắt quãng và xuất Anki CSV.
              </p>
            </div>
          </div>
        </div>

        <VocabTrainer initialItems={serialized} initialNowMs={nowMs} />
      </main>
    </div>
  );
}
