import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Headphones } from "lucide-react";
import { getSession } from "@/lib/auth";
import GoogleSignInPanel from "@/components/GoogleSignInPanel";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string; returnTo?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  const resolved = await searchParams;
  const authError = resolved.authError ?? null;
  const returnTo =
    resolved.returnTo && resolved.returnTo.startsWith("/")
      ? resolved.returnTo
      : "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f7f5] px-4 py-10">
      <div className="animate-fade-up w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-7 sm:p-8 shadow-xl shadow-slate-200/50">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3.5 flex h-13 w-13 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-md shadow-teal-900/10">
            <Headphones className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Trg and you
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Không gian luyện Nghe &amp; Shadowing tiếng Anh dịu mắt, tập trung
          </p>
        </div>

        <GoogleSignInPanel returnTo={returnTo} authError={authError} />

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-teal-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại học thử ở chế độ khách</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
