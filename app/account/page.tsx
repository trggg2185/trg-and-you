import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import AccountSettings from "@/components/AccountSettings";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      _count: {
        select: { notes: true },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f5]">
      <Navbar username={user.username} role={session.role} />

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
            Tài khoản của bạn
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý tên đăng nhập và bảo mật mật khẩu trên Trg and you.
          </p>
        </div>

        <AccountSettings
          initialUsername={user.username}
          role={session.role}
          createdAt={user.createdAt.toISOString()}
          noteCount={user._count.notes}
        />
      </main>
    </div>
  );
}
