import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import LessonLibrary from "@/components/LessonLibrary";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const videos = await prisma.video.findMany({
    where: { status: "READY" },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { subtitles: true },
      },
    },
  });

  const serialized = videos.map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    videoUrl: v.videoUrl,
    createdAt: v.createdAt.toISOString(),
    subtitleCount: v._count.subtitles,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar username={session.username} role={session.role} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <LessonLibrary
          videos={serialized}
          isAdmin={session.role === "ADMIN"}
        />
      </main>
    </div>
  );
}
