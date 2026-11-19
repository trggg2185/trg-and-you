import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import ShadowingStudio from "@/components/ShadowingStudio";

export const dynamic = "force-dynamic";

export default async function LearnVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const session = await getSession();
  const { videoId } = await params;
  const resolvedSearch = await searchParams;

  const rawT = resolvedSearch.t ? Number(resolvedSearch.t) : null;
  const startAtTime =
    rawT !== null && Number.isFinite(rawT) && rawT >= 0 ? rawT : null;

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      subtitles: {
        orderBy: { index: "asc" },
      },
    },
  });

  if (!video) {
    notFound();
  }

  if (video.status !== "READY" && session?.role !== "ADMIN") {
    redirect("/");
  }

  const [note, savedRows, progress] = session
    ? await Promise.all([
        prisma.note.findUnique({
          where: {
            userId_videoId: {
              userId: session.userId,
              videoId,
            },
          },
        }),
        prisma.savedSentence.findMany({
          where: {
            userId: session.userId,
            subtitle: { videoId },
          },
          select: { subtitleId: true },
        }),
        prisma.learningProgress.findUnique({
          where: {
            userId_videoId: {
              userId: session.userId,
              videoId,
            },
          },
          select: { lastTime: true },
        }),
      ])
    : [null, [], null];

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar
        username={session?.username ?? null}
        role={session?.role ?? null}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-teal-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại thư viện bài học</span>
          </Link>
        </div>

        <ShadowingStudio
          videoId={video.id}
          title={video.title}
          description={video.description}
          level={video.level}
          tags={video.tags}
          videoUrl={video.videoUrl}
          subtitles={video.subtitles}
          initialNote={note?.content ?? ""}
          initialSavedIds={savedRows.map((r) => r.subtitleId)}
          initialProgressTime={progress?.lastTime ?? 0}
          startAtTime={startAtTime}
          isLoggedIn={Boolean(session)}
          currentUserId={session?.userId ?? null}
          isAdmin={session?.role === "ADMIN"}
        />
      </main>
    </div>
  );
}
