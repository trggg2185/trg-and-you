import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trg and you — Học Tiếng Anh qua Video Hoạt Hình",
  description:
    "Luyện kỹ năng Nghe và Nói (Shadowing) tiếng Anh cùng Trg and you qua video hoạt hình với phụ đề đồng bộ thời gian thực và phiên âm IPA.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f6f7f5] text-slate-800">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
