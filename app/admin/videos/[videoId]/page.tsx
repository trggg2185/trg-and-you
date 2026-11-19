import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import SubtitleEditor from "@/components/SubtitleEditor";

export const dynamic = "force-dynamic";

export default async function AdminVideoEditPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/");
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

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar username={session.username} role={session.role} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <SubtitleEditor
          videoId={video.id}
          title={video.title}
          videoUrl={video.videoUrl}
          initialSubtitles={video.subtitles}
        />
      </main>
    </div>
  );
}
