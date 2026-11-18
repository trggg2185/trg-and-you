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
}: {
  params: Promise<{ videoId: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { videoId } = await params;

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

  if (video.status !== "READY" && session.role !== "ADMIN") {
    redirect("/");
  }

  const note = await prisma.note.findUnique({
    where: {
      userId_videoId: {
        userId: session.userId,
        videoId,
      },
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar username={session.username} role={session.role} />

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
          videoUrl={video.videoUrl}
          subtitles={video.subtitles}
          initialNote={note?.content ?? ""}
        />
      </main>
    </div>
  );
}
