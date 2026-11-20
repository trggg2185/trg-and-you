import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession, isAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import AdminDashboard from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || !isAdminRole(session.role)) {
    redirect("/");
  }

  const [videos, users] = await Promise.all([
    prisma.video.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { subtitles: true },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        googleId: true,
        passwordHash: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: {
          select: {
            notes: true,
            sharedNotes: true,
            progresses: true,
            vocabItems: true,
            savedSentences: true,
          },
        },
      },
    }),
  ]);

  const serializedVideos = videos.map((v) => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
  }));

  const serializedUsers = users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    avatarUrl: u.avatarUrl,
    hasGoogle: Boolean(u.googleId),
    hasPassword: Boolean(u.passwordHash),
    role: u.role,
    isBanned: u.isBanned,
    createdAt: u.createdAt.toISOString(),
    _count: u._count,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar
        username={session.username}
        role={session.role}
        avatarUrl={session.avatarUrl ?? null}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-teal-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại thư viện bài học</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quản trị hệ thống — Trg and you
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tải lên bài học, chỉnh sửa phụ đề IPA và quản lý tài khoản người dùng.
          </p>
        </div>

        <AdminDashboard
          initialVideos={serializedVideos}
          initialUsers={serializedUsers}
          currentAdminId={session.userId}
          currentRole={session.role}
        />
      </main>
    </div>
  );
}
