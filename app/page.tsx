import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudySummary } from "@/lib/stats";
import Navbar from "@/components/Navbar";
import LessonLibrary from "@/components/LessonLibrary";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();

  const [videos, progresses, studySummary, dueVocabCount] = await Promise.all([
    prisma.video.findMany({
      where: { status: "READY" },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { subtitles: true },
        },
      },
    }),
    session
      ? prisma.learningProgress.findMany({
          where: { userId: session.userId },
          select: {
            videoId: true,
            lastTime: true,
            duration: true,
            completed: true,
          },
        })
      : Promise.resolve([]),
    session ? getStudySummary(session.userId) : Promise.resolve(null),
    session
      ? prisma.vocabItem.count({
          where: {
            userId: session.userId,
            nextReviewAt: { lte: new Date() },
          },
        })
      : Promise.resolve(0),
  ]);

  const progressMap = new Map(progresses.map((p) => [p.videoId, p]));

  const serialized = videos.map((v) => {
    const prog = progressMap.get(v.id);
    return {
      id: v.id,
      title: v.title,
      description: v.description,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      level: v.level,
      tags: v.tags,
      createdAt: v.createdAt.toISOString(),
      subtitleCount: v._count.subtitles,
      progress: prog
        ? {
            lastTime: prog.lastTime,
            duration: prog.duration,
            completed: prog.completed,
          }
        : null,
    };
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar
        username={session?.username ?? null}
        role={session?.role ?? null}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <LessonLibrary
          videos={serialized}
          isAdmin={session?.role === "ADMIN"}
          studySummary={studySummary}
          dueVocabCount={dueVocabCount}
        />
      </main>
    </div>
  );
}
